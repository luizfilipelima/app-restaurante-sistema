import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import {
  CheckCircle2,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  TrendingUp,
  Receipt,
  UtensilsCrossed,
  Phone,
  LayoutGrid,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import type {
  CashierCompletedItem,
  CashierCompletedDateRange,
} from '@/hooks/queries/useCashierCompletedOrders';
import { useCashierCompletedOrders } from '@/hooks/queries/useCashierCompletedOrders';

function getDateRangeOptions(t: (k: string) => string): { value: CashierCompletedDateRange; label: string }[] {
  return [
    { value: 'today', label: t('cashierCompleted.dateToday') },
    { value: '7d', label: t('cashierCompleted.date7d') },
    { value: '30d', label: t('cashierCompleted.date30d') },
  ];
}

function getTypeInfo(item: CashierCompletedItem): { label: string; icon: React.ReactNode } {
  if (item.type === 'table') return {
    label: 'Mesa',
    icon: <UtensilsCrossed className="h-3 w-3" />,
  };
  if (item.type === 'comanda_digital') return {
    label: 'Comanda Digital',
    icon: <LayoutGrid className="h-3 w-3" />,
  };
  return {
    label: 'Buffet',
    icon: <Scale className="h-3 w-3" />,
  };
}

function getItemsText(item: CashierCompletedItem): string {
  if (item.order?.order_items?.length) {
    return item.order.order_items
      .slice(0, 3)
      .map((i) => `${i.quantity}× ${i.product_name}`)
      .join('; ');
  }
  if (item.comandaBuffet?.items?.length) {
    return item.comandaBuffet.items
      .slice(0, 3)
      .map((i) => `${i.quantity}× ${i.description}`)
      .join('; ');
  }
  return '—';
}

function exportToCSV(
  items: CashierCompletedItem[],
  restaurantName: string,
  currency: CurrencyCode,
  t: (k: string) => string
) {
  const header = [
    t('cashierCompleted.colOrder'),
    t('cashierCompleted.colDate'),
    t('cashierCompleted.colTime'),
    t('cashierCompleted.colClient'),
    t('cashierCompleted.colPhone'),
    t('cashierCompleted.colAttendedBy'),
    t('cashierCompleted.colType'),
    t('cashierCompleted.colItems'),
    t('cashierCompleted.colPayment'),
    t('cashierCompleted.colTotal'),
  ];

  const rows = items.map((item) => {
    const date = new Date(item.exitAt);
    const typeInfo = getTypeInfo(item);
    return [
      item.label,
      format(date, 'dd/MM/yyyy'),
      format(date, 'HH:mm'),
      item.customerName ?? '—',
      item.customerPhone ?? '—',
      item.closedByEmail ?? '—',
      typeInfo.label,
      getItemsText(item),
      item.paymentMethods,
      formatPrice(item.totalAmount, currency).replace(/\u00a0/g, ' '),
    ];
  });

  const csvContent =
    '\uFEFF' +
    [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `caixa-concluidos-${restaurantName.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

interface CashierCompletedRowProps {
  item: CashierCompletedItem;
  currency: CurrencyCode;
  onPrint: (item: CashierCompletedItem) => void;
  t: (k: string) => string;
  dateLocale?: Locale;
}

function CashierCompletedRow({
  item,
  currency,
  onPrint,
  t,
  dateLocale,
}: CashierCompletedRowProps) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = getTypeInfo(item);
  const hasPrintableOrder = !!item.order;

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4">
          <span className="font-mono text-xs font-bold text-foreground">
            {item.label}
          </span>
        </td>
        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground font-medium">
              {format(new Date(item.exitAt), 'dd/MM/yyyy', { locale: dateLocale })}
            </span>
            <span>{format(new Date(item.exitAt), 'HH:mm')}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">
              {item.customerName ?? '—'}
            </p>
            {item.customerPhone && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3 flex-shrink-0" />
                {item.customerPhone}
              </p>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs text-muted-foreground truncate max-w-[140px] block" title={item.closedByEmail ?? undefined}>
            {item.closedByEmail ?? '—'}
          </span>
        </td>
        <td className="py-3 px-4">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              item.type === 'table'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : item.type === 'comanda_digital'
                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
            }`}
          >
            {typeInfo.icon}
            {typeInfo.label}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="text-xs text-muted-foreground max-w-[160px] truncate">
            {getItemsText(item)}
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {item.paymentMethods}
          </div>
        </td>
        <td className="py-3 px-4 text-right">
          <span className="text-sm font-bold text-foreground">
            {formatPrice(item.totalAmount, currency)}
          </span>
        </td>
        <td className="py-3 px-4">
          <div
            className="flex items-center gap-1 justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            {hasPrintableOrder && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => onPrint(item)}
                title={t('cashier.reprint')}
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            )}
            <button
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((x) => !x);
              }}
              title={expanded ? t('common.close') : t('cashierCompleted.viewDetails')}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-muted/20 border-b border-border/30">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {item.order?.order_items && item.order.order_items.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t('cashierCompleted.orderItems')}
                  </p>
                  <div className="space-y-1.5 rounded-lg border border-border/50 bg-background p-3">
                    {item.order.order_items.map((oi) => (
                      <div
                        key={oi.id}
                        className="flex justify-between gap-2 text-xs"
                      >
                        <span>
                          {oi.quantity}× {oi.product_name}
                          {oi.observations && (
                            <span className="text-muted-foreground ml-1">
                              ({oi.observations})
                            </span>
                          )}
                        </span>
                        <span className="font-semibold">
                          {formatPrice(Number(oi.total_price), currency)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{t('cashier.totalToPay')}</span>
                        <span>{formatPrice(Number(item.order.total), currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {item.comandaBuffet?.items && item.comandaBuffet.items.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t('cashierCompleted.buffetItems')}
                  </p>
                  <div className="space-y-1.5 rounded-lg border border-border/50 bg-background p-3">
                    {item.comandaBuffet.items.map((bi, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between gap-2 text-xs"
                      >
                        <span>
                          {bi.quantity}× {bi.description}
                        </span>
                        <span className="font-semibold">
                          {formatPrice(bi.total_price, currency)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{t('cashier.totalToPay')}</span>
                        <span>{formatPrice(item.totalAmount, currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">
                <p>
                  {t('cashier.arrival')}:{' '}
                  {format(new Date(item.arrivalAt), "dd/MM/yyyy HH:mm", {
                    locale: dateLocale,
                  })}
                </p>
                <p>
                  {t('cashier.exit')}:{' '}
                  {format(new Date(item.exitAt), "dd/MM/yyyy HH:mm", {
                    locale: dateLocale,
                  })}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export interface CashierCompletedViewProps {
  restaurantId: string | null;
  restaurantName: string;
  currency: CurrencyCode;
  hasTables?: boolean;
  hasBuffet?: boolean;
  onPrintOrder: (item: CashierCompletedItem) => void;
  t: (k: string) => string;
  dateLocale?: Locale;
}

export function CashierCompletedView({
  restaurantId,
  restaurantName,
  currency,
  hasTables = true,
  hasBuffet = false,
  onPrintOrder,
  t,
  dateLocale,
}: CashierCompletedViewProps) {
  const [dateRange, setDateRange] = useState<CashierCompletedDateRange>('today');
  const { data: items = [], isLoading } = useCashierCompletedOrders({
    restaurantId,
    dateRange,
    hasTables,
    hasBuffet,
  });

  const stats = useMemo(() => {
    const total = items.reduce((sum, i) => sum + i.totalAmount, 0);
    const avg = items.length > 0 ? total / items.length : 0;
    const buffetCount = items.filter((i) => i.type === 'comanda_buffet').length;
    return { count: items.length, total, avg, buffetCount };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {getDateRangeOptions(t).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                dateRange === opt.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start sm:self-auto"
          disabled={items.length === 0}
          onClick={() => exportToCSV(items, restaurantName, currency, t)}
        >
          <Download className="h-4 w-4" />
          {t('cashierCompleted.exportCsv')}
          {items.length > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
              {items.length}
            </span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: t('cashierCompleted.kpiCount'),
            value: isLoading ? '—' : String(stats.count),
            icon: <ShoppingBag className="h-4 w-4" />,
            color: 'from-green-400 to-emerald-600',
            bg: 'bg-green-50 dark:bg-green-950/30',
            border: 'border-green-100 dark:border-green-900/50',
          },
          {
            label: t('cashierCompleted.kpiRevenue'),
            value: isLoading ? '—' : formatPrice(stats.total, currency),
            icon: <TrendingUp className="h-4 w-4" />,
            color: 'from-blue-400 to-indigo-600',
            bg: 'bg-blue-50 dark:bg-blue-950/30',
            border: 'border-blue-100 dark:border-blue-900/50',
          },
          {
            label: t('cashierCompleted.kpiAvgTicket'),
            value: isLoading ? '—' : formatPrice(stats.avg, currency),
            icon: <Receipt className="h-4 w-4" />,
            color: 'from-purple-400 to-pink-600',
            bg: 'bg-purple-50 dark:bg-purple-950/30',
            border: 'border-purple-100 dark:border-purple-900/50',
          },
          {
            label: t('cashierCompleted.kpiBuffet'),
            value: isLoading ? '—' : String(stats.buffetCount),
            icon: <Scale className="h-4 w-4" />,
            color: 'from-orange-400 to-red-500',
            bg: 'bg-orange-50 dark:bg-orange-950/30',
            border: 'border-orange-100 dark:border-orange-900/50',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border ${card.border} ${card.bg} px-4 py-3 flex items-center gap-3`}
          >
            <div
              className={`h-8 w-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}
            >
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                {card.label}
              </p>
              <p className="text-base font-bold text-foreground leading-tight">
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {t('cashierCompleted.noOrders')}
            </p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              {t('cashierCompleted.noOrdersHint')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colOrder')}
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colDate')}
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colClient')}
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colAttendedBy')}
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colType')}
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colItems')}
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colPayment')}
                  </th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colTotal')}
                  </th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('cashierCompleted.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <CashierCompletedRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    onPrint={onPrintOrder}
                    t={t}
                    dateLocale={dateLocale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {items.length}{' '}
              {items.length === 1
                ? t('cashierCompleted.ordersInPeriodSing')
                : t('cashierCompleted.ordersInPeriodPlur')}
            </p>
            <p className="text-sm font-bold text-foreground">
              {t('cashierCompleted.total')}: {formatPrice(stats.total, currency)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
