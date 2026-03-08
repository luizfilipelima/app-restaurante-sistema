/**
 * CashierDailyTab — Controle de caixa diário no Dashboard BI
 *
 * Permite abrir/fechar caixa com valor inicial e ver pedidos concluídos
 * (delivery, mesa, buffet, comanda) com tempo de preparo KDS.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Banknote,
  Clock,
  FileDown,
  Loader2,
  Receipt,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/shared/use-toast';
import { formatPrice, convertPriceToStorage, formatPriceInput, getCurrencySymbol } from '@/lib/priceHelper';
import type { CurrencyCode } from '@/lib/priceHelper';
import {
  useCashierSession,
  useOpenCashier,
  useCloseCashier,
} from '@/hooks/queries/useCashierSessions';
import { exportCashierDailyPDF } from '@/lib/cashier/cashier-daily-pdf';
import {
  useCashierDailyOrders,
  type CashierDailyPeriod,
  type CashierDailyOrderItem,
} from '@/hooks/queries/useCashierDailyOrders';
type TFunction = (key: string, vars?: Record<string, string | number>) => string;

const TAG_CONFIG: Record<string, { label: string; icon: typeof Store; className: string }> = {
  delivery: { label: 'Delivery', icon: Receipt, className: 'bg-cyan-100 text-cyan-800' },
  pickup: { label: 'Retirada', icon: Receipt, className: 'bg-violet-100 text-violet-800' },
  table: { label: 'Mesa', icon: UtensilsCrossed, className: 'bg-emerald-100 text-emerald-800' },
  buffet: { label: 'Buffet', icon: UtensilsCrossed, className: 'bg-amber-100 text-amber-800' },
  comanda: { label: 'Comanda', icon: Store, className: 'bg-blue-100 text-blue-800' },
};

export interface CashierDailyTabProps {
  restaurantId: string | null;
  restaurantName?: string;
  currency: CurrencyCode;
  hasTables?: boolean;
  hasBuffet?: boolean;
  t: TFunction;
}

export function CashierDailyTab({
  restaurantId,
  restaurantName = '',
  currency,
  hasTables = true,
  hasBuffet = true,
  t,
}: CashierDailyTabProps) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<CashierDailyPeriod>('today');
  const [customStartStr, setCustomStartStr] = useState('');
  const [customEndStr, setCustomEndStr] = useState('');

  const customStart = customStartStr ? new Date(customStartStr) : undefined;
  const customEnd = customEndStr ? new Date(customEndStr) : undefined;

  const today = new Date();
  const sessionDate = period === 'today' ? today : customStart ?? today;

  const { data: session, isLoading: loadingSession } = useCashierSession(
    restaurantId,
    sessionDate
  );

  const { data: ordersData, isLoading: loadingOrders } = useCashierDailyOrders({
    restaurantId,
    period,
    customStart,
    customEnd,
    hasTables,
    hasBuffet,
  });

  const openCashier = useOpenCashier(restaurantId);
  const closeCashier = useCloseCashier(restaurantId);

  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [openingAmountInput, setOpeningAmountInput] = useState('');
  const [closingAmountInput, setClosingAmountInput] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const expectedClosing =
    session && ordersData
      ? session.opening_amount + ordersData.totalRevenue
      : 0;

  const handleOpenCashier = async () => {
    const amount = convertPriceToStorage(openingAmountInput || '0', currency);
    if (!restaurantId) return;
    try {
      await openCashier.mutateAsync({
        restaurantId,
        openingAmount: amount,
        date: sessionDate,
      });
      toast({
        title: t('cashierDaily.openSuccess'),
      });
      setShowOpenDialog(false);
      setOpeningAmountInput('');
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message ?? 'Erro ao abrir caixa',
        variant: 'destructive',
      });
    }
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    try {
      const tagLabels: Record<string, string> = {
        delivery: t('cashierDaily.tagDelivery'),
        pickup: t('cashierDaily.tagPickup'),
        table: t('cashierDaily.tagTable'),
        buffet: t('cashierDaily.tagBuffet'),
        comanda: t('cashierDaily.tagComanda'),
      };
      exportCashierDailyPDF({
        restaurantName: restaurantName || 'Restaurante',
        periodLabel,
        currency,
        orders: ordersData?.orders ?? [],
        totalRevenue: ordersData?.totalRevenue ?? 0,
        totalOrders: ordersData?.totalOrders ?? 0,
        session: period === 'today' ? session ?? undefined : undefined,
        tagLabels,
        t: {
          title: t('cashierDaily.pdfTitle'),
          period: t('cashierDaily.period'),
          generatedAt: t('cashierDaily.pdfGeneratedAt'),
          summary: t('cashierDaily.pdfSummary'),
          totalOrders: t('cashierDaily.totalOrdersLabel'),
          totalSales: t('cashierDaily.totalSales'),
          openingAmount: t('cashierDaily.openingAmount'),
          expectedClosing: t('cashierDaily.expectedClosing'),
          ordersDetail: t('cashierDaily.pdfOrdersDetail'),
          date: t('cashierDaily.pdfDate'),
          tag: t('cashierDaily.pdfTag'),
          customer: t('cashierDaily.pdfCustomer'),
          items: t('cashierDaily.pdfItems'),
          qty: t('cashierDaily.pdfQty'),
          unitPrice: t('cashierDaily.pdfUnitPrice'),
          total: t('cashierDaily.totalLabel'),
          prepTime: t('cashierDaily.prepTime'),
          prepTimeMin: t('cashierDaily.prepTimeMin'),
          paymentMethod: t('cashierDaily.pdfPaymentMethod'),
          noOrders: t('cashierDaily.noOrders'),
        },
      });
      toast({ title: t('cashierDaily.pdfExportSuccess') });
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message ?? 'Erro ao exportar PDF',
        variant: 'destructive',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCloseCashier = async () => {
    const amount = convertPriceToStorage(
      closingAmountInput || String(expectedClosing),
      currency
    );
    if (!restaurantId) return;
    try {
      await closeCashier.mutateAsync({
        restaurantId,
        date: sessionDate,
        closingAmount: amount,
      });
      toast({
        title: t('cashierDaily.closeSuccess'),
      });
      setShowCloseDialog(false);
      setClosingAmountInput('');
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err?.message ?? 'Erro ao fechar caixa',
        variant: 'destructive',
      });
    }
  };

  const periodLabel =
    period === 'today'
      ? t('cashierDaily.today')
      : period === '7d'
        ? t('cashierDaily.last7days')
        : period === '30d'
          ? t('cashierDaily.last30days')
          : period === 'max'
            ? t('cashierDaily.maxPeriod')
            : customStartStr && customEndStr
              ? `${format(new Date(customStartStr), 'dd/MM/yyyy')} – ${format(new Date(customEndStr), 'dd/MM/yyyy')}`
              : t('cashierDaily.period');

  const canOpenClose = period === 'today';
  const isOpen = session && !session.closed_at;
  const isClosed = session?.closed_at;

  return (
    <div className="space-y-6">
      {/* Cabeçalho: período + abrir/fechar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as CashierDailyPeriod)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder={t('cashierDaily.period')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t('cashierDaily.today')}</SelectItem>
              <SelectItem value="7d">{t('cashierDaily.last7days')}</SelectItem>
              <SelectItem value="30d">{t('cashierDaily.last30days')}</SelectItem>
              <SelectItem value="max">{t('cashierDaily.maxPeriod')}</SelectItem>
              <SelectItem value="custom">{t('cashierDaily.customPeriod')}</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartStr}
                onChange={(e) => setCustomStartStr(e.target.value)}
                className="h-9 w-[140px]"
              />
              <span className="text-slate-400">–</span>
              <Input
                type="date"
                value={customEndStr}
                onChange={(e) => setCustomEndStr(e.target.value)}
                className="h-9 w-[140px]"
              />
            </div>
          )}
        </div>

        {canOpenClose && (
          <div className="flex gap-2">
            {!session && (
              <Button
                onClick={() => setShowOpenDialog(true)}
                disabled={loadingSession || openCashier.isPending}
              >
                {openCashier.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="h-4 w-4" />
                )}
                <span className="ml-2">{t('cashierDaily.openCashier')}</span>
              </Button>
            )}
            {isOpen && (
              <Button
                variant="default"
                onClick={() => {
                  setClosingAmountInput('');
                  setShowCloseDialog(true);
                }}
                disabled={closeCashier.isPending}
              >
                {closeCashier.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="h-4 w-4" />
                )}
                <span className="ml-2">{t('cashierDaily.closeCashier')}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Resumo financeiro (quando caixa aberto hoje) */}
      {canOpenClose && session && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-card p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t('cashierDaily.openingAmount')}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {formatPrice(session.opening_amount, currency)}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t('cashierDaily.totalSales')}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {formatPrice(ordersData?.totalRevenue ?? 0, currency)}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t('cashierDaily.expectedClosing')}
            </p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              {formatPrice(expectedClosing, currency)}
            </p>
          </div>
          <div className="admin-card p-4 flex items-center gap-2">
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {t('cashierDaily.caixaAberto')}
              </span>
            ) : isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                {t('cashierDaily.caixaFechado')}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Lista de pedidos */}
      <div className="admin-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500" />
            Pedidos concluídos · {periodLabel}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={loadingOrders || exportingPdf}
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span className="ml-2">{t('cashierDaily.exportPdf')}</span>
          </Button>
        </div>
        <div className="overflow-x-auto">
          {loadingOrders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : !ordersData?.orders?.length ? (
            <div className="py-12 text-center text-slate-500">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p>{t('cashierDaily.noOrders')}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Data/Hora</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tag</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">
                    {t('cashierDaily.prepTime')}
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordersData.orders.map((item) => (
                  <OrderRow key={item.id} item={item} currency={currency} t={t} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dialog Abrir Caixa */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cashierDaily.openCashier')}</DialogTitle>
            <DialogDescription>
              Informe o valor em caixa no início do expediente de hoje.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="opening-amount">{t('cashierDaily.openingAmount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  {getCurrencySymbol(currency)}
                </span>
                <Input
                  id="opening-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder={currency === 'BRL' ? '0,00' : currency === 'PYG' ? '0' : '0,00'}
                  className="pl-10"
                  value={openingAmountInput}
                  onChange={(e) => setOpeningAmountInput(formatPriceInput(e.target.value, currency))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleOpenCashier} disabled={openCashier.isPending}>
              {openCashier.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('cashierDaily.openCashier')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Fechar Caixa */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cashierDaily.closeCashier')}</DialogTitle>
            <DialogDescription>
              Confira o valor em caixa e informe o valor real ao fechar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-600">
                {t('cashierDaily.expectedClosing')}:{' '}
                <strong className="text-slate-900">
                  {formatPrice(expectedClosing, currency)}
                </strong>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing-amount">{t('cashierDaily.closingAmount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  {getCurrencySymbol(currency)}
                </span>
                <Input
                  id="closing-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder={formatPrice(expectedClosing, currency)}
                  className="pl-10"
                  value={closingAmountInput}
                  onChange={(e) => setClosingAmountInput(formatPriceInput(e.target.value, currency))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCloseCashier} disabled={closeCashier.isPending}>
              {closeCashier.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('cashierDaily.closeCashier')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderRow({
  item,
  currency,
  t,
}: {
  item: CashierDailyOrderItem;
  currency: CurrencyCode;
  t: TFunction;
}) {
  const cfg = TAG_CONFIG[item.tag] ?? TAG_CONFIG.comanda;
  const Icon = cfg.icon;
  const tagLabel =
    item.tag === 'delivery'
      ? t('cashierDaily.tagDelivery')
      : item.tag === 'pickup'
        ? t('cashierDaily.tagPickup')
        : item.tag === 'table'
          ? t('cashierDaily.tagTable')
          : item.tag === 'buffet'
            ? t('cashierDaily.tagBuffet')
            : t('cashierDaily.tagComanda');

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
        {format(new Date(item.closedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}
        >
          <Icon className="h-3 w-3" />
          {tagLabel}
          {item.tableNumber != null && ` ${item.tableNumber}`}
          {item.comandaNumber != null && ` #${item.comandaNumber}`}
        </span>
      </td>
      <td className="py-3 px-4 text-slate-700 truncate max-w-[140px]">
        {item.customerName ?? '—'}
      </td>
      <td className="py-3 px-4 text-slate-600 max-w-[200px]">
        <span className="truncate block" title={item.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}>
          {item.items.slice(0, 2).map((i) => `${i.quantity}x ${i.name}`).join(', ')}
          {item.items.length > 2 ? ` +${item.items.length - 2}` : ''}
        </span>
      </td>
      <td className="py-3 px-4">
        {item.prepTimeMinutes != null ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            {item.prepTimeMinutes} min
          </span>
        ) : (
          <span className="text-slate-400">{t('cashierDaily.prepTimeNA')}</span>
        )}
      </td>
      <td className="py-3 px-4 text-right font-medium text-slate-900">
        {formatPrice(item.total, currency)}
      </td>
    </tr>
  );
}
