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
import { useQueryClient } from '@tanstack/react-query';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { useRestaurant, useHallZones } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { supabase } from '@/lib/core/supabase';
import {
  getComandaPublicUrl,
  getWaiterTipForSector,
  type CurrencyCode,
  type WaiterTipSector,
} from '@/lib/core/utils';
import {
  convertBetweenCurrencies,
  formatPrice,
  getCurrencySymbol,
  convertPriceFromStorage,
  type ExchangeRates,
} from '@/lib/priceHelper';
import { AdminPageHeader, AdminPageLayout } from '@/components/admin/_shared';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { toast } from '@/hooks/shared/use-toast';
import { usePrinter } from '@/hooks/printer/usePrinter';
import { OrderReceipt } from '@/components/receipt/OrderReceipt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { format, formatDistanceToNow, startOfDay, endOfDay } from 'date-fns';
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
  Trash2,
  User,
  Clock,
  LayoutGrid,
  ShoppingBag,
  RefreshCw,
  ListChecks,
} from 'lucide-react';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { CashierCompletedView } from '@/components/cashier/CashierCompletedView';
import { useTables, useCancelVirtualComanda } from '@/hooks/queries';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { ROLES_CANCEL_ORDER } from '@/hooks/auth/useUserRole';

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

/** Dados da reserva quando a comanda é de uma reserva pendente */
interface ReservationInfo {
  id: string;
  customer_name: string;
  scheduled_at: string;
  late_tolerance_minutes: number;
  table_id: string;
  status: string;
}

interface QueueItemComandaDigital extends QueueItemBase {
  type: 'comanda_digital';
  virtualComandaId: string;
  shortCode: string;
  tableNumber: string | null;
  items: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; notes: string | null }[];
  /** Preenchido quando a comanda é de uma reserva (status pending/confirmed) */
  reservation?: ReservationInfo;
  /** IDs dos pedidos de mesa vinculados (reserva+mesa: paga comanda + marca orders) */
  linkedTableOrderIds?: string[];
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
  /** Se a mesa está vinculada a uma reserva (pending/confirmed/activated) para hoje */
  hasReservation?: boolean;
}

type CashierQueueItem = QueueItemComandaDigital | QueueItemComandaBuffet | QueueItemTable;

/** Agrupamento de pedidos da mesma mesa para exibir em um único card */
interface TableGroup {
  type: 'table_group';
  id: string;
  tableNumber: number;
  hallZoneId: string | null;
  zoneName: string;
  items: QueueItemTable[];
  label: string;
  customerName: string | null;
  totalAmount: number;
  createdAt: string;
  hasReservation?: boolean;
}

type CashierDisplayItem = CashierQueueItem | TableGroup;

function isTableGroup(x: CashierDisplayItem): x is TableGroup {
  return (x as TableGroup).type === 'table_group';
}

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

