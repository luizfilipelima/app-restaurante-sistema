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
import { useRestaurant } from '@/hooks/queries';
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
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  order: import('@/types').DatabaseOrder;
}

type CashierQueueItem = QueueItemComandaDigital | QueueItemComandaBuffet | QueueItemTable;

type PaymentMethod = 'cash' | 'card' | 'pix' | 'bank_transfer';
interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  currency: CurrencyCode;
  amount: number; // storage format
  displayValue: string;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'PIX',
  bank_transfer: 'Transferência',
};

const SCANNER_PATTERN = /^CMD-[A-Z0-9]{4}$/i;
const CURRENCIES: CurrencyCode[] = ['BRL', 'PYG', 'ARS', 'USD'];

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
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  restaurantName: string;
  logo: string | null;
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
        alert('Permita pop-ups para imprimir.');
        return;
      }
      win.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR Comanda</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
        .card{text-align:center;max-width:320px}.logo{margin-bottom:8px}.title{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
        .name{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:20px}.qr{padding:12px;border:2px solid #f1f5f9;border-radius:16px;display:inline-block;margin-bottom:14px}
        .url{font-size:10px;color:#94a3b8;word-break:break-all;font-family:monospace;margin-bottom:14px}.hint{font-size:11px;color:#64748b;background:#f8fafc;padding:12px;border-radius:12px;line-height:1.5}
        </style></head><body><div class="card">${logoHtml}<p class="title">Escaneie para abrir sua comanda</p>
        <p class="name">${restaurantName}</p><div class="qr"><img src="${qrPng}" width="280" height="280"/></div>
        <p class="url">${url}</p><p class="hint">Aponte a câmera do celular. Nenhum aplicativo necessário.</p></div>
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
      <DialogContent className="max-w-[380px] p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl bg-white">
        <div className="flex flex-col items-center gap-4 px-5 py-5">
          <DialogTitle className="text-sm font-bold text-slate-900">QR Code da Comanda</DialogTitle>
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
              Imprimir
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ScanBarcode className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
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
}: {
  item: CashierQueueItem;
  selected: boolean;
  currency: CurrencyCode;
  onClick: () => void;
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
      className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
        selected
          ? 'border-[#F87116] bg-orange-50/60'
          : 'border-border bg-card hover:border-slate-300 hover:shadow-sm'
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
              {item.customerName || 'Sem nome'}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold text-foreground">{formatCurrency(total, currency)}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end mt-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: false, locale: ptBR })}
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

  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);
  const { data: hasTables } = useFeatureAccess('feature_tables', restaurantId);

  const exchangeRates: ExchangeRates = restaurant?.exchange_rates ?? {
    pyg_per_brl: 3600,
    ars_per_brl: 1150,
    usd_per_brl: 0.18,
  };
  const baseCurrency: CurrencyCode = (restaurant?.currency as CurrencyCode) || 'BRL';

  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingList(true);
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
                order_items(id, product_name, quantity, unit_price, total_price, observations),
                tables(number)
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
          label: `Comanda ${c.number}`,
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
        const tableNum = o.tables?.number ?? o.table_id ?? '?';
        items.push({
          id: `ord-${o.id}`,
          type: 'table',
          label: `Mesa ${tableNum}`,
          customerName: o.customer_name,
          totalAmount: o.total ?? 0,
          createdAt: o.created_at,
          orderId: o.id,
          tableNumber: Number(tableNum),
          order: o,
        });
      });

      setQueue(items);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao carregar fila', variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [restaurantId, hasBuffet, hasTables]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

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
        loadQueue
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comandas',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        loadQueue
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        loadQueue
      )
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(ch);
      setIsLive(false);
    };
  }, [restaurantId, loadQueue]);

  useEffect(() => {
    if (!restaurantId || isLive) return;
    const t = setInterval(loadQueue, 8000);
    return () => clearInterval(t);
  }, [restaurantId, isLive, loadQueue]);

  const selectItem = useCallback(
    async (item: CashierQueueItem) => {
      if (selected?.id === item.id) return;
      setScanError(null);
      setSelected(item);
      setPayments([]);
      setPaymentInputs({});
    },
    [selected?.id]
  );

  const handleScanSubmit = useCallback(() => {
    const value = scanInput.trim().toUpperCase();
    setScanInput('');
    if (!value) return;

    if (SCANNER_PATTERN.test(value)) {
      const found = queue.find(
        (q): q is QueueItemComandaDigital => q.type === 'comanda_digital' && q.shortCode === value
      );
      if (found) {
        selectItem(found);
      } else {
        setScanError(`Comanda ${value} não encontrada ou já encerrada.`);
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
      setScanError(`Mesa ou Comanda #${num} não encontrada.`);
    } else {
      setScanError(`Formato inválido. Use CMD-XXXX, número da Mesa ou Comanda.`);
    }
  }, [scanInput, queue, selectItem]);

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

  const addPayment = () => {
    const id = `pay-${Date.now()}`;
    setPayments((prev) => [...prev, { id, method: 'cash' as PaymentMethod, currency: baseCurrency, amount: 0, displayValue: '' }]);
    setPaymentInputs((prev) => ({ ...prev, [id]: '' }));
  };

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
        toast({ title: 'Comanda encerrada!', description: `${selected.shortCode} — ${formatCurrency(totalToPay, currency)}` });
      } else if (selected.type === 'comanda_buffet') {
        await supabase
          .from('comandas')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', selected.comandaId);
        toast({ title: 'Comanda fechada!', description: `Comanda #${selected.number} — ${formatCurrency(totalToPay, currency)}` });
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
        toast({ title: 'Pedido pago!', description: `Mesa ${selected.tableNumber} — ${formatCurrency(totalToPay, currency)}` });
      }

      setSelected(null);
      setPayments([]);
      setPaymentInputs({});
      setJustClosed(true);
      loadQueue();
      scannerRef.current?.focus();
    } catch (err: any) {
      toast({ title: 'Erro ao encerrar', description: err?.message, variant: 'destructive' });
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
          ? (selected.order.order_items ?? []).map((i) => ({ name: i.product_name, qty: i.quantity, price: i.total_price }))
          : [];

  return (
    <div className="h-full flex flex-col">
      {comandaUrl && restaurant && (
        <QRModal
          open={showQRModal}
          onClose={() => setShowQRModal(false)}
          url={comandaUrl}
          restaurantName={restaurant.name}
          logo={restaurant.logo ?? null}
        />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa / PDV</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Hub central de pagamentos — Mesas, Comandas Digitais e Buffet
          </p>
        </div>
        <div className="flex items-center gap-2">
          {comandaUrl && (
            <Button variant="outline" size="sm" onClick={() => setShowQRModal(true)}>
              <QrCode className="h-3.5 w-3.5 mr-1.5" />
              QR Code
            </Button>
          )}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              isLive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {loadingList ? '…' : queue.length} em aberto
          </div>
          <Button variant="ghost" size="icon" onClick={loadQueue}>
            <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0">
        {/* COLUNA ESQUERDA: Busca + Fila */}
        <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-semibold">Mesa, Comanda ou CMD-XXXX</h2>
                <p className="text-[11px] text-muted-foreground">
                  Digite ou escaneie o código de barras
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
              placeholder="Ex: 12, 450, CMD-A7F2"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full h-14 px-4 rounded-xl border border-input bg-background text-lg font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 focus:border-[#F87116]"
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
                Conta encerrada. Aguardando próxima.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold">Fila do Caixa</h2>
              {queue.length > 0 && (
                <Badge className="bg-[#F87116]/10 text-[#F87116] border-0">{queue.length}</Badge>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingList ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <LayoutGrid className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhuma conta em aberto</p>
                </div>
              ) : (
                queue.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    selected={selected?.id === item.id}
                    currency={currency}
                    onClick={() => selectItem(item)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Terminal de Pagamento */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] rounded-xl border-2 border-dashed border-muted bg-muted/20 gap-4 p-8 text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-base font-semibold text-muted-foreground">Nenhuma conta selecionada</p>
              <p className="text-sm text-muted-foreground/70 max-w-xs">
                Selecione na fila ou escaneie Mesa/Comanda/CMD-XXXX
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <span className="font-mono text-lg font-bold">{selected.label}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {selected.customerName || 'Sem nome'}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="divide-y divide-border max-h-48 overflow-y-auto">
                {itemsForDisplay.map((it, i) => (
                  <div key={i} className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm truncate flex-1">
                      {Number(it.qty) % 1 === 0 ? `${it.qty}×` : it.qty} {it.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(it.price), currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 bg-slate-50 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Total a pagar</span>
                  <span className="text-2xl font-black tabular-nums">
                    {formatCurrency(totalToPay, currency)}
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    Pagamento múltiplo
                  </Label>
                  <Button variant="outline" size="sm" onClick={addPayment}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {payments.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2 items-center flex-wrap"
                      >
                        <select
                          value={p.method}
                          onChange={(e) => {
                            const m = e.target.value as PaymentMethod;
                            setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, method: m } : x)));
                          }}
                          className="h-9 rounded-lg border px-2 text-sm w-28"
                        >
                          {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <select
                          value={p.currency}
                          onChange={(e) => {
                            const c = e.target.value as CurrencyCode;
                            setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, currency: c } : x)));
                          }}
                          className="h-9 rounded-lg border px-2 text-sm w-20"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>{getCurrencySymbol(c)}</option>
                          ))}
                        </select>
                        <Input
                          value={paymentInputs[p.id] ?? ''}
                          onChange={(e) => updatePaymentAmount(p.id, e.target.value, p.currency)}
                          placeholder={p.currency === 'PYG' ? '0' : '0,00'}
                          className="flex-1 min-w-[100px] font-mono"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removePayment(p.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recebido</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(totalReceivedBRL, baseCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo restante</span>
                  <span
                    className={`font-bold tabular-nums ${
                      remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {formatCurrency(remaining, baseCurrency)}
                  </span>
                </div>
                {changeAmount > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Troco sugerido</p>
                    <p className="text-sm font-bold text-amber-900">
                      {formatCurrency(changeAmount, baseCurrency)}
                    </p>
                    {baseCurrency !== 'PYG' && (
                      <p className="text-xs text-amber-700 mt-0.5">
                        Ou {formatCurrency(convertBetweenCurrencies(changeAmount, 'BRL', 'PYG', exchangeRates), 'PYG')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 pb-5">
                <Button
                  className="w-full h-12 text-base font-bold"
                  disabled={closing || !canFinalize}
                  onClick={handleFinalize}
                >
                  {closing ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  Finalizar Pagamento e Encerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

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
