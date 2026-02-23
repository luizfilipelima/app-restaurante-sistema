/**
 * Caixa / PDV — Hub central de pagamentos da operação física
 *
 * Unifica: Mesas, Comandas Digitais e Comandas Físicas (Buffet).
 * Exclui estritamente pedidos de Delivery.
 *
 * Layout split screen:
 *  • Esquerda — Input gigante (barras/mesa/comanda) + Fila de contas em aberto
 *  • Direita  — Terminal de pagamento (itens, multimoeda, troco, finalizar)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { useRestaurant, useHallZones } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { supabase } from '@/lib/supabase';
import {
  formatCurrency,
  getComandaPublicUrl,
  type CurrencyCode,
} from '@/lib/utils';
import {
  convertBetweenCurrencies,
  getCurrencySymbol,
  convertPriceFromStorage,
  type ExchangeRates,
} from '@/lib/priceHelper';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { toast } from '@/hooks/use-toast';
import { usePrinter } from '@/hooks/usePrinter';
import { OrderReceipt } from '@/components/receipt/OrderReceipt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow, startOfDay } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, es, enUS } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeLib from 'qrcode';
import {
  ScanBarcode,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  Wifi,
  WifiOff,
  QrCode,
  Download,
  Printer,
  Plus,
  Trash2,
  User,
  Clock,
  LayoutGrid,
  ShoppingBag,
  RefreshCw,
  ListChecks,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { CashierCompletedView } from '@/components/cashier/CashierCompletedView';

const DATE_LOCALES = { pt: ptBR, es, en: enUS } as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type QueueItemType = 'comanda_digital' | 'comanda_buffet' | 'table';

interface QueueItemBase {
  id: string;
  type: QueueItemType;
  label: string; // "Mesa 12" | "Comanda 450" | "CMD-A7F2"
  customerName: string | null;
  totalAmount: number; // na moeda base do restaurante (storage format)
  createdAt: string;
}

interface QueueItemComandaDigital extends QueueItemBase {
  type: 'comanda_digital';
  virtualComandaId: string;
  shortCode: string;
  tableNumber: string | null;
  items: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; notes: string | null }[];
}

interface QueueItemComandaBuffet extends QueueItemBase {
  type: 'comanda_buffet';
  comandaId: string;
  number: number;
  items: { id: string; description: string; quantity: number; unit_price: number; total_price: number }[];
}

interface QueueItemTable extends QueueItemBase {
  type: 'table';
  orderId: string;
  tableNumber: number;
  hallZoneId: string | null;
  order: import('@/types').DatabaseOrder;
}

type CashierQueueItem = QueueItemComandaDigital | QueueItemComandaBuffet | QueueItemTable;

/** Conta concluída (paga) hoje — para histórico e tempo de permanência */
interface CompletedItem {
  id: string;
  type: QueueItemType;
  label: string;
  totalAmount: number;
  arrivalAt: string;
  exitAt: string;
  paymentMethods: string;
  /** Order para recibo (table/comanda_digital) */
  order?: import('@/types').DatabaseOrder;
  /** Comanda buffet: itens e dados para recibo simples */
  comandaBuffet?: { number: number; items: { description: string; quantity: number; total_price: number }[] };
}

type PaymentMethod = 'cash' | 'card' | 'pix' | 'bank_transfer';
interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  currency: CurrencyCode;
  amount: number; // storage format
  displayValue: string;
}

function getPaymentLabels(t: (k: string) => string): Record<PaymentMethod, string> {
  return {
    cash: t('cashier.paymentLabels.cash'),
    card: t('cashier.paymentLabels.card'),
    pix: t('cashier.paymentLabels.pix'),
    bank_transfer: t('cashier.paymentLabels.bank_transfer'),
  };
}

const SCANNER_PATTERN = /^CMD-[A-Z0-9]{4}$/i;
const ALL_CURRENCIES: CurrencyCode[] = ['BRL', 'PYG', 'ARS', 'USD'];

function getDisplayTotal(
  totalAmount: number,
  items?: { total_price: number }[]
): number {
  if (totalAmount != null && totalAmount > 0) return totalAmount;
  return (items ?? []).reduce((s, i) => s + Number(i.total_price), 0);
}

// ─── Modal QR Code ────────────────────────────────────────────────────────────

