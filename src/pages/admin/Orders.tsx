import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { DatabaseOrder, OrderStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Phone, MapPin, CreditCard, Check, ChevronRight, Package, Truck, CheckCircle2 } from 'lucide-react';

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
    nextIcon: Check,
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
};

export default function AdminOrders() {
  const restaurantId = useAdminRestaurantId();
  const [orders, setOrders] = useState<DatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      loadOrders();
      subscribeToOrders();
    }
  }, [restaurantId]);

  const loadOrders = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          delivery_zone:delivery_zones(*),
          order_items(*)
        `)
        .eq('restaurant_id', restaurantId)
        .neq('status', OrderStatus.COMPLETED)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrders = () => {
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
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Atualizar localmente
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

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
    }
  };

  const markAsPaid = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_paid: true })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, is_paid: true } : order
        )
      );

      toast({
        title: "💰 Pagamento confirmado!",
        description: "Pedido marcado como pago",
        variant: "success",
      });
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível confirmar o pagamento",
        variant: "destructive",
      });
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

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Gestão de Pedidos</h1>
          <p className="text-muted-foreground text-lg">
            Acompanhe e gerencie os pedidos em tempo real
          </p>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {Object.values(OrderStatus).map((status) => {
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
                        className={`border-2 hover:shadow-premium transition-all hover:-translate-y-1 animate-slide-in-bottom ${
                          order.is_paid ? 'border-green-500 bg-green-50/50' : config.borderColor
                        }`}
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
                            {order.is_paid ? (
                              <Badge className="bg-green-500 text-white border-0 shadow-sm">
                                <Check className="h-3 w-3 mr-1" />
                                Pago
                              </Badge>
                            ) : (
                              status === OrderStatus.PENDING && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markAsPaid(order.id)}
                                  className="h-7 text-xs hover:bg-green-50 hover:border-green-500 hover:text-green-600"
                                >
                                  Confirmar
                                </Button>
                              )
                            )}
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
                              {formatCurrency(order.total)}
                            </span>
                          </div>

                          {/* Botão de Ação */}
                          {config.nextStatus && config.nextIcon && (
                            <Button
                              size="sm"
                              className={`w-full bg-gradient-to-r ${config.gradient} text-white border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] font-semibold`}
                              onClick={() =>
                                updateOrderStatus(order.id, config.nextStatus!)
                              }
                            >
                              {React.createElement(config.nextIcon, { className: "h-4 w-4 mr-2" })}
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
    </>
  );
}
