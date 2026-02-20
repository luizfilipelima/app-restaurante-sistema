import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2, Download, Printer, ChevronDown, ChevronUp,
  ShoppingBag, TrendingUp, Receipt, Bike, UtensilsCrossed,
  Phone, MapPin, CreditCard, Clock, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import type { DatabaseOrder } from '@/types';
import type { CompletedOrdersDateRange } from '@/hooks/queries/useCompletedOrders';
import { useCompletedOrders } from '@/hooks/queries/useCompletedOrders';

const DATE_RANGE_OPTIONS: { value: CompletedOrdersDateRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
];

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  card: 'Cartão',
  cash: 'Dinheiro',
  table: 'Mesa',
  qrcode: 'QR Code',
  bank_transfer: 'Transferência',
};

function getOrderType(order: DatabaseOrder): { label: string; icon: React.ReactNode } {
  const isTable = order.order_source === 'table' || !!order.table_id;
  if (isTable) return {
    label: 'Mesa',
    icon: <UtensilsCrossed className="h-3 w-3" />,
  };
  if (order.delivery_type === 'delivery' || order.order_source === 'delivery') return {
    label: 'Delivery',
    icon: <Bike className="h-3 w-3" />,
  };
  return {
    label: 'Retirada',
    icon: <Package className="h-3 w-3" />,
  };
}