function getDisplayTotalWithWaiterTip(
  totalAmount: number,
  items: { total_price: number }[] | undefined,
  sector: WaiterTipSector,
  printSettings: import('@/types').PrintSettingsBySector | null | undefined
): number {
  const base = getDisplayTotal(totalAmount, items);
  const { amount } = getWaiterTipForSector(base, sector, printSettings);
  return base + amount;
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
      const scriptClose = '</script>';
      win.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR Comanda</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
        .card{text-align:center;max-width:320px}.logo{margin-bottom:8px}.title{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
        .name{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:20px}.qr{padding:12px;border:2px solid #f1f5f9;border-radius:16px;display:inline-block;margin-bottom:14px}
        .url{font-size:10px;color:#94a3b8;word-break:break-all;font-family:monospace;margin-bottom:14px}.hint{font-size:11px;color:#64748b;background:#f8fafc;padding:12px;border-radius:12px;line-height:1.5}
        </style></head><body><div class="card">${logoHtml}<p class="title">${t('cashier.scanToOpen')}</p>
        <p class="name">${restaurantName}</p><div class="qr"><img src="${qrPng}" width="280" height="280"/></div>
        <p class="url">${url}</p><p class="hint">${t('cashier.scanHintPrint')}</p></div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}${scriptClose}</body></html>`
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
  item: CashierDisplayItem;
  selected: boolean;
  currency: CurrencyCode;
  onClick: () => void;
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const total = isTableGroup(item)
    ? getDisplayTotal(item.totalAmount, undefined)
    : getDisplayTotal(
        item.totalAmount,
        item.type === 'comanda_digital'
          ? item.items
          : item.type === 'comanda_buffet'
            ? item.items
            : undefined
      );
  const badgeClass =
    isTableGroup(item) || item.type === 'table'
      ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
      : item.type === 'comanda_buffet'
        ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
        : item.type === 'comanda_digital' && (item as QueueItemComandaDigital).reservation
          ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';

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
            {item.type === 'comanda_digital' && (item as QueueItemComandaDigital).reservation ? (
              <>
                <Badge className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  {t('reservations.reserva')}
                </Badge>
                {(item as QueueItemComandaDigital).tableNumber && (
                  <Badge className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    {t('cashier.tagMesa')} {(item as QueueItemComandaDigital).tableNumber}
                  </Badge>
                )}
                <Badge className={`text-[10px] font-bold ${badgeClass} border`}>{(item as QueueItemComandaDigital).shortCode}</Badge>
              </>
            ) : (item.type === 'table' && (item as QueueItemTable).hasReservation) || (isTableGroup(item) && (item as TableGroup).hasReservation) ? (
              <>
                <Badge className="text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800">
                  {t('reservations.reserva')}
                </Badge>
                <Badge className={`text-[10px] font-bold ${badgeClass} border`}>{item.label}</Badge>
              </>
            ) : (
              <Badge className={`text-[10px] font-bold ${badgeClass} border`}>{item.label}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {item.customerName || t('cashier.noName')}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold text-foreground">{formatPrice(total, currency)}</p>
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
  const queryClient = useQueryClient();
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const { t, lang } = useAdminTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const dateLocale = DATE_LOCALES[lang] ?? ptBR;
  const scannerRef = useRef<HTMLInputElement>(null);
  const { data: restaurant } = useRestaurant(restaurantId);
  const { printOrder, receiptData, secondReceiptData, isPrinting } = usePrinter();
  const comandaUrl = restaurant?.slug ? getComandaPublicUrl(restaurant.slug) : null;

  const [showQRModal, setShowQRModal] = useState(false);
  const [queue, setQueue] = useState<CashierQueueItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [selected, setSelected] = useState<CashierDisplayItem | null>(null);
  const [closing, setClosing] = useState(false);
  const [justClosed, setJustClosed] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const scanBufferRef = useRef('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [reservationAction, setReservationAction] = useState<'idle' | 'activating' | 'cancelling' | null>(null);
  const [showRemoveComandaConfirm, setShowRemoveComandaConfirm] = useState(false);
  const [showExcludeOrderConfirm, setShowExcludeOrderConfirm] = useState(false);
  const [excludingOrder, setExcludingOrder] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [payPersonDialog, setPayPersonDialog] = useState<{
    customerKey: string;
    label: string;
    subtotal: number;
    method: PaymentMethod;
    currency: CurrencyCode;
  } | null>(null);
  const [payingPerson, setPayingPerson] = useState(false);
  const [finalizePaymentModal, setFinalizePaymentModal] = useState<{
    method: PaymentMethod;
    currency: CurrencyCode;
  } | null>(null);
  const [mainView, setMainView] = useState<'cashier' | 'completed'>('cashier');
  const [completedList, setCompletedList] = useState<CompletedItem[]>([]);

  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);
  const { data: hasTables } = useFeatureAccess('feature_tables', restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);
  useTables(restaurantId);
  const cancelComanda = useCancelVirtualComanda(restaurantId);

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
  const [, setPaymentInputs] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async (showLoading = false) => {
    if (!restaurantId) return;
    if (showLoading) setLoadingList(true);
    try {
      const items: CashierQueueItem[] = [];

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [vcRes, comandasRes, ordersRes, reservationsRes] = await Promise.all([
        supabase
          .from('virtual_comandas')
          .select(`
            id, short_code, customer_name, table_number, total_amount, created_at,
            virtual_comanda_items(id, product_name, quantity, unit_price, total_price, notes),
            reservations(id, customer_name, scheduled_at, late_tolerance_minutes, table_id, status)
          `)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'open')
          .order('created_at', { ascending: true }),
        hasBuffet
          ? supabase
              .from('comandas')
              .select('id, number, total_amount, opened_at, comanda_items(id, description, quantity, unit_price, total_price)')
              .eq('restaurant_id', restaurantId)
              .eq('status', 'open')
              .order('opened_at', { ascending: true })
          : { data: [] },
        hasTables
          ? supabase
              .from('orders')
              .select(`
                id, customer_name, total, created_at, table_id, bill_requested,
                delivery_type, order_source,
                order_items(id, product_name, quantity, unit_price, total_price, observations, customer_name, is_paid),
                tables(number, hall_zone_id)
              `)
              .eq('restaurant_id', restaurantId)
              .eq('is_paid', false)
              .neq('status', 'cancelled')
              .eq('order_source', 'table')
          : { data: [] },
        hasTables
          ? supabase
              .from('reservations')
              .select('id, table_id')
              .eq('restaurant_id', restaurantId)
              .in('status', ['pending', 'confirmed', 'activated'])
              .gte('scheduled_at', todayStart)
              .lte('scheduled_at', todayEnd)
          : { data: [] },
      ]);

      const vcData = (vcRes.data ?? []) as any[];
      const reservationsData = (reservationsRes?.data ?? []) as { table_id: string }[];
      const tableIdsWithReservation = new Set(reservationsData.map((r) => r.table_id).filter(Boolean));
      const ordersData = (ordersRes.data ?? []) as any[];
      const tableOrders = ordersData.filter(
        (o: any) => (o.order_source === 'table' || o.table_id) && o.order_source !== 'delivery' && o.delivery_type !== 'delivery'
      );

      const tableIdsConsumedByReservation = new Set<string>();

      vcData.forEach((vc) => {
        const resList = vc.reservations;
        const res = resList
          ? (Array.isArray(resList) ? resList[0] : resList)
          : null;
        // Não exibir no cashier comandas de reservas pending/confirmed — cliente ainda não chegou
        if (res && ['pending', 'confirmed'].includes(res.status)) return;
        // Comanda vinculada à reserva só aparece na fila do caixa no dia em que foi reservada
        if (res) {
          const scheduledDate = new Date(res.scheduled_at).toDateString();
          const today = new Date().toDateString();
          if (scheduledDate !== today) return;
        }
        const reservation = res && res.status === 'activated'
          ? { id: res.id, customer_name: res.customer_name, scheduled_at: res.scheduled_at, late_tolerance_minutes: res.late_tolerance_minutes ?? 15, table_id: res.table_id, status: res.status }
          : undefined;

        // Reserva/comanda só aparece na fila após: (a) usuário confirmar pedido no cardápio, ou (b) garçom acionar enviar conta
        if (reservation) {
          const hasItems = ((vc.virtual_comanda_items ?? []).length > 0) || ((vc.total_amount ?? 0) > 0);
          const tableId = reservation.table_id;
          const billRequested = tableId
            ? tableOrders.some((o: any) => o.table_id === tableId && o.bill_requested === true)
            : false;
          if (!hasItems && !billRequested) return;
        }

        const vcItems = (vc.virtual_comanda_items ?? []).map((i: any) => ({
          id: i.id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
          notes: i.notes,
        }));

        let label: string;
        let customerName: string | null;
        let tableNumber: string | null = vc.table_number;
        let totalAmount = vc.total_amount ?? 0;
        const mergedItems = [...vcItems];
        let linkedTableOrderIds: string[] | undefined;

        if (reservation?.table_id) {
          const matchingTableOrders = tableOrders.filter((o: any) => o.table_id === reservation.table_id);
          if (matchingTableOrders.length > 0) {
            linkedTableOrderIds = matchingTableOrders.map((o: any) => o.id);
            matchingTableOrders.forEach((o: any) => {
              tableIdsConsumedByReservation.add(o.id);
              totalAmount += o.total ?? 0;
              const t = o.tables;
              if (t?.number != null) tableNumber = String(t.number);
              (o.order_items ?? []).forEach((i: any) => {
                mergedItems.push({
                  id: i.id,
                  product_name: i.product_name,
                  quantity: i.quantity,
                  unit_price: i.unit_price ?? 0,
                  total_price: i.total_price ?? 0,
                  notes: i.observations ?? null,
                });
              });
            });
            label = tRef.current('reservations.reserva');
            customerName = reservation.customer_name || vc.customer_name;
          } else {
            label = `${tRef.current('reservations.reserva')} · ${vc.short_code}`;
            customerName = reservation.customer_name || vc.customer_name;
          }
        } else {
          label = reservation ? `${vc.short_code} · ${tRef.current('reservations.reserva')}` : vc.short_code;
          customerName = reservation?.customer_name ?? vc.customer_name;
        }

        items.push({
          id: `vc-${vc.id}`,
          type: 'comanda_digital',
          label,
          customerName,
          totalAmount,
          createdAt: vc.created_at,
          virtualComandaId: vc.id,
          shortCode: vc.short_code,
          tableNumber,
          items: mergedItems,
          reservation,
          linkedTableOrderIds,
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

      tableOrders.forEach((o: any) => {
        if (tableIdsConsumedByReservation.has(o.id)) return;
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
          hasReservation: o.table_id ? tableIdsWithReservation.has(o.table_id) : false,
        });
      });

      setQueue(items);
    } catch (e) {
      console.error(e);
      toast({ title: tRef.current('cashier.errorLoadQueue'), variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [restaurantId, hasBuffet, hasTables]);

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);

  const loadCompletedToday = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const items: CompletedItem[] = [];
      const labels = getPaymentLabels(tRef.current);
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
          paymentMethods: tRef.current('cashier.closed'),
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
      toast({ title: tRef.current('cashier.errorLoadCompleted'), variant: 'destructive' });
    }
  }, [restaurantId, hasTables, hasBuffet, todayStart]);

  const loadQueueRef = useRef(loadQueue);
  loadQueueRef.current = loadQueue;
  const loadCompletedRef = useRef(loadCompletedToday);
  loadCompletedRef.current = loadCompletedToday;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefreshCashier = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      loadQueueRef.current(false);
      loadCompletedRef.current();
    }, 500);
  }, []);

  useEffect(() => {
    loadQueue(true);
  }, [loadQueue]);

  useEffect(() => {
    if (mainView === 'completed') loadCompletedToday();
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
        debouncedRefreshCashier
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comandas',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        debouncedRefreshCashier
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        debouncedRefreshCashier
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        debouncedRefreshCashier
      )
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(ch);
      setIsLive(false);
    };
  }, [restaurantId, debouncedRefreshCashier, queryClient]);

  useEffect(() => {
    if (!restaurantId || isLive) return;
    const t = setInterval(() => loadQueueRef.current(false), 15000);
    return () => clearInterval(t);
  }, [restaurantId, isLive]);

  const selectItem = useCallback(
    (item: CashierDisplayItem) => {
      if (selected?.id === item.id) return;
      setScanError(null);
      setSelected(item);
      const total = isTableGroup(item)
        ? getDisplayTotal(item.totalAmount, undefined)
        : getDisplayTotal(item.totalAmount, item.type === 'comanda_digital' ? item.items : item.type === 'comanda_buffet' ? item.items : undefined);
      const id = `pay-${Date.now()}`;
      const displayVal = convertPriceFromStorage(total, baseCurrency);
      setPayments([{ id, method: 'cash', currency: baseCurrency, amount: total, displayValue: displayVal }]);
      setPaymentInputs({ [id]: displayVal });
    },
    [selected?.id, baseCurrency]
  );

  const queueGroupedByZone = useMemo(() => {
    const groups: { zoneName: string; items: CashierDisplayItem[] }[] = [];
    const tableItems = queue.filter((q): q is QueueItemTable => q.type === 'table');
    const nonTableItems = queue.filter((q) => q.type !== 'table') as CashierDisplayItem[];

    const groupTableItemsByTable = (items: QueueItemTable[], zoneName: string): CashierDisplayItem[] => {
      const byTable = new Map<string, QueueItemTable[]>();
      for (const t of items) {
        const key = `${t.hallZoneId ?? ''}::${t.tableNumber}`;
        const arr = byTable.get(key) ?? [];
        arr.push(t);
        byTable.set(key, arr);
      }
      const result: CashierDisplayItem[] = [];
      for (const arr of byTable.values()) {
        if (arr.length === 1) {
          result.push(arr[0]);
        } else {
          const first = arr[0];
          const totalAmount = arr.reduce((s, x) => s + x.totalAmount, 0);
          const oldest = arr.reduce((a, b) => (new Date(a.createdAt) < new Date(b.createdAt) ? a : b));
          const customerLabel = arr.length > 1 ? `${arr.length} pedidos` : (first.customerName || null);
          result.push({
            type: 'table_group',
            id: `table-group-${first.hallZoneId ?? 'none'}-${first.tableNumber}`,
            tableNumber: first.tableNumber,
            hallZoneId: first.hallZoneId,
            zoneName,
            items: arr,
            label: first.label,
            customerName: customerLabel,
            totalAmount,
            createdAt: oldest.createdAt,
            hasReservation: arr.some((i) => i.hasReservation),
          });
        }
      }
      return result;
    };

    for (const z of hallZones) {
      const items = tableItems.filter((t) => t.hallZoneId === z.id);
      if (items.length > 0) {
        const displayItems = groupTableItemsByTable(items, z.name);
        groups.push({ zoneName: z.name, items: displayItems });
      }
    }
    const noZone = tableItems.filter((t) => !t.hallZoneId);
    if (noZone.length > 0) {
      const displayItems = groupTableItemsByTable(noZone, t('cashier.noZone'));
      groups.push({ zoneName: t('cashier.noZone'), items: displayItems });
    }
    if (nonTableItems.length > 0) groups.push({ zoneName: t('cashier.standaloneComandas'), items: nonTableItems });
    if (groups.length === 0 && queue.length > 0) {
      const displayItems = groupTableItemsByTable(tableItems, t('cashier.all'));
      groups.push({ zoneName: t('cashier.all'), items: [...displayItems, ...nonTableItems] });
    }
    return groups;
  }, [queue, hallZones, t]);

  const processScanValue = useCallback((value: string) => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    setScanError(null);
    if (mainView !== 'cashier') return;
    if (SCANNER_PATTERN.test(v)) {
      const found = queue.find(
        (q): q is QueueItemComandaDigital => q.type === 'comanda_digital' && q.shortCode === v
      );
      if (found) {
        selectItem(found);
      } else {
        setScanError(t('cashier.comandaNotFound', { code: v }));
      }
      return;
    }
    const num = parseInt(v, 10);
    if (!isNaN(num)) {
      for (const group of queueGroupedByZone) {
        const found = group.items.find((i) => {
          if (isTableGroup(i)) return i.tableNumber === num;
          if (i.type === 'table') return i.tableNumber === num;
          if (i.type === 'comanda_digital' && i.tableNumber) return String(i.tableNumber) === String(num);
          return false;
        });
        if (found) {
          selectItem(found);
          return;
        }
      }
      const bufFound = queue.find(
        (q): q is QueueItemComandaBuffet => q.type === 'comanda_buffet' && q.number === num
      );
      if (bufFound) {
        selectItem(bufFound);
        return;
      }
      setScanError(t('cashier.tableOrComandaNotFound', { num: String(num) }));
    } else {
      setScanError(t('cashier.invalidFormat'));
    }
  }, [queue, queueGroupedByZone, mainView, selectItem, t]);

  const handleScanSubmit = useCallback(() => {
    const value = scanBufferRef.current.trim() || scanInput.trim();
    if (value) {
      scanBufferRef.current = '';
      setScanInput('');
      processScanValue(value);
    }
  }, [scanInput, processScanValue]);

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanSubmit();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      scanBufferRef.current += e.key;
    }
  };

  const printSettings = (restaurant as { print_settings_by_sector?: import('@/types').PrintSettingsBySector })?.print_settings_by_sector;
  const getSector = (item: CashierDisplayItem): WaiterTipSector =>
    item.type === 'comanda_buffet' ? 'buffet' : 'table';

  // Para mesa: agrupa por customer_name (João, Maria, Mesa Geral). Filtra itens NÃO pagos (is_paid).
  type TableGroupItem = { id: string; orderId: string; name: string; qty: number; price: number };
  type TableGroupWithKey = { customerKey: string; label: string; items: TableGroupItem[]; subtotal: number };
  const tableItemsGroupedForPay = selected
    ? (() => {
        if (selected.type !== 'table' && !isTableGroup(selected)) return null;
        type OiRow = { id: string; order_id: string; product_name: string; quantity: number; total_price: number; customer_name?: string | null; is_paid?: boolean };
        let items: OiRow[] = [];
        if (isTableGroup(selected)) {
          items = selected.items.flatMap((o) =>
            (o.order.order_items ?? []).filter((oi: any) => !oi.is_paid).map((oi: any) => ({
              id: oi.id, order_id: o.order.id, product_name: oi.product_name, quantity: oi.quantity,
              total_price: oi.total_price, customer_name: oi.customer_name, is_paid: oi.is_paid,
            }))
          );
        } else {
          const o = (selected as QueueItemTable).order as { id: string; order_items?: any[] };
          items = (o.order_items ?? []).filter((oi: any) => !oi.is_paid).map((oi: any) => ({
            id: oi.id, order_id: o.id, product_name: oi.product_name, quantity: oi.quantity,
            total_price: oi.total_price, customer_name: oi.customer_name, is_paid: oi.is_paid,
          }));
        }
        if (items.length === 0) return null;
        const map = new Map<string, { customerKey: string; label: string; items: TableGroupItem[]; subtotal: number }>();
        for (const i of items) {
          const key = (i.customer_name ?? '').trim() || '__mesa_geral__';
          const label = key === '__mesa_geral__' ? t('cashier.tableGeneral') : key;
          const row: TableGroupItem = { id: i.id, orderId: i.order_id, name: i.product_name, qty: i.quantity, price: Number(i.total_price) };
          const ex = map.get(key);
          if (ex) {
            ex.items.push(row);
            ex.subtotal += row.price;
          } else {
            map.set(key, { customerKey: key, label, items: [row], subtotal: row.price });
          }
        }
        return Array.from(map.values()).sort((a, b) =>
          (a.label === t('cashier.tableGeneral') ? 1 : 0) - (b.label === t('cashier.tableGeneral') ? 1 : 0) || a.label.localeCompare(b.label)
        ) as TableGroupWithKey[];
      })()
    : null;

  const totalToPay = selected
    ? (() => {
        if (tableItemsGroupedForPay && (selected.type === 'table' || isTableGroup(selected))) {
          const unpaidTotal = tableItemsGroupedForPay.reduce((s, g) => s + g.subtotal, 0);
          const unpaidItems = tableItemsGroupedForPay.flatMap((g) => g.items.map((i) => ({ total_price: i.price })));
          return getDisplayTotalWithWaiterTip(unpaidTotal, unpaidItems.length ? unpaidItems : undefined, 'table', printSettings);
        }
        return isTableGroup(selected)
          ? getDisplayTotalWithWaiterTip(selected.totalAmount, undefined, 'table', printSettings)
          : getDisplayTotalWithWaiterTip(
              selected.totalAmount,
              selected.type === 'comanda_digital' ? selected.items : selected.type === 'comanda_buffet' ? selected.items : undefined,
              getSector(selected),
              printSettings
            );
      })()
    : 0;

  const totalToReceive = useMemo(() => {
    const ps = (restaurant as { print_settings_by_sector?: import('@/types').PrintSettingsBySector })?.print_settings_by_sector;
    const getSector = (q: CashierQueueItem): WaiterTipSector => q.type === 'comanda_buffet' ? 'buffet' : 'table';
    return queue.reduce((sum, q) => sum + getDisplayTotalWithWaiterTip(
      q.totalAmount,
      q.type === 'comanda_digital' ? q.items : q.type === 'comanda_buffet' ? q.items : undefined,
      getSector(q),
      ps
    ), 0);
  }, [queue, restaurant]);

  const totalReceivedToday = useMemo(() => {
    return completedList.reduce((sum, c) => sum + c.totalAmount, 0);
  }, [completedList]);

  const canOpenFinalizeModal = totalToPay > 0;

  const handleFinalize = async () => {
    if (!selected || closing) return;
    const primaryMethod = (finalizePaymentModal?.method ?? payments[0]?.method ?? 'cash') as 'cash' | 'card' | 'pix';
    const canProceed = totalToPay > 0;
    if (!canProceed) return;
    setFinalizePaymentModal(null);
    setClosing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const closedByUserId = user?.id ?? null;
    const orderUpdatePayload = (method: string) => {
      const payload: Record<string, unknown> = { status: 'completed', is_paid: true, payment_method: method };
      if (closedByUserId) payload.closed_by_user_id = closedByUserId;
      return payload;
    };
    const comandaUpdatePayload = () => {
      const payload: Record<string, unknown> = { status: 'closed', closed_at: new Date().toISOString() };
      if (closedByUserId) payload.closed_by_user_id = closedByUserId;
      return payload;
    };
    try {
      if (selected.type === 'comanda_digital') {
        const { error } = await supabase.rpc('cashier_complete_comanda', {
          p_comanda_id: selected.virtualComandaId,
          p_payment_method: primaryMethod,
        });
        if (error) throw error;
        if (selected.linkedTableOrderIds?.length) {
          await supabase
            .from('orders')
            .update(orderUpdatePayload(primaryMethod))
            .in('id', selected.linkedTableOrderIds);
        }
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
        if ((selected as QueueItemComandaDigital).reservation?.id) {
          await supabase.rpc('complete_reservation', { p_reservation_id: (selected as QueueItemComandaDigital).reservation!.id });
          queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
        }
        toast({ title: t('cashier.comandaClosed'), description: `${selected.shortCode} — ${formatPrice(totalToPay, currency)}` });
      } else if (selected.type === 'comanda_buffet') {
        await supabase
          .from('comandas')
          .update(comandaUpdatePayload())
          .eq('id', selected.comandaId);
        toast({ title: t('cashier.buffetClosed'), description: `#${selected.number} — ${formatPrice(totalToPay, currency)}` });
      } else if (isTableGroup(selected)) {
        for (const tbl of selected.items) {
          await supabase
            .from('orders')
            .update(orderUpdatePayload(primaryMethod))
            .eq('id', tbl.orderId);
          const fullOrder = { ...tbl.order, status: 'completed', is_paid: true };
          if (restaurant && restaurant.print_auto_on_new_order !== false) {
            printOrder(
              fullOrder as any,
              restaurant.name,
              (restaurant.print_paper_width as '58mm' | '80mm') || '80mm',
              currency,
              (restaurant.print_settings_by_sector as any) ?? undefined
            );
          }
        }
        const tableIds = [...new Set(selected.items.map((tbl) => (tbl.order as { table_id?: string })?.table_id).filter(Boolean))] as string[];
        for (const tid of tableIds) {
          await supabase.rpc('complete_reservation_for_table', { p_table_id: tid });
        }
        if (tableIds.length > 0) {
          queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
        }
        toast({ title: t('cashier.orderPaid'), description: `${selected.label} — ${formatPrice(totalToPay, currency)}` });
      } else if (selected.type === 'table') {
        await supabase
          .from('orders')
          .update(orderUpdatePayload(primaryMethod))
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
        const tableId = (selected.order as { table_id?: string })?.table_id;
        if (tableId) {
          await supabase.rpc('complete_reservation_for_table', { p_table_id: tableId });
          queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
        }
        toast({ title: t('cashier.orderPaid'), description: `${selected.tableNumber} — ${formatPrice(totalToPay, currency)}` });
      }

      setSelected(null);
      setPayments([]);
      setPaymentInputs({});
      setJustClosed(true);
      loadQueue();
      loadCompletedToday();
      queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['cashier-completed'] });
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
    setReservationAction(null);
    scannerRef.current?.focus();
  };

  const isSelectedReservation =
    selected?.type === 'comanda_digital' &&
    (selected as QueueItemComandaDigital).reservation &&
    totalToPay === 0;

  const handleActivateReservation = async () => {
    if (!selected || selected.type !== 'comanda_digital' || !(selected as QueueItemComandaDigital).reservation) return;
    const res = (selected as QueueItemComandaDigital).reservation!;
    setReservationAction('activating');
    try {
      await supabase.rpc('activate_reservation', { p_reservation_id: res.id });
      toast({ title: t('cashier.reservationActivated') });
      handleClearSelection();
      loadQueue();
    } catch (err: any) {
      toast({ title: t('cashier.errorActivateReservation'), description: err?.message, variant: 'destructive' });
    } finally {
      setReservationAction(null);
    }
  };

  const handleCancelReservation = async () => {
    if (!selected || selected.type !== 'comanda_digital' || !(selected as QueueItemComandaDigital).reservation) return;
    const res = (selected as QueueItemComandaDigital).reservation!;
    setReservationAction('cancelling');
    try {
      await supabase.rpc('cancel_reservation', { p_reservation_id: res.id });
      toast({ title: t('cashier.reservationCancelled') });
      handleClearSelection();
      loadQueue();
    } catch (err: any) {
      toast({ title: t('cashier.errorCancelReservation'), description: err?.message, variant: 'destructive' });
    } finally {
      setReservationAction(null);
    }
  };

  const handleRemoveComanda = async () => {
    if (!selected || selected.type !== 'comanda_digital' || cancelComanda.isPending) return;
    const item = selected as QueueItemComandaDigital;
    try {
      await cancelComanda.mutateAsync({
        comandaId: item.virtualComandaId,
        reservationId: item.reservation?.id ?? null,
        reservationStatus: item.reservation?.status ?? null,
      });
      setShowRemoveComandaConfirm(false);
      handleClearSelection();
      loadQueue();
      toast({ title: t('cashier.removeComandaSuccess') });
    } catch (err: any) {
      toast({ title: t('cashier.errorRemoveComanda'), description: err?.message, variant: 'destructive' });
    }
  };

  const handleExcludeTableOrder = async () => {
    if (!selected || excludingOrder || !restaurantId) return;
    const tableIds: string[] = [];
    if (isTableGroup(selected)) {
      const ids = selected.items
        .map((i) => (i.order as { table_id?: string })?.table_id)
        .filter((id): id is string => !!id);
      tableIds.push(...new Set(ids));
    } else if (selected.type === 'table') {
      const tid = (selected.order as { table_id?: string })?.table_id;
      if (tid) tableIds.push(tid);
    }
    if (tableIds.length === 0) return;
    setExcludingOrder(true);
    try {
      for (const tableId of tableIds) {
        const { error } = await supabase.rpc('reset_table', {
          p_restaurant_id: restaurantId,
          p_table_id: tableId,
        });
        if (error) throw error;
      }
      setShowExcludeOrderConfirm(false);
      handleClearSelection();
      loadQueue();
      queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      toast({ title: t('cashier.excludeOrderSuccess') });
    } catch (err: any) {
      toast({ title: t('cashier.errorExcludeOrder'), description: err?.message, variant: 'destructive' });
    } finally {
      setExcludingOrder(false);
    }
  };

  const itemsForDisplay = (() => {
    if (!selected) return [];
    if (selected.type === 'comanda_digital') return selected.items.map((i) => ({ name: i.product_name, qty: i.quantity, price: i.total_price }));
    if (selected.type === 'comanda_buffet') return selected.items.map((i) => ({ name: i.description, qty: i.quantity, price: i.total_price }));
    if (isTableGroup(selected)) {
      return selected.items.flatMap((o) => (o.order.order_items ?? []).map((i: any) => ({ name: i.product_name, qty: i.quantity, price: i.total_price })));
    }
    if (selected.type === 'table') return (selected.order.order_items ?? []).map((i: any) => ({ name: i.product_name, qty: i.quantity, price: i.total_price }));
    return [];
  })();

  const tableItemsGrouped = tableItemsGroupedForPay;

  const handlePayCustomerPortion = async () => {
    if (!payPersonDialog || !selected || !restaurantId) return;
    const { customerKey } = payPersonDialog;
    const orderIds: string[] =
      selected.type === 'table'
        ? [selected.orderId]
        : isTableGroup(selected)
          ? selected.items.map((i) => i.order.id)
          : [];
    if (orderIds.length === 0) return;
    setPayingPerson(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const method = payPersonDialog.method ?? 'cash';
      const { error } = await supabase.rpc('cashier_pay_customer_portion', {
        p_order_ids: orderIds,
        p_customer_key: customerKey,
        p_payment_method: method,
        p_closed_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
      setPayPersonDialog(null);
      toast({ title: t('cashier.payPersonSuccess') });
      const stillUnpaid = tableItemsGrouped?.filter((g) => g.customerKey !== customerKey) ?? [];
      if (stillUnpaid.length === 0) {
        handleClearSelection();
      } else {
        setSelected((prev) => {
          if (!prev) return prev;
          const match = (cn: string | null) =>
            (customerKey === '__mesa_geral__' || !customerKey)
              ? !(cn ?? '').trim()
              : (cn ?? '').trim() === customerKey;
          if (prev.type === 'table') {
            const o = prev.order as { order_items?: any[] };
            const next = (o.order_items ?? []).map((oi: any) =>
              match(oi.customer_name) ? { ...oi, is_paid: true } : oi
            );
            return { ...prev, order: { ...o, order_items: next } } as CashierDisplayItem;
          }
          if (isTableGroup(prev)) {
            return {
              ...prev,
              items: prev.items.map((tbl) => {
                const o = tbl.order as { order_items?: any[] };
                const next = (o.order_items ?? []).map((oi: any) =>
                  match(oi.customer_name) ? { ...oi, is_paid: true } : oi
                );
                return { ...tbl, order: { ...o, order_items: next } };
              }),
              totalAmount: stillUnpaid.reduce((s, g) => s + g.subtotal, 0),
            } as CashierDisplayItem;
          }
          return prev;
        });
      }
      loadQueue();
      loadCompletedToday();
      queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
      queryClient.invalidateQueries({ queryKey: ['cashier-completed'] });
    } catch (err: any) {
      toast({ title: t('cashier.payPersonError'), description: err?.message, variant: 'destructive' });
    } finally {
      setPayingPerson(false);
    }
  };

  const handleRemoveOrderItem = async (orderId: string, orderItemId: string) => {
    if (!restaurantId || removingItemId) return;
    setRemovingItemId(orderItemId);
    try {
      const { error } = await supabase.rpc('cashier_remove_order_item', {
        p_order_id: orderId,
        p_order_item_id: orderItemId,
      });
      if (error) throw error;
      loadQueue();
      queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
      toast({ title: t('cashier.itemRemoved') });
      if (selected && (selected.type === 'table' || isTableGroup(selected))) {
        const nextSelected = refreshSelectedAfterItemRemoval(selected, orderId, orderItemId);
        if (nextSelected) setSelected(nextSelected);
        else handleClearSelection();
      }
    } catch (err: any) {
      toast({ title: t('cashier.errorRemoveItem'), description: err?.message, variant: 'destructive' });
    } finally {
      setRemovingItemId(null);
    }
  };

  function refreshSelectedAfterItemRemoval(
    current: CashierDisplayItem,
    orderId: string,
    orderItemId: string
  ): CashierDisplayItem | null {
    if (current.type === 'table') {
      const order = current.order as { id: string; order_items?: any[] };
      if (order.id !== orderId) return current;
      const nextItems = (order.order_items ?? []).filter((oi: any) => oi.id !== orderItemId);
      if (nextItems.length === 0) return null;
      return { ...current, order: { ...order, order_items: nextItems } } as CashierDisplayItem;
    }
    if (isTableGroup(current)) {
      const nextItems = current.items.map((q) => {
        if (q.order.id !== orderId) return q;
        const nextOi = (q.order.order_items ?? []).filter((oi: any) => oi.id !== orderItemId);
        return { ...q, order: { ...q.order, order_items: nextOi } };
      }).filter((q) => (q.order.order_items ?? []).length > 0);
      if (nextItems.length === 0) return null;
      const totalAmount = nextItems.reduce((s, q) => s + Number(q.order.total ?? 0), 0);
      return { ...current, items: nextItems, totalAmount } as CashierDisplayItem;
    }
    return current;
  }

  return (
    <AdminPageLayout className="h-full flex flex-col">
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

      <AdminPageHeader
        title={t('cashier.title')}
        description={t('cashier.subtitle')}
        icon={ScanBarcode}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 admin-card-border bg-muted/40 rounded-xl p-1">
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
        }
      />
      {mainView === 'completed' && (
        <CashierCompletedView
          restaurantId={restaurantId}
          restaurantName={restaurant?.name ?? 'Restaurante'}
          currency={baseCurrency}
          hasTables={!!hasTables}
          hasBuffet={!!hasBuffet}
          isPrintDisabled={isPrinting}
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
          <div className="admin-card-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('cashier.accountsOpen')}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{loadingList && queue.length === 0 ? '…' : queue.length}</p>
          </div>
          <div className="admin-card-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('cashier.totalToReceive')}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {formatPrice(totalToReceive, baseCurrency)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-5 shadow-sm ring-1 ring-emerald-500/5">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{t('cashier.totalReceivedToday')}</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
              {formatPrice(totalReceivedToday, baseCurrency)}
            </p>
          </div>
        </div>
      )}
      {mainView === 'cashier' && (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0">
        {/* COLUNA ESQUERDA: Busca + Fila */}
        <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
          <div className="admin-card-border bg-card p-5 space-y-3 flex-shrink-0 shadow-sm">
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

          <div className="admin-card-border bg-card overflow-hidden flex-1 min-h-0 flex flex-col shadow-sm">
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
            <div className="admin-card-border bg-card overflow-hidden shadow-sm">
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

              {isSelectedReservation ? (
                <div className="px-5 py-6 space-y-4">
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">{t('cashier.reservationTitle')}</h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200">{t('cashier.reservationDesc')}</p>
                    {selected.type === 'comanda_digital' && (selected as QueueItemComandaDigital).reservation && (
                      <div className="text-sm space-y-1 pt-2">
                        <p><strong>{(selected as QueueItemComandaDigital).reservation!.customer_name}</strong></p>
                        <p className="text-muted-foreground">
                          {format(new Date((selected as QueueItemComandaDigital).reservation!.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}
                        </p>
                        <p className="text-muted-foreground">
                          Mesa {selected.tableNumber} · Tolerância {(selected as QueueItemComandaDigital).reservation!.late_tolerance_minutes} min
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleActivateReservation}
                      disabled={!!reservationAction}
                    >
                      {reservationAction === 'activating' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      {t('cashier.activateReservation')}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleCancelReservation}
                      disabled={!!reservationAction}
                    >
                      {reservationAction === 'cancelling' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                      {t('cashier.cancelReservation')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {tableItemsGrouped ? (
                  tableItemsGrouped.map((group) => (
                    <div key={group.customerKey} className="px-4 py-3 border-b border-border/60 last:border-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {group.label} — {formatPrice(group.subtotal, currency)}
                        </p>
                        {tableItemsGrouped.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setPayPersonDialog({
                              customerKey: group.customerKey,
                              label: group.label,
                              subtotal: group.subtotal,
                              method: 'cash',
                              currency: baseCurrency,
                            })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t('cashier.payPerson')}
                          </Button>
                        )}
                      </div>
                      {group.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center gap-2 text-sm py-0.5 group/item">
                          <span className="truncate flex-1">{Number(it.qty) % 1 === 0 ? `${it.qty}×` : it.qty} {it.name}</span>
                          <span className="font-medium tabular-nums shrink-0">{formatPrice(Number(it.price), currency)}</span>
                          <RoleGuard allowedRoles={[...ROLES_CANCEL_ORDER]}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-0 group-hover/item:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleRemoveOrderItem(it.orderId, it.id); }}
                              disabled={!!removingItemId}
                              title={t('cashier.removeItem')}
                            >
                              {removingItemId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            </Button>
                          </RoleGuard>
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
                        {formatPrice(Number(it.price), currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-4 bg-slate-50 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">{t('cashier.totalToPay')}</span>
                  <span className="text-2xl font-black tabular-nums">
                    {formatPrice(totalToPay, currency)}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-5 pt-1">
                <Button
                  className={`w-full h-14 text-base font-bold transition-all rounded-xl ${
                    canOpenFinalizeModal ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg' : ''
                  }`}
                  disabled={closing || !canOpenFinalizeModal}
                  onClick={() => setFinalizePaymentModal({ method: 'cash', currency: baseCurrency })}
                  variant={canOpenFinalizeModal ? 'default' : 'secondary'}
                >
                  {closing ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  {t('cashier.finalize')}
                </Button>
                {selected.type === 'comanda_digital' && (
                  <RoleGuard allowedRoles={[...ROLES_CANCEL_ORDER]}>
                    <Button
                      variant="ghost"
                      className="w-full mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setShowRemoveComandaConfirm(true)}
                      disabled={cancelComanda.isPending || closing}
                    >
                      {cancelComanda.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      {t('cashier.removeComanda')}
                    </Button>
                  </RoleGuard>
                )}
                {(selected.type === 'table' || isTableGroup(selected)) && (
                  <RoleGuard allowedRoles={[...ROLES_CANCEL_ORDER]}>
                    <Button
                      variant="ghost"
                      className="w-full mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setShowExcludeOrderConfirm(true)}
                      disabled={excludingOrder || closing}
                    >
                      {excludingOrder ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      {t('cashier.excludeOrder')}
                    </Button>
                  </RoleGuard>
                )}
              </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <OrderReceipt data={receiptData} />
      {secondReceiptData && <OrderReceipt data={secondReceiptData} className="receipt-print-area-secondary" />}

      {/* Modal confirmação: Remover comanda da fila */}
      <Dialog open={showRemoveComandaConfirm} onOpenChange={setShowRemoveComandaConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cashier.removeComanda')}</DialogTitle>
            <DialogDescription>
              {selected?.type === 'comanda_digital' && (selected as QueueItemComandaDigital).items.length > 0
                ? t('cashier.removeComandaConfirmWithItems')
                : t('cashier.removeComandaConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowRemoveComandaConfirm(false)} disabled={cancelComanda.isPending}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRemoveComanda} disabled={cancelComanda.isPending}>
              {cancelComanda.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('cashier.removeComanda')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal pagar parte: forma de pagamento, moeda e valor */}
      <Dialog open={!!payPersonDialog} onOpenChange={(open) => !open && setPayPersonDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cashier.payPerson')}</DialogTitle>
            <DialogDescription>
              {payPersonDialog
                ? t('cashier.payPersonConfirm', {
                    name: payPersonDialog.label,
                    amount: formatPrice(payPersonDialog.subtotal, baseCurrency),
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          {payPersonDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('cashier.totalToPay')}
                </Label>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {formatPrice(
                    payPersonDialog.currency === baseCurrency
                      ? payPersonDialog.subtotal
                      : convertBetweenCurrencies(payPersonDialog.subtotal, baseCurrency, payPersonDialog.currency, exchangeRates),
                    payPersonDialog.currency
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('cashier.paymentMethod')}
                </Label>
                <select
                  value={payPersonDialog.method}
                  onChange={(e) =>
                    setPayPersonDialog((prev) =>
                      prev ? { ...prev, method: e.target.value as PaymentMethod } : null
                    )
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
                >
                  {(Object.entries(getPaymentLabels(t)) as [PaymentMethod, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('cashier.currencyLabel')}
                </Label>
                <select
                  value={payPersonDialog.currency}
                  onChange={(e) =>
                    setPayPersonDialog((prev) =>
                      prev ? { ...prev, currency: e.target.value as CurrencyCode } : null
                    )
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
                >
                  {paymentCurrencies.map((c) => (
                    <option key={c} value={c}>{getCurrencySymbol(c)} {c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayPersonDialog(null)} disabled={payingPerson}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handlePayCustomerPortion} disabled={payingPerson}>
              {payingPerson ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {t('cashier.payPerson')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal pagamento da conta geral: forma de pagamento, moeda e valor total (sem recibido/saldo restante) */}
      <Dialog open={!!finalizePaymentModal} onOpenChange={(open) => !open && setFinalizePaymentModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cashier.finalize')}</DialogTitle>
            <DialogDescription>
              {selected ? t('cashier.finalizeModalDesc', { label: selected.label }) : ''}
            </DialogDescription>
          </DialogHeader>
          {finalizePaymentModal && selected && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('cashier.totalToPay')}
                </Label>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {formatPrice(
                    finalizePaymentModal.currency === baseCurrency
                      ? totalToPay
                      : convertBetweenCurrencies(totalToPay, baseCurrency, finalizePaymentModal.currency, exchangeRates),
                    finalizePaymentModal.currency
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('cashier.paymentMethod')}
                </Label>
                <select
                  value={finalizePaymentModal.method}
                  onChange={(e) =>
                    setFinalizePaymentModal((prev) =>
                      prev ? { ...prev, method: e.target.value as PaymentMethod } : null
                    )
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
                >
                  {(Object.entries(getPaymentLabels(t)) as [PaymentMethod, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('cashier.currencyLabel')}
                </Label>
                <select
                  value={finalizePaymentModal.currency}
                  onChange={(e) =>
                    setFinalizePaymentModal((prev) =>
                      prev ? { ...prev, currency: e.target.value as CurrencyCode } : null
                    )
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
                >
                  {paymentCurrencies.map((c) => (
                    <option key={c} value={c}>{getCurrencySymbol(c)} {c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizePaymentModal(null)} disabled={closing}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleFinalize} disabled={closing}>
              {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {t('cashier.finalize')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal confirmação: Excluir pedido de mesa da fila */}
      <Dialog open={showExcludeOrderConfirm} onOpenChange={setShowExcludeOrderConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cashier.excludeOrder')}</DialogTitle>
            <DialogDescription>
              {selected && isTableGroup(selected) && selected.items.length > 1
                ? t('cashier.excludeOrderConfirmMultiple', { count: selected.items.length })
                : t('cashier.excludeOrderConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowExcludeOrderConfirm(false)} disabled={excludingOrder}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleExcludeTableOrder} disabled={excludingOrder}>
              {excludingOrder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('cashier.excludeOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageLayout>
  );
}

export default function Cashier() {
  return (
    <FeatureGuard feature="feature_virtual_comanda">
      <CashierContent />
    </FeatureGuard>
  );
}