function QRModal({
  open,
  onClose,
  url,
  restaurantName,
  logo,
  t,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  restaurantName: string;
  logo: string | null;
  t: (k: string) => string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const png = await QRCodeLib.toDataURL(url, {
        type: 'image/png',
        margin: 2,
        width: 512,
        color: { dark: '#0f172a', light: '#00000000' },
        errorCorrectionLevel: 'H',
      });
      const a = document.createElement('a');
      a.href = png;
      a.download = `qrcode-comanda-${restaurantName.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const qrPng = await QRCodeLib.toDataURL(url, {
        type: 'image/png',
        margin: 2,
        width: 280,
        color: { dark: '#0f172a', light: '#00000000' },
        errorCorrectionLevel: 'H',
      });
      const logoHtml = logo
        ? `<img src="${logo}" alt="" style="height:64px;width:64px;border-radius:16px;object-fit:cover;border:1px solid #e2e8f0;margin-bottom:12px" />`
        : '';
      const win = window.open('', '_blank');
      if (!win) {
        alert(t('cashier.allowPopups'));
        return;
      }
      win.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR Comanda</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
        .card{text-align:center;max-width:320px}.logo{margin-bottom:8px}.title{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
        .name{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:20px}.qr{padding:12px;border:2px solid #f1f5f9;border-radius:16px;display:inline-block;margin-bottom:14px}
        .url{font-size:10px;color:#94a3b8;word-break:break-all;font-family:monospace;margin-bottom:14px}.hint{font-size:11px;color:#64748b;background:#f8fafc;padding:12px;border-radius:12px;line-height:1.5}
        </style></head><body><div class="card">${logoHtml}<p class="title">${t('cashier.scanToOpen')}</p>
        <p class="name">${restaurantName}</p><div class="qr"><img src="${qrPng}" width="280" height="280"/></div>
        <p class="url">${url}</p><p class="hint">${t('cashier.scanHintPrint')}</p></div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script></body></html>`
      );
      win.document.close();
    } catch (e) {
      console.error(e);
    } finally {
      setPrinting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl bg-white dark:bg-slate-900 dark:border-slate-700">
        <div className="flex flex-col items-center gap-4 px-5 py-5">
          <DialogTitle className="text-sm font-bold text-slate-900">{t('cashier.qrModalTitle')}</DialogTitle>
          {logo ? (
            <img src={logo} alt={restaurantName} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center">
              <QrCode className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="p-2 bg-white rounded-xl border">
            <QRCodeSVG value={url} size={196} level="H" fgColor="#0f172a" bgColor="#ffffff" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} disabled={printing}>
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {t('cashier.print')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('cashier.download')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ScanBarcode className="h-4 w-4" />}
              {copied ? t('cashier.copied') : t('cashier.copy')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card da fila ─────────────────────────────────────────────────────────────

function QueueCard({
  item,
  selected,
  currency,
  onClick,
  t,
  dateLocale,
}: {
  item: CashierQueueItem;
  selected: boolean;
  currency: CurrencyCode;
  onClick: () => void;
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const total = getDisplayTotal(
    item.totalAmount,
    item.type === 'comanda_digital'
      ? item.items
      : item.type === 'comanda_buffet'
        ? item.items
        : undefined
  );
  const badgeClass =
    item.type === 'table'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : item.type === 'comanda_buffet'
        ? 'bg-orange-100 text-orange-700 border-orange-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-[#F87116] bg-orange-50/60 dark:bg-orange-950/30 shadow-sm'
          : 'border-border bg-card hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={`text-[10px] font-bold ${badgeClass} border`}>{item.label}</Badge>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {item.customerName || t('cashier.noName')}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold text-foreground">{formatCurrency(total, currency)}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end mt-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: false, locale: dateLocale })}
          </p>
        </div>
        {selected && (
          <ChevronRight className="h-4 w-4 text-[#F87116] flex-shrink-0 self-center" />
        )}
      </div>
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function CashierContent() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const { t, lang } = useAdminTranslation();
  const dateLocale = DATE_LOCALES[lang] ?? ptBR;
  const scannerRef = useRef<HTMLInputElement>(null);
  const { data: restaurant } = useRestaurant(restaurantId);
  const { printOrder, receiptData, secondReceiptData } = usePrinter();
  const comandaUrl = restaurant?.slug ? getComandaPublicUrl(restaurant.slug) : null;

  const [showQRModal, setShowQRModal] = useState(false);
  const [queue, setQueue] = useState<CashierQueueItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [selected, setSelected] = useState<CashierQueueItem | null>(null);
  const [closing, setClosing] = useState(false);
  const [justClosed, setJustClosed] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'cashier' | 'completed'>('cashier');
  const [completedList, setCompletedList] = useState<CompletedItem[]>([]);

  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);
  const { data: hasTables } = useFeatureAccess('feature_tables', restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);

  const exchangeRates: ExchangeRates = restaurant?.exchange_rates ?? {
    pyg_per_brl: 3600,
    ars_per_brl: 1150,
    usd_per_brl: 0.18,
  };
  const baseCurrency: CurrencyCode = (restaurant?.currency as CurrencyCode) || 'BRL';
  const paymentCurrencies: CurrencyCode[] = (() => {
    const arr = (restaurant as { payment_currencies?: string[] })?.payment_currencies;
    if (!Array.isArray(arr) || arr.length === 0) return [baseCurrency];
    const valid = arr.filter((c): c is CurrencyCode => ALL_CURRENCIES.includes(c as CurrencyCode));
    const withBase = valid.includes(baseCurrency) ? valid : [baseCurrency, ...valid];
    return [...new Set(withBase)];
  })();

  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async (showLoading = false) => {
    if (!restaurantId) return;
    if (showLoading) setLoadingList(true);
    try {
      const items: CashierQueueItem[] = [];

      const [vcRes, comandasRes, ordersRes] = await Promise.all([
        supabase
          .from('virtual_comandas')
          .select('id, short_code, customer_name, table_number, total_amount, created_at, virtual_comanda_items(id, product_name, quantity, unit_price, total_price, notes)')
          .eq('restaurant_id', restaurantId)
          .eq('status', 'open')
          .order('created_at', { ascending: true }),
        !!hasBuffet
          ? supabase
              .from('comandas')
              .select('id, number, total_amount, opened_at, comanda_items(id, description, quantity, unit_price, total_price)')
              .eq('restaurant_id', restaurantId)
              .eq('status', 'open')
              .order('opened_at', { ascending: true })
          : { data: [] },
        !!hasTables
          ? supabase
              .from('orders')
              .select(`
                id, customer_name, total, created_at, table_id,
                delivery_type, order_source,
                order_items(id, product_name, quantity, unit_price, total_price, observations, customer_name),
                tables(number, hall_zone_id)
              `)
              .eq('restaurant_id', restaurantId)
              .eq('is_paid', false)
              .neq('status', 'cancelled')
              .eq('order_source', 'table')
          : { data: [] },
      ]);

      const vcData = (vcRes.data ?? []) as any[];
      vcData.forEach((vc) => {
        items.push({
          id: `vc-${vc.id}`,
          type: 'comanda_digital',
          label: vc.short_code,
          customerName: vc.customer_name,
          totalAmount: vc.total_amount ?? 0,
          createdAt: vc.created_at,
          virtualComandaId: vc.id,
          shortCode: vc.short_code,
          tableNumber: vc.table_number,
          items: (vc.virtual_comanda_items ?? []).map((i: any) => ({
            id: i.id,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.total_price,
            notes: i.notes,
          })),
        });
      });

      const comandasData = (comandasRes.data ?? []) as any[];
      comandasData.forEach((c) => {
        items.push({
          id: `buf-${c.id}`,
          type: 'comanda_buffet',
          label: `Buffet — Comanda ${c.number}`,
          customerName: null,
          totalAmount: c.total_amount ?? 0,
          createdAt: c.opened_at,
          comandaId: c.id,
          number: c.number,
          items: (c.comanda_items ?? []).map((i: any) => ({
            id: i.id,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.total_price,
          })),
        });
      });

      const ordersData = (ordersRes.data ?? []) as any[];
      const tableOrders = ordersData.filter(
        (o: any) => (o.order_source === 'table' || o.table_id) && o.order_source !== 'delivery' && o.delivery_type !== 'delivery'
      );
      tableOrders.forEach((o: any) => {
        const t = o.tables;
        const tableNum = t?.number ?? o.table_id ?? '?';
        items.push({
          id: `ord-${o.id}`,
          type: 'table',
          label: `Mesa ${tableNum}`,
          customerName: o.customer_name,
          totalAmount: o.total ?? 0,
          createdAt: o.created_at,
          orderId: o.id,
          tableNumber: Number(tableNum),
          hallZoneId: t?.hall_zone_id ?? null,
          order: o,
        });
      });

      setQueue(items);
    } catch (e) {
      console.error(e);
      toast({ title: t('cashier.errorLoadQueue'), variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [restaurantId, hasBuffet, hasTables, t]);

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);

  const loadCompletedToday = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const items: CompletedItem[] = [];
      const labels = getPaymentLabels(t);
      const pmLabel = (m: string) => labels[m as PaymentMethod] ?? m;

      const [ordersRes, vcRes, comandasRes] = await Promise.all([
        hasTables
          ? supabase
              .from('orders')
              .select(`
                id, customer_name, total, created_at, updated_at, payment_method,
                table_id, order_source,
                order_items(id, product_name, quantity, unit_price, total_price, observations, customer_name),
                tables(number)
              `)
              .eq('restaurant_id', restaurantId)
              .eq('is_paid', true)
              .eq('order_source', 'table')
              .gte('updated_at', todayStart)
          : { data: [] },
        supabase
          .from('virtual_comandas')
          .select('id, short_code, customer_name, created_at, closed_at, total_amount')
          .eq('restaurant_id', restaurantId)
          .in('status', ['paid', 'closed'])
          .gte('closed_at', todayStart)
          .order('closed_at', { ascending: false }),
        hasBuffet
          ? supabase
              .from('comandas')
              .select('id, number, total_amount, opened_at, closed_at, comanda_items(id, description, quantity, unit_price, total_price)')
              .eq('restaurant_id', restaurantId)
              .eq('status', 'closed')
              .gte('closed_at', todayStart)
              .order('closed_at', { ascending: false })
          : { data: [] },
      ]);

      const ordersData = (ordersRes.data ?? []) as any[];
      ordersData.forEach((o) => {
        items.push({
          id: `ord-${o.id}`,
          type: 'table',
          label: `Mesa ${o.tables?.number ?? o.table_id ?? '?'}`,
          totalAmount: o.total ?? 0,
          arrivalAt: o.created_at,
          exitAt: o.updated_at,
          paymentMethods: pmLabel(o.payment_method ?? 'cash'),
          order: o,
        });
      });

      const vcData = (vcRes.data ?? []) as any[];
      for (const vc of vcData) {
        const { data: ord } = await supabase
          .from('orders')
          .select(`
            id, restaurant_id, customer_name, customer_phone, total, subtotal, delivery_fee, payment_method,
            delivery_type, delivery_address, order_source, notes, created_at, status, is_paid, updated_at,
            order_items(id, product_name, quantity, unit_price, total_price, observations),
            delivery_zone:delivery_zones(id, location_name, fee)
          `)
          .eq('virtual_comanda_id', vc.id)
          .eq('is_paid', true)
          .maybeSingle();
        items.push({
          id: `vc-${vc.id}`,
          type: 'comanda_digital',
          label: vc.short_code ?? `VC-${vc.id.slice(0, 8)}`,
          totalAmount: vc.total_amount ?? 0,
          arrivalAt: vc.created_at,
          exitAt: vc.closed_at ?? vc.created_at,
          paymentMethods: ord ? pmLabel(ord.payment_method ?? 'cash') : '—',
          order: ord ? (ord as unknown as import('@/types').DatabaseOrder) : undefined,
        });
      }

      const comandasData = (comandasRes.data ?? []) as any[];
      comandasData.forEach((c) => {
        items.push({
          id: `buf-${c.id}`,
          type: 'comanda_buffet',
          label: `Comanda ${c.number}`,
          totalAmount: c.total_amount ?? 0,
          arrivalAt: c.opened_at,
          exitAt: c.closed_at ?? c.opened_at,
          paymentMethods: t('cashier.closed'),
          comandaBuffet: {
            number: c.number,
            items: (c.comanda_items ?? []).map((i: any) => ({
              description: i.description,
              quantity: i.quantity,
              total_price: i.total_price,
            })),
          },
        });
      });

      items.sort((a, b) => new Date(b.exitAt).getTime() - new Date(a.exitAt).getTime());
      setCompletedList(items);
    } catch (e) {
      console.error(e);
      toast({ title: t('cashier.errorLoadCompleted'), variant: 'destructive' });
    }
  }, [restaurantId, hasTables, hasBuffet, todayStart, t]);

  const loadQueueRef = useRef(loadQueue);
  loadQueueRef.current = loadQueue;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLoadQueue = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      loadQueueRef.current(false);
    }, 500);
  }, []);

  useEffect(() => {
    loadQueue(true);
  }, [loadQueue]);

  useEffect(() => {
    if (mainView === 'cashier') loadCompletedToday();
  }, [mainView, loadCompletedToday]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`cashier-queue-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'virtual_comandas',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        debouncedLoadQueue
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comandas',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        debouncedLoadQueue
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        debouncedLoadQueue
      )
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(ch);
      setIsLive(false);
    };
  }, [restaurantId, debouncedLoadQueue]);

  useEffect(() => {
    if (!restaurantId || isLive) return;
    const t = setInterval(() => loadQueueRef.current(false), 15000);
    return () => clearInterval(t);
  }, [restaurantId, isLive]);

  const selectItem = useCallback(
    (item: CashierQueueItem) => {
      if (selected?.id === item.id) return;
      setScanError(null);
      setSelected(item);
      const total = getDisplayTotal(item.totalAmount, item.type === 'comanda_digital' ? item.items : item.type === 'comanda_buffet' ? item.items : undefined);
      const id = `pay-${Date.now()}`;
      const displayVal = convertPriceFromStorage(total, baseCurrency);
      setPayments([{ id, method: 'cash', currency: baseCurrency, amount: total, displayValue: displayVal }]);
      setPaymentInputs({ [id]: displayVal });
    },
    [selected?.id, baseCurrency]
  );

  const handleScanSubmit = useCallback(() => {
    const value = scanInput.trim().toUpperCase();
    if (!value) return;

    if (mainView === 'cashier') {
      setScanInput('');
      if (SCANNER_PATTERN.test(value)) {
        const found = queue.find(
          (q): q is QueueItemComandaDigital => q.type === 'comanda_digital' && q.shortCode === value
        );
        if (found) {
          selectItem(found);
        } else {
          setScanError(t('cashier.comandaNotFound', { code: value }));
        }
        return;
      }
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        const tableFound = queue.find(
          (q): q is QueueItemTable => q.type === 'table' && q.tableNumber === num
        );
        if (tableFound) {
          selectItem(tableFound);
          return;
        }
        const bufFound = queue.find(
          (q): q is QueueItemComandaBuffet => q.type === 'comanda_buffet' && q.number === num
        );
        if (bufFound) {
          selectItem(bufFound);
          return;
        }
        setScanError(t('cashier.tableOrComandaNotFound', { num }));
      } else {
        setScanError(t('cashier.invalidFormat'));
      }
    }
  }, [scanInput, queue, mainView, selectItem, t]);

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleScanSubmit();
  };

  const totalToPay = selected ? getDisplayTotal(selected.totalAmount, selected.type === 'comanda_digital' ? selected.items : selected.type === 'comanda_buffet' ? selected.items : undefined) : 0;

  const totalReceivedBRL = useMemo(() => {
    let sum = 0;
    payments.forEach((p) => {
      const val = p.amount;
      const inBRL = convertBetweenCurrencies(val, p.currency, 'BRL', exchangeRates);
      sum += inBRL / 100;
    });
    return sum * 100;
  }, [payments, exchangeRates]);

  const totalToPayBRL = baseCurrency === 'BRL' ? totalToPay : convertBetweenCurrencies(totalToPay, baseCurrency, 'BRL', exchangeRates);
  const remaining = totalToPayBRL - totalReceivedBRL;
  const changeAmount = remaining < 0 ? -remaining : 0;

  const totalToReceive = useMemo(() => {
    return queue.reduce((sum, q) => sum + getDisplayTotal(q.totalAmount, q.type === 'comanda_digital' ? q.items : q.type === 'comanda_buffet' ? q.items : undefined), 0);
  }, [queue]);

  const totalReceivedToday = useMemo(() => {
    return completedList.reduce((sum, c) => sum + c.totalAmount, 0);
  }, [completedList]);

  const queueGroupedByZone = useMemo(() => {
    const groups: { zoneName: string; items: CashierQueueItem[] }[] = [];
    const tableItems = queue.filter((q): q is QueueItemTable => q.type === 'table');
    const nonTableItems = queue.filter((q) => q.type !== 'table');
    for (const z of hallZones) {
      const items = tableItems.filter((t) => t.hallZoneId === z.id);
      if (items.length > 0) groups.push({ zoneName: z.name, items });
    }
    const noZone = tableItems.filter((t) => !t.hallZoneId);
    if (noZone.length > 0) groups.push({ zoneName: t('cashier.noZone'), items: noZone });
    if (nonTableItems.length > 0) groups.push({ zoneName: t('cashier.standaloneComandas'), items: nonTableItems });
    if (groups.length === 0 && queue.length > 0) groups.push({ zoneName: t('cashier.all'), items: queue });
    return groups;
  }, [queue, hallZones, t]);

  const addPayment = () => {
    const id = `pay-${Date.now()}`;
    setPayments((prev) => [...prev, { id, method: 'cash' as PaymentMethod, currency: baseCurrency, amount: 0, displayValue: '' }]);
    setPaymentInputs((prev) => ({ ...prev, [id]: '' }));
  };

  const receivedInBase = useMemo(
    () => convertBetweenCurrencies(totalReceivedBRL, 'BRL', baseCurrency, exchangeRates),
    [totalReceivedBRL, baseCurrency, exchangeRates]
  );
  const remainingInBase = useMemo(
    () => convertBetweenCurrencies(Math.max(0, remaining), 'BRL', baseCurrency, exchangeRates),
    [remaining, baseCurrency, exchangeRates]
  );
  const changeInBase = useMemo(
    () => (changeAmount > 0 ? convertBetweenCurrencies(changeAmount, 'BRL', baseCurrency, exchangeRates) : 0),
    [changeAmount, baseCurrency, exchangeRates]
  );

  const updatePaymentAmount = (id: string, displayValue: string, curr: CurrencyCode) => {
    setPaymentInputs((prev) => ({ ...prev, [id]: displayValue }));
    const parsed = curr === 'PYG' ? parseFloat(displayValue.replace(/\./g, '').replace(',', '.')) || 0 : parseFloat(displayValue.replace(',', '.')) || 0;
    const amount = curr === 'PYG' ? Math.round(parsed) : Math.round(parsed * 100);
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, currency: curr, amount, displayValue } : p)));
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    setPaymentInputs((prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    }));
  };

  const canFinalize = totalReceivedBRL >= totalToPayBRL && totalToPayBRL > 0;

  const handleFinalize = async () => {
    if (!selected || closing || !canFinalize) return;
    setClosing(true);
    const primaryMethod = payments.length > 0 ? (payments[0].method as 'cash' | 'card' | 'pix') : 'cash';
    try {
      if (selected.type === 'comanda_digital') {
        const { error } = await supabase.rpc('cashier_complete_comanda', {
          p_comanda_id: selected.virtualComandaId,
          p_payment_method: primaryMethod,
        });
        if (error) throw error;
        const { data: fullOrder } = await supabase
          .from('orders')
          .select('*, order_items(*), delivery_zone:delivery_zones(*)')
          .eq('virtual_comanda_id', selected.virtualComandaId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (fullOrder && restaurant && restaurant.print_auto_on_new_order !== false) {
          printOrder(
            fullOrder as any,
            restaurant.name,
            (restaurant.print_paper_width as '58mm' | '80mm') || '80mm',
            currency,
            (restaurant.print_settings_by_sector as any) ?? undefined
          );
        }
        toast({ title: t('cashier.comandaClosed'), description: `${selected.shortCode} — ${formatCurrency(totalToPay, currency)}` });
      } else if (selected.type === 'comanda_buffet') {
        await supabase
          .from('comandas')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', selected.comandaId);
        toast({ title: t('cashier.buffetClosed'), description: `#${selected.number} — ${formatCurrency(totalToPay, currency)}` });
      } else if (selected.type === 'table') {
        await supabase
          .from('orders')
          .update({ status: 'completed', is_paid: true, payment_method: primaryMethod })
          .eq('id', selected.orderId);
        const fullOrder = { ...selected.order, status: 'completed', is_paid: true };
        if (restaurant && restaurant.print_auto_on_new_order !== false) {
          printOrder(
            fullOrder as any,
            restaurant.name,
            (restaurant.print_paper_width as '58mm' | '80mm') || '80mm',
            currency,
            (restaurant.print_settings_by_sector as any) ?? undefined
          );
        }
        toast({ title: t('cashier.orderPaid'), description: `${selected.tableNumber} — ${formatCurrency(totalToPay, currency)}` });
      }

      setSelected(null);
      setPayments([]);
      setPaymentInputs({});
      setJustClosed(true);
      loadQueue();
      loadCompletedToday();
      scannerRef.current?.focus();
    } catch (err: any) {
      toast({ title: t('cashier.errorFinalize'), description: err?.message, variant: 'destructive' });
    } finally {
      setClosing(false);
    }
  };

  const handleClearSelection = () => {
    setSelected(null);
    setPayments([]);
    setPaymentInputs({});
    setScanError(null);
    scannerRef.current?.focus();
  };

  const itemsForDisplay =
    selected?.type === 'comanda_digital'
      ? selected.items.map((i) => ({ name: i.product_name, qty: i.quantity, price: i.total_price }))
      : selected?.type === 'comanda_buffet'
        ? selected.items.map((i) => ({ name: i.description, qty: i.quantity, price: i.total_price }))
        : selected?.type === 'table'
          ? (selected.order.order_items ?? []).map((i: any) => ({ name: i.product_name, qty: i.quantity, price: i.total_price }))
          : [];

  // Para mesa: agrupa por customer_name (João, Maria, Mesa Geral)
  const tableItemsGrouped =
    selected?.type === 'table' && (selected.order.order_items ?? []).length > 0
      ? (() => {
          const items = selected.order.order_items as Array<{ product_name: string; quantity: number; total_price: number; customer_name?: string | null }>;
          const map = new Map<string, { label: string; items: { name: string; qty: number; price: number }[]; subtotal: number }>();
          for (const i of items) {
            const key = (i.customer_name ?? '').trim() || '__mesa_geral__';
            const label = key === '__mesa_geral__' ? t('cashier.tableGeneral') : key;
            const row = { name: i.product_name, qty: i.quantity, price: Number(i.total_price) };
            const existing = map.get(key);
            if (existing) {
              existing.items.push(row);
              existing.subtotal += row.price;
            } else {
              map.set(key, { label, items: [row], subtotal: row.price });
            }
          }
          return Array.from(map.values()).sort((a, b) => (a.label === 'Mesa Geral' ? 1 : 0) - (b.label === 'Mesa Geral' ? 1 : 0) || a.label.localeCompare(b.label));
        })()
      : null;

  return (
    <div className="h-full flex flex-col">
      {comandaUrl && restaurant && (
        <QRModal
          open={showQRModal}
          onClose={() => setShowQRModal(false)}
          url={comandaUrl}
          restaurantName={restaurant.name}
          logo={restaurant.logo ?? null}
          t={t}
        />
      )}

      <div className="space-y-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('cashier.title')}</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {t('cashier.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
              <button
                onClick={() => setMainView('cashier')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mainView === 'cashier'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                {t('cashierCompleted.viewCashier')}
              </button>
              <button
                onClick={() => setMainView('completed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mainView === 'completed'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListChecks className="h-4 w-4" />
                {t('cashierCompleted.viewCompleted')}
              </button>
            </div>
            {mainView === 'cashier' && (
            <>
            {comandaUrl && (
              <Button variant="outline" size="sm" onClick={() => setShowQRModal(true)}>
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                {t('cashier.qrCode')}
              </Button>
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                isLive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800' : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {loadingList && queue.length === 0 ? '…' : queue.length} {t('cashier.open')}
            </div>
            <Button variant="ghost" size="icon" onClick={() => loadQueue(false)} title={t('cashier.refresh')}>
              <RefreshCw className={`h-4 w-4 ${loadingList && queue.length === 0 ? 'animate-spin' : ''}`} />
            </Button>
            </>
            )}
          </div>
        </div>
      {mainView === 'completed' && (
        <CashierCompletedView
          restaurantId={restaurantId}
          restaurantName={restaurant?.name ?? 'Restaurante'}
          currency={baseCurrency}
          hasTables={!!hasTables}
          hasBuffet={!!hasBuffet}
          onPrintOrder={(item) => {
            if (item.order) {
              printOrder(
                item.order as any,
                restaurant?.name ?? '',
                (restaurant?.print_paper_width as '58mm' | '80mm') || '80mm',
                baseCurrency
              );
              toast({ title: t('cashier.printSent'), variant: 'default' });
            }
          }}
          t={t}
          dateLocale={dateLocale}
        />
      )}
      {mainView === 'cashier' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('cashier.accountsOpen')}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{loadingList && queue.length === 0 ? '…' : queue.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('cashier.totalToReceive')}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {formatCurrency(totalToReceive, baseCurrency)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-5 shadow-sm ring-1 ring-emerald-500/5">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{t('cashier.totalReceivedToday')}</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
              {formatCurrency(totalReceivedToday, baseCurrency)}
            </p>
          </div>
        </div>
      )}
      </div>

      {mainView === 'cashier' && (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0">
        {/* COLUNA ESQUERDA: Busca + Fila */}
        <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-semibold">{t('cashier.scanTitle')}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {t('cashier.scanHint')}
                </p>
              </div>
            </div>
            <input
              ref={scannerRef}
              value={scanInput}
              onChange={(e) => {
                setScanInput(e.target.value);
                setScanError(null);
              }}
              onKeyDown={handleScanKeyDown}
              placeholder={t('cashier.scanPlaceholder')}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full h-14 px-4 rounded-xl border-2 border-input bg-background text-lg font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-[#F87116]/40 focus:border-[#F87116] transition-colors"
            />
            {scanError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {scanError}
              </div>
            )}
            {justClosed && !selected && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                {t('cashier.accountClosed')}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden flex-1 min-h-0 flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-sm font-semibold mb-2">
                {t('cashier.queueTitle')} — {t('cashier.waitingPayment')}
                {queue.length > 0 && (
                  <Badge className="ml-1.5 h-5 px-1.5 bg-[#F87116]/20 text-[#F87116] border-0">{queue.length}</Badge>
                )}
              </h2>
            </div>
            <div className="mt-0 flex-1 overflow-y-auto min-h-0 p-3">
                  {loadingList ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <LayoutGrid className="h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">{t('cashier.noOpenAccounts')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 p-1">
                      {queueGroupedByZone.map((group) => (
                        <div key={group.zoneName}>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1">{group.zoneName}</p>
                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <QueueCard
                                key={item.id}
                                item={item}
                                selected={selected?.id === item.id}
                                currency={currency}
                                onClick={() => selectItem(item)}
                              t={t}
                              dateLocale={dateLocale}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Terminal de Pagamento */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] rounded-2xl border-2 border-dashed border-muted bg-muted/10 gap-5 p-10 text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-base font-semibold text-muted-foreground">{t('cashier.noSelection')}</p>
              <p className="text-sm text-muted-foreground/70 max-w-xs">
                {t('cashier.selectHint')}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <span className="font-mono text-lg font-bold">{selected.label}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {selected.customerName || t('cashier.noName')}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {tableItemsGrouped ? (
                  tableItemsGrouped.map((group) => (
                    <div key={group.label} className="px-4 py-3 border-b border-border/60 last:border-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                        {group.label} — {formatCurrency(group.subtotal, currency)}
                      </p>
                      {group.items.map((it, i) => (
                        <div key={i} className="flex justify-between items-center text-sm py-0.5">
                          <span className="truncate flex-1">{Number(it.qty) % 1 === 0 ? `${it.qty}×` : it.qty} {it.name}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(Number(it.price), currency)}</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  itemsForDisplay.map((it, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm truncate flex-1">
                        {Number(it.qty) % 1 === 0 ? `${it.qty}×` : it.qty} {it.name}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(it.price), currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-4 bg-slate-50 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">{t('cashier.totalToPay')}</span>
                  <span className="text-2xl font-black tabular-nums">
                    {formatCurrency(totalToPay, currency)}
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('cashier.paymentMethod')}
                  </Label>
                  <Button variant="outline" size="sm" onClick={addPayment} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t('cashier.add')}
                  </Button>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {payments.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2 items-center flex-wrap p-2.5 rounded-xl bg-white dark:bg-slate-800/50 border border-border"
                      >
                        <select
                          value={p.method}
                          onChange={(e) => {
                            const m = e.target.value as PaymentMethod;
                            setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, method: m } : x)));
                          }}
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm w-[110px] font-medium"
                          title={t('cashier.paymentMethod')}
                        >
                          {(Object.entries(getPaymentLabels(t)) as [PaymentMethod, string][]).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <select
                          value={p.currency}
                          onChange={(e) => {
                            const c = e.target.value as CurrencyCode;
                            setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, currency: c } : x)));
                          }}
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm w-[72px] font-medium"
                          title="Moeda"
                        >
                          {paymentCurrencies.map((c) => (
                            <option key={c} value={c}>{getCurrencySymbol(c)}</option>
                          ))}
                        </select>
                        <Input
                          value={paymentInputs[p.id] ?? ''}
                          onChange={(e) => updatePaymentAmount(p.id, e.target.value, p.currency)}
                          placeholder={p.currency === 'PYG' ? '0' : '0,00'}
                          className="flex-1 min-w-[100px] font-mono h-9 text-base"
                          aria-label="Valor recebido"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removePayment(p.id)} className="h-9 w-9 shrink-0" title="Remover">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('cashier.received')}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(receivedInBase, baseCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('cashier.remaining')}</span>
                  <span
                    className={`font-bold tabular-nums ${
                      remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {formatCurrency(remainingInBase, baseCurrency)}
                  </span>
                </div>
                {changeAmount > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 p-3">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">{t('cashier.changeSuggested')}</p>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                      {formatCurrency(changeInBase, baseCurrency)}
                    </p>
                    {paymentCurrencies.length > 1 && paymentCurrencies.some((c) => c !== baseCurrency) && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        {t('cashier.changeOtherCurrencies')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 pt-1">
                {!canFinalize && payments.length > 0 && remaining > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 text-center">
                    {t('cashier.informValue')}
                  </p>
                )}
                <Button
                  className={`w-full h-14 text-base font-bold transition-all rounded-xl ${
                    canFinalize ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg' : ''
                  }`}
                  disabled={closing || !canFinalize}
                  onClick={handleFinalize}
                  variant={canFinalize ? 'default' : 'secondary'}
                >
                  {closing ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  {t('cashier.finalize')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <OrderReceipt data={receiptData} />
      <OrderReceipt data={secondReceiptData} className="receipt-print-area-secondary" />
    </div>
  );
}

export default function Cashier() {
  return (
    <FeatureGuard feature="feature_virtual_comanda">
      <CashierContent />
    </FeatureGuard>
  );
}
