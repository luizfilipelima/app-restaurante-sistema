import React, { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { DatabaseOrder, OrderStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Clock, Phone, MapPin, CreditCard, ChevronRight, Package, Truck, CheckCircle2, X, Loader2, Bike, Printer } from 'lucide-react';
import { useCouriers, useOrders, usePrintSettings } from '@/hooks/queries';
import { usePrinter } from '@/hooks/usePrinter';
import { OrderReceipt } from '@/components/receipt/OrderReceipt';
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

/** Statuses exibidos nas abas do Kanban (exclui CANCELLED) */
const ORDER_TAB_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERING,
  OrderStatus.COMPLETED,
];

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
  const printSettingsRef = useRef(printSettings);
  printSettingsRef.current = printSettings;

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
        title: "✅ Status atualizado!",
        description: `Pedido movido para ${statusConfig[newStatus].label}`,
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
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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
      <div className="space-y-8 min-w-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-foreground">Gestão de Pedidos</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Acompanhe e gerencie os pedidos em tempo real
          </p>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 min-w-0">
          {ORDER_TAB_STATUSES.map((status) => {
            const statusOrders = getOrdersByStatus(status);
            const config = statusConfig[status];
            const IconComponent = config.icon;

            return (
              <div key={status} className="space-y-4">
                {/* Header da Coluna */}
                <div className={`p-4 rounded-xl ${config.bgColor} border-2 ${config.borderColor} shadow-sm`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md`}>
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{config.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {statusOrders.length} {statusOrders.length === 1 ? 'pedido' : 'pedidos'}
                        </p>
                      </div>
                    </div>
                    {statusOrders.length > 0 && (
                      <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0`}>
                        {statusOrders.length}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Cards dos Pedidos */}
                <div className="space-y-3">
                  {statusOrders.length === 0 ? (
                    <Card className="border-2 border-dashed border-muted">
                      <CardContent className="p-8 text-center">
                        <IconComponent className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum pedido
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    statusOrders.map((order, index) => (
                      <Card
                        key={order.id}
                        className={`border-2 hover:shadow-premium transition-shadow ${config.borderColor}`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <CardHeader className="pb-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base font-bold truncate">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </CardTitle>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {formatDistanceToNow(new Date(order.created_at), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => handlePrintOrder(order)}
                                title="Imprimir cupom"
                                aria-label="Imprimir cupom"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={() => setOrderToRemove(order.id)}
                                title="Remover pedido"
                                aria-label="Remover pedido"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Cliente */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-semibold truncate">
                                {order.customer_name}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground pl-5">
                              {formatPhone(order.customer_phone)}
                            </div>
                          </div>

                          {/* Endereço de Entrega */}
                          {order.delivery_type === 'delivery' && (
                            <div className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/50">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold mb-0.5">
                                  {order.delivery_zone?.location_name}
                                </div>
                                <div className="text-muted-foreground line-clamp-2">
                                  {order.delivery_address}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Itens do Pedido */}
                          <div className="space-y-1.5 p-2 rounded-lg bg-muted/30">
                            {order.order_items?.slice(0, 3).map((item: any) => (
                              <div
                                key={item.id}
                                className="text-xs flex items-start gap-2"
                              >
                                <Badge variant="secondary" className="h-5 px-1.5 font-bold text-xs">
                                  {item.quantity}x
                                </Badge>
                                <span className="flex-1 line-clamp-2">{item.product_name}</span>
                              </div>
                            ))}
                            {order.order_items && order.order_items.length > 3 && (
                              <div className="text-xs text-muted-foreground font-medium pt-1">
                                +{order.order_items.length - 3} {order.order_items.length - 3 === 1 ? 'item' : 'itens'}
                              </div>
                            )}
                          </div>

                          {/* Total e Pagamento */}
                          <div className="flex items-center justify-between pt-2 border-t-2">
                            <div className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium">
                                {paymentMethodLabels[order.payment_method]}
                              </span>
                            </div>
                            <span className="font-bold text-lg text-gradient">
                              {formatCurrency(order.total, currency)}
                            </span>
                          </div>

                          {/* Entregador */}
                          {couriers.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium flex items-center gap-1.5">
                                <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                                Entregador
                              </label>
                              <Select
                                value={order.courier_id ?? 'none'}
                                onValueChange={(v) => updateOrderCourier(order.id, v === 'none' ? null : v)}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Atribuir motoboy" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum</SelectItem>
                                  {couriers.filter((c) => c.active).map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                      {c.phone ? ` (${c.phone})` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Botão de Ação */}
                          {config.nextStatus && config.nextIcon && (
                            <Button
                              size="sm"
                              disabled={updatingOrderId === order.id}
                              className={`w-full bg-gradient-to-r ${config.gradient} text-white border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] font-semibold`}
                              onClick={() =>
                                updateOrderStatus(order.id, config.nextStatus!)
                              }
                            >
                              {updatingOrderId === order.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                React.createElement(config.nextIcon, { className: "h-4 w-4 mr-2" })
                              )}
                              {config.nextLabel}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
