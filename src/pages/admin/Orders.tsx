import React, { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { DatabaseOrder, OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, Phone, MapPin, CreditCard, ChevronRight, Package, Truck, CheckCircle2, X, Loader2, Bike, Printer, UtensilsCrossed, MessageCircle, LayoutGrid, ListChecks } from 'lucide-react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { ROLES_CANCEL_ORDER } from '@/hooks/useUserRole';
import { useCouriers, useOrders, usePrintSettings } from '@/hooks/queries';
import { usePrinter } from '@/hooks/usePrinter';
import { OrderReceipt } from '@/components/receipt/OrderReceipt';
import { CompletedOrdersView } from '@/components/orders/CompletedOrdersView';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusConfig = {
  [OrderStatus.PENDING]: {
    label: 'Pendentes',
    icon: Clock,
    color: 'bg-yellow-500',
    gradient: 'from-yellow-400 to-orange-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    nextStatus: OrderStatus.PREPARING,
    nextLabel: 'Enviar para Cozinha',
    nextIcon: ChevronRight,
  },
  [OrderStatus.PREPARING]: {
    label: 'Em Preparo',
    icon: Package,
    color: 'bg-blue-500',
    gradient: 'from-blue-400 to-indigo-600',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    nextStatus: OrderStatus.READY,
    nextLabel: 'Marcar como Pronto',
    nextIcon: CheckCircle2,
  },
  [OrderStatus.READY]: {
    label: 'Prontos',
    icon: CheckCircle2,
    color: 'bg-purple-500',
    gradient: 'from-purple-400 to-pink-600',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    nextStatus: OrderStatus.DELIVERING,
    nextLabel: 'Saiu para Entrega',
    nextIcon: Truck,
  },
  [OrderStatus.DELIVERING]: {
    label: 'Em Entrega',
    icon: Truck,
    color: 'bg-orange-500',
    gradient: 'from-orange-400 to-red-600',
    textColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    nextStatus: OrderStatus.COMPLETED,
    nextLabel: 'Concluir',
    nextIcon: CheckCircle2,
  },
  [OrderStatus.COMPLETED]: {
    label: 'Concluídos',
    icon: CheckCircle2,
    color: 'bg-green-500',
    gradient: 'from-green-400 to-emerald-600',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    nextStatus: null,
    nextLabel: null,
    nextIcon: null,
  },
  [OrderStatus.CANCELLED]: {
    label: 'Cancelados',
    icon: X,
    color: 'bg-slate-400',
    gradient: 'from-slate-400 to-slate-500',
    textColor: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    nextStatus: null,
    nextLabel: null,
    nextIcon: null,
  },
};

/** Statuses do Kanban (pedidos ativos — COMPLETED fica na view separada) */
const ORDER_TAB_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERING,
];

type OrdersView = 'kanban' | 'completed';