function exportToCSV(orders: DatabaseOrder[], restaurantName: string, currency: CurrencyCode) {
  const header = [
    'Pedido #',
    'Data',
    'Hora',
    'Cliente',
    'Telefone',
    'Tipo',
    'Zona / Endereço',
    'Itens',
    'Pagamento',
    'Subtotal',
    'Taxa de Entrega',
    'Total',
    'Observações',
  ];

  const rows = orders.map((order) => {
    const date = new Date(order.created_at);
    const isTable = order.order_source === 'table' || !!order.table_id;
    const type = isTable
      ? 'Mesa'
      : order.delivery_type === 'delivery'
        ? 'Delivery'
        : 'Retirada';
    const zone =
      order.delivery_zone?.location_name
        ? order.delivery_zone.location_name
        : order.delivery_address ?? '';
    const items = (order.order_items ?? [])
      .map((i) => `${i.quantity}x ${i.product_name}${i.observations ? ` (${i.observations})` : ''}`)
      .join('; ');
    const payment = isTable
      ? 'Mesa'
      : paymentMethodLabels[order.payment_method] ?? order.payment_method;

    const fmt = (v: number) => formatCurrency(v, currency).replace(/\u00a0/g, ' ');

    return [
      `#${order.id.slice(0, 8).toUpperCase()}`,
      format(date, 'dd/MM/yyyy'),
      format(date, 'HH:mm'),
      order.customer_name,
      order.customer_phone,
      type,
      zone,
      items,
      payment,
      fmt(Number(order.subtotal)),
      fmt(Number(order.delivery_fee ?? 0)),
      fmt(Number(order.total)),
      order.notes ?? '',
    ];
  });

  const csvContent =
    '\uFEFF' + // BOM for Excel UTF-8
    [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateLabel = format(new Date(), 'yyyy-MM-dd');
  link.download = `pedidos-concluidos-${restaurantName.replace(/\s+/g, '-').toLowerCase()}-${dateLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

interface OrderRowProps {
  order: DatabaseOrder;
  currency: CurrencyCode;
  onPrint: (order: DatabaseOrder) => void;
}

function OrderRow({ order, currency, onPrint }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const orderType = getOrderType(order);
  const isTable = order.order_source === 'table' || !!order.table_id;
  const payment = isTable
    ? 'Mesa'
    : paymentMethodLabels[order.payment_method] ?? order.payment_method;

  return (
    <>
      {/* Row principal */}
      <tr
        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* # */}
        <td className="py-3 px-4">
          <span className="font-mono text-xs font-bold text-foreground">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </td>
        {/* Data/Hora */}
        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground font-medium">
              {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {format(new Date(order.created_at), 'HH:mm')}
            </span>
          </div>
        </td>
        {/* Cliente */}
        <td className="py-3 px-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">
              {order.customer_name}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {order.customer_phone}
            </p>
          </div>
        </td>
        {/* Tipo */}
        <td className="py-3 px-4">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isTable
              ? 'bg-amber-100 text-amber-700'
              : order.delivery_type === 'delivery'
                ? 'bg-cyan-100 text-cyan-700'
                : 'bg-violet-100 text-violet-700'
          }`}>
            {orderType.icon}
            {orderType.label}
          </span>
        </td>
        {/* Itens */}
        <td className="py-3 px-4">
          <div className="text-xs text-muted-foreground max-w-[160px]">
            {(order.order_items ?? []).slice(0, 2).map((item) => (
              <div key={item.id} className="truncate">
                <span className="font-semibold text-foreground/70">{item.quantity}×</span>{' '}
                {item.product_name}
              </div>
            ))}
            {(order.order_items ?? []).length > 2 && (
              <span className="text-[11px] text-muted-foreground/70">
                +{(order.order_items ?? []).length - 2} item(s)
              </span>
            )}
          </div>
        </td>
        {/* Pagamento */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <CreditCard className="h-3 w-3 flex-shrink-0" />
            {payment}
          </div>
        </td>
        {/* Total */}
        <td className="py-3 px-4 text-right">
          <span className="text-sm font-bold text-foreground">
            {formatCurrency(Number(order.total), currency)}
          </span>
        </td>
        {/* Ações */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button" variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => onPrint(order)}
              title="Imprimir cupom"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <button
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
              title={expanded ? 'Recolher' : 'Ver detalhes'}
            >
              {expanded
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </button>
          </div>
        </td>
      </tr>

      {/* Row expandida com detalhes */}
      {expanded && (
        <tr className="bg-muted/20 border-b border-border/30">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Itens completos */}
              <div className="sm:col-span-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Itens do pedido
                </p>
                <div className="space-y-1.5 rounded-lg border border-border/50 bg-background p-3">
                  {(order.order_items ?? []).map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground flex-shrink-0 w-6 text-right">
                          {item.quantity}×
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-foreground">
                            {item.product_name}
                          </span>
                          {item.observations && (
                            <p className="text-[11px] text-muted-foreground">{item.observations}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground flex-shrink-0">
                        {formatCurrency(Number(item.total_price), currency)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                    {Number(order.delivery_fee) > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(Number(order.subtotal), currency)}</span>
                      </div>
                    )}
                    {Number(order.delivery_fee) > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Taxa de entrega</span>
                        <span>{formatCurrency(Number(order.delivery_fee), currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-foreground">
                      <span>Total</span>
                      <span>{formatCurrency(Number(order.total), currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalhes do cliente / entrega */}
              <div className="space-y-3">
                {(order.delivery_zone?.location_name || order.delivery_address) && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Entrega
                    </p>
                    <div className="flex items-start gap-2 text-xs text-foreground/80">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div>
                        {order.delivery_zone?.location_name && (
                          <p className="font-medium">{order.delivery_zone.location_name}</p>
                        )}
                        {order.delivery_address && (
                          <p className="text-muted-foreground">{order.delivery_address}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {order.notes && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Observações
                    </p>
                    <p className="text-xs text-foreground/80 bg-background rounded-lg border border-border/50 p-2">
                      {order.notes}
                    </p>
                  </div>
                )}

                {order.payment_method === 'cash' && order.payment_change_for && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Troco
                    </p>
                    <p className="text-xs text-foreground/80">
                      Para {formatCurrency(Number(order.payment_change_for), currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface CompletedOrdersViewProps {
  restaurantId: string | null;
  restaurantName: string;
  currency: CurrencyCode;
  onPrintOrder: (order: DatabaseOrder) => void;
}

export function CompletedOrdersView({
  restaurantId,
  restaurantName,
  currency,
  onPrintOrder,
}: CompletedOrdersViewProps) {
  const [dateRange, setDateRange] = useState<CompletedOrdersDateRange>('today');
  const { data: orders = [], isLoading } = useCompletedOrders({ restaurantId, dateRange });

  const stats = useMemo(() => {
    const total = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const avg = orders.length > 0 ? total / orders.length : 0;
    const deliveryCount = orders.filter(
      (o) => o.delivery_type === 'delivery' || o.order_source === 'delivery'
    ).length;
    return { count: orders.length, total, avg, deliveryCount };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Header com filtro e export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {DATE_RANGE_OPTIONS.map((opt) => (
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
          disabled={orders.length === 0}
          onClick={() => exportToCSV(orders, restaurantName, currency)}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
          {orders.length > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
              {orders.length}
            </span>
          )}
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Pedidos concluídos',
            value: isLoading ? '—' : String(stats.count),
            icon: <ShoppingBag className="h-4 w-4" />,
            color: 'from-green-400 to-emerald-600',
            bg: 'bg-green-50',
            border: 'border-green-100',
          },
          {
            label: 'Faturamento',
            value: isLoading ? '—' : formatCurrency(stats.total, currency),
            icon: <TrendingUp className="h-4 w-4" />,
            color: 'from-blue-400 to-indigo-600',
            bg: 'bg-blue-50',
            border: 'border-blue-100',
          },
          {
            label: 'Ticket médio',
            value: isLoading ? '—' : formatCurrency(stats.avg, currency),
            icon: <Receipt className="h-4 w-4" />,
            color: 'from-purple-400 to-pink-600',
            bg: 'bg-purple-50',
            border: 'border-purple-100',
          },
          {
            label: 'Deliveries',
            value: isLoading ? '—' : String(stats.deliveryCount),
            icon: <Bike className="h-4 w-4" />,
            color: 'from-orange-400 to-red-500',
            bg: 'bg-orange-50',
            border: 'border-orange-100',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border ${card.border} ${card.bg} px-4 py-3 flex items-center gap-3`}
          >
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">{card.label}</p>
              <p className="text-base font-bold text-foreground leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhum pedido concluído</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Os pedidos concluídos no período selecionado aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Pedido
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Data / Hora
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Itens
                  </th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Pagamento
                  </th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Total
                  </th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    currency={currency}
                    onPrint={onPrintOrder}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer com total */}
        {!isLoading && orders.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} no período
            </p>
            <p className="text-sm font-bold text-foreground">
              Total: {formatCurrency(stats.total, currency)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
