import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { DatabaseOrder, OrderStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Phone, MapPin, CreditCard } from 'lucide-react';

const statusConfig = {
  [OrderStatus.PENDING]: {
    label: 'Pendentes',
    color: 'bg-yellow-500',
    nextStatus: OrderStatus.PREPARING,
    nextLabel: 'Enviar para Cozinha',
  },
  [OrderStatus.PREPARING]: {
    label: 'Em Preparo',
    color: 'bg-blue-500',
    nextStatus: OrderStatus.READY,
    nextLabel: 'Marcar como Pronto',
  },
  [OrderStatus.READY]: {
    label: 'Prontos',
    color: 'bg-purple-500',
    nextStatus: OrderStatus.DELIVERING,
    nextLabel: 'Saiu para Entrega',
  },
  [OrderStatus.DELIVERING]: {
    label: 'Em Entrega',
    color: 'bg-orange-500',
    nextStatus: OrderStatus.COMPLETED,
    nextLabel: 'Concluir',
  },
  [OrderStatus.COMPLETED]: {
    label: 'Concluídos',
    color: 'bg-green-500',
    nextStatus: null,
    nextLabel: null,
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
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
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
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Pedidos</h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie os pedidos em tempo real
          </p>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.values(OrderStatus).map((status) => {
            const statusOrders = getOrdersByStatus(status);
            const config = statusConfig[status];

            return (
              <div key={status} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.color}`} />
                  <h3 className="font-semibold">
                    {config.label} ({statusOrders.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {statusOrders.length === 0 ? (
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum pedido
                      </CardContent>
                    </Card>
                  ) : (
                    statusOrders.map((order) => (
                      <Card
                        key={order.id}
                        className={`${
                          order.is_paid ? 'border-green-500 border-2' : ''
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">
                                Pedido #{order.id.slice(0, 8)}
                              </CardTitle>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(order.created_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </div>
                            </div>
                            {!order.is_paid && status === OrderStatus.PENDING && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markAsPaid(order.id)}
                                className="h-7 text-xs"
                              >
                                Marcar Pago
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">
                                {order.customer_name}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground pl-5">
                              {formatPhone(order.customer_phone)}
                            </div>
                          </div>

                          {order.delivery_type === 'delivery' && (
                            <div className="flex items-start gap-2 text-xs">
                              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                              <div>
                                <div className="font-medium">
                                  {order.delivery_zone?.location_name}
                                </div>
                                <div className="text-muted-foreground">
                                  {order.delivery_address}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            {order.order_items?.slice(0, 3).map((item: any) => (
                              <div
                                key={item.id}
                                className="text-xs text-muted-foreground"
                              >
                                {item.quantity}x {item.product_name}
                              </div>
                            ))}
                            {order.order_items && order.order_items.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{order.order_items.length - 3} itens
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {paymentMethodLabels[order.payment_method]}
                              </span>
                            </div>
                            <span className="font-bold">
                              {formatCurrency(order.total)}
                            </span>
                          </div>

                          {config.nextStatus && (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                updateOrderStatus(order.id, config.nextStatus!)
                              }
                            >
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