export default function AdminOrders() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const queryClient = useQueryClient();
  const { data: ordersData, isLoading: loading, refetch: refetchOrders } = useOrders({
    restaurantId,
    page: 0,
    limit: 100,
  });
  const orders = ordersData?.orders ?? [];
  const { data: printSettings } = usePrintSettings(restaurantId);
  const { data: restaurant } = useRestaurant(restaurantId);
  const printSettingsRef = useRef(printSettings);
  printSettingsRef.current = printSettings;

  const [view, setView] = useState<OrdersView>('kanban');
  const [orderToRemove, setOrderToRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const { couriers } = useCouriers(restaurantId);
  const { printOrder, receiptData } = usePrinter();

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
          if (payload.eventType === 'INSERT' && payload.new?.restaurant_id === restaurantId) {
            const orderId = (payload.new as { id: string }).id;
            const settings = printSettingsRef.current;
            if (!settings?.print_auto_on_new_order || !orderId) return;
            try {
              const { data: fullOrder, error } = await supabase
                .from('orders')
                .select(`
                  *,
                  delivery_zone:delivery_zones(*),
                  order_items(*),
                  courier:couriers(id, name, phone)
                `)
                .eq('id', orderId)
                .single();
              if (!error && fullOrder) {
                printOrder(fullOrder as DatabaseOrder, settings.name, settings.print_paper_width || '80mm', currency);
              }
            } catch (e) {
              console.error('Erro ao imprimir pedido novo:', e);
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, printOrder, queryClient]);

  const updateOrderCourier = async (orderId: string, courierId: string | null) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ courier_id: courierId })
        .eq('id', orderId);
      if (error) throw error;
      await refetchOrders();
      toast({ title: 'Entregador atribuído', variant: 'default' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao atribuir entregador', variant: 'destructive' });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === OrderStatus.PREPARING) payload.accepted_at = now;
      if (newStatus === OrderStatus.READY) payload.ready_at = now;
      if (newStatus === OrderStatus.COMPLETED) payload.delivered_at = now;

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId);

      if (error) throw error;

      await refetchOrders();

      toast({
        id: 'kanban-status',
        title: `Pedido → ${statusConfig[newStatus].label}`,
        variant: "success",
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível atualizar o status do pedido",
        variant: "destructive",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };


  const removeOrder = async (orderId: string) => {
    if (!orderId) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: OrderStatus.CANCELLED })
        .eq('id', orderId);

      if (error) throw error;

      await refetchOrders();
      setOrderToRemove(null);
      toast({
        title: "Pedido removido",
        description: "O pedido foi cancelado e removido da lista.",
        variant: "default",
      });
    } catch (error) {
      console.error('Erro ao remover pedido:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o pedido.",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter((order) => order.status === status);
  };

  const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    card: 'Cartão',
    cash: 'Dinheiro',
    table: 'Pagar na mesa',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handlePrintOrder = (order: DatabaseOrder) => {
    const name = printSettings?.name ?? '';
    const width = printSettings?.print_paper_width ?? '80mm';
    printOrder(order, name, width, currency);
  };

  return (
    <>
      <OrderReceipt data={receiptData} />
      <div className="space-y-6 min-w-0">
        {/* ── Cabeçalho ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 text-foreground">Gestão de Pedidos</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {view === 'kanban'
                ? 'Acompanhe e gerencie os pedidos em tempo real'
                : 'Histórico de pedidos concluídos com exportação CSV'}
            </p>
          </div>

          {/* Toggle Kanban / Concluídos */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 self-start sm:self-auto flex-shrink-0">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'kanban'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
              {orders.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  view === 'kanban'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {orders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView('completed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'completed'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListChecks className="h-4 w-4" />
              Concluídos
            </button>
          </div>
        </div>

        {/* ── View: Concluídos ── */}
        {view === 'completed' && (
          <CompletedOrdersView
            restaurantId={restaurantId}
            restaurantName={restaurant?.name ?? printSettings?.name ?? 'Restaurante'}
            currency={currency}
            onPrintOrder={handlePrintOrder}
          />
        )}

        {/* ── View: Kanban ── */}
        {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
          {ORDER_TAB_STATUSES.map((status) => {
            const statusOrders = getOrdersByStatus(status);
            const config = statusConfig[status];
            const IconComponent = config.icon;

            return (
              <div key={status} className="flex flex-col gap-3 min-w-0">
                {/* ── Header da Coluna ── */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${config.bgColor} border ${config.borderColor}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm`}>
                      <IconComponent className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">{config.label}</span>
                  </div>
                  <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0 text-xs min-w-[1.5rem] justify-center`}>
                    {statusOrders.length}
                  </Badge>
                </div>

                {/* ── Cards ── */}
                {statusOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted py-10">
                    <IconComponent className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Nenhum pedido</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {statusOrders.map((order) => {
                      const isTableOrder = order.order_source === 'table' || !!order.table_id;
                      const isDelivering = status === OrderStatus.DELIVERING;
                      const isDeliveryOrder = !isTableOrder && (order.delivery_type === 'delivery' || order.order_source === 'delivery');
                      const canNotifyWhatsApp = isDelivering && !isTableOrder;

                      // Botão de avanço de status
                      const tablePreparingOverride = isTableOrder && status === OrderStatus.PREPARING;
                      const completedConfig = statusConfig[OrderStatus.COMPLETED];
                      const nextStatus = tablePreparingOverride ? OrderStatus.COMPLETED : config.nextStatus;
                      const nextLabel = tablePreparingOverride ? completedConfig.label : config.nextLabel;
                      const NextIconComponent = tablePreparingOverride ? completedConfig.icon : config.nextIcon;
                      const gradientClass = tablePreparingOverride ? completedConfig.gradient : config.gradient;
                      const hideForTable = isTableOrder && (status === OrderStatus.READY || status === OrderStatus.DELIVERING);

                      // WhatsApp "saiu para entrega"
                      const buildWhatsAppDeliveryUrl = () => {
                        const phone = order.customer_phone.replace(/\D/g, '');
                        const name = order.customer_name.split(' ')[0];
                        const msg = encodeURIComponent(`Olá ${name}! 🛵 Seu pedido acabou de sair para entrega. Em breve estará na sua porta! 😊`);
                        return `https://wa.me/${phone}?text=${msg}`;
                      };

                      return (
                        <div
                          key={order.id}
                          className={`relative bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
                        >
                          {/* Borda lateral colorida de status */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${config.gradient} rounded-l-xl`} />

                          <div className="pl-3 pr-2.5 pt-2.5 pb-3 space-y-2.5">
                            {/* ── Linha 1: ID + Badge + Ações ── */}
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-mono font-bold text-foreground">
                                  #{order.id.slice(0, 8).toUpperCase()}
                                </span>
                                {isTableOrder ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    <UtensilsCrossed className="h-2.5 w-2.5" /> Mesa
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                                    <Bike className="h-2.5 w-2.5" /> Delivery
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button
                                  type="button" variant="ghost" size="icon"
                                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                  onClick={() => handlePrintOrder(order)} title="Imprimir cupom"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                <RoleGuard allowedRoles={[...ROLES_CANCEL_ORDER]}>
                                  <Button
                                    type="button" variant="ghost" size="icon"
                                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setOrderToRemove(order.id)} title="Cancelar pedido"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </RoleGuard>
                              </div>
                            </div>

                            {/* ── Linha 2: Tempo ── */}
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground -mt-1">
                              <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ptBR })}
                            </div>

                            {/* ── Cliente ── */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                                  {order.customer_name}
                                </p>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                  {formatPhone(order.customer_phone)}
                                </p>
                              </div>
                            </div>

                            {/* ── Endereço (delivery) ── */}
                            {isDeliveryOrder && (order.delivery_zone?.location_name || order.delivery_address) && (
                              <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  {order.delivery_zone?.location_name && (
                                    <p className="text-[11px] font-semibold text-foreground truncate">
                                      {order.delivery_zone.location_name}
                                    </p>
                                  )}
                                  {order.delivery_address && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                                      {order.delivery_address}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ── Itens ── */}
                            <div className="space-y-1 rounded-lg bg-muted/30 px-2 py-1.5">
                              {order.order_items?.slice(0, 3).map((item: any) => (
                                <div key={item.id} className="flex items-baseline gap-1.5">
                                  <span className="text-[11px] font-bold text-foreground/60 flex-shrink-0 w-5 text-right">
                                    {item.quantity}×
                                  </span>
                                  <span className="text-[11px] text-foreground line-clamp-1 flex-1">
                                    {item.product_name}
                                  </span>
                                </div>
                              ))}
                              {order.order_items && order.order_items.length > 3 && (
                                <p className="text-[11px] text-muted-foreground pl-6">
                                  +{order.order_items.length - 3} {order.order_items.length - 3 === 1 ? 'item' : 'itens'}
                                </p>
                              )}
                            </div>

                            {/* ── Rodapé: Pagamento + Total ── */}
                            <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <CreditCard className="h-3 w-3 flex-shrink-0" />
                                <span>
                                  {isTableOrder
                                    ? 'Pagar na mesa'
                                    : paymentMethodLabels[order.payment_method] ?? order.payment_method}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-foreground">
                                {formatCurrency(order.total, currency)}
                              </span>
                            </div>

                            {/* ── Entregador (só delivery) ── */}
                            {couriers.length > 0 && !isTableOrder && (
                              <div className="space-y-1">
                                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                  <Bike className="h-3 w-3" /> Entregador
                                </p>
                                <Select
                                  value={order.courier_id ?? 'none'}
                                  onValueChange={(v) => updateOrderCourier(order.id, v === 'none' ? null : v)}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Atribuir motoboy" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {couriers.filter((c) => c.active).map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.name}{c.phone ? ` (${c.phone})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* ── WhatsApp "Saiu pra entrega" ── */}
                            {canNotifyWhatsApp && (
                              <a
                                href={buildWhatsAppDeliveryUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] transition-colors py-1.5 text-xs font-semibold text-white shadow-sm"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Avisar cliente no WhatsApp
                              </a>
                            )}

                            {/* ── Botão avançar status ── */}
                            {!hideForTable && nextStatus && NextIconComponent && (
                              <Button
                                size="sm"
                                disabled={updatingOrderId === order.id}
                                className={`w-full h-8 text-xs bg-gradient-to-r ${gradientClass} text-white border-0 shadow-sm hover:shadow-md hover:brightness-105 transition-all font-semibold`}
                                onClick={() => updateOrderStatus(order.id, nextStatus)}
                              >
                                {updatingOrderId === order.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : React.createElement(NextIconComponent, { className: "h-3.5 w-3.5 mr-1.5" })
                                }
                                {nextLabel}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )} {/* fim view kanban */}
      </div>

      {/* Diálogo de confirmação para remover pedido */}
      <Dialog open={!!orderToRemove} onOpenChange={(open) => !open && setOrderToRemove(null)}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => removing && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <X className="h-5 w-5" />
              </span>
              Remover pedido?
            </DialogTitle>
            <DialogDescription>
              O pedido será cancelado e removido da lista. Esta ação não envia notificação ao cliente.
              Você pode precisar avisá-lo por WhatsApp se já tiver sido confirmado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOrderToRemove(null)}
              disabled={removing}
            >
              Manter
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => orderToRemove && removeOrder(orderToRemove)}
              disabled={removing}
            >
              {removing ? 'Removendo...' : 'Remover pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
