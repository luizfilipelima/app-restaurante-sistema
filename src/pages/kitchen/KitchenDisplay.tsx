import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { DatabaseOrder, OrderStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, CheckCircle, Flame } from 'lucide-react';

export default function KitchenDisplay() {
  const { user, signOut } = useAuthStore();
  const [orders, setOrders] = useState<DatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.restaurant_id) {
      loadOrders();
      subscribeToOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user?.restaurant_id) return;

    try {
      setLoading(true);

      // Buscar apenas pedidos em preparo (que já foram aprovados pela recepção)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*)
        `)
        .eq('restaurant_id', user.restaurant_id)
        .eq('status', OrderStatus.PREPARING)
        .order('is_paid', { ascending: false }) // Pedidos pagos primeiro
        .order('created_at', { ascending: true }); // Mais antigos primeiro

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrders = () => {
    if (!user?.restaurant_id) return;

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${user.restaurant_id}`,
        },
        (payload) => {
          console.log('Order update:', payload);
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsReady = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: OrderStatus.READY })
        .eq('id', orderId);

      if (error) throw error;

      // Remove da lista local
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
    } catch (error) {
      console.error('Erro ao marcar como pronto:', error);
    }
  };

  const getOrderDuration = (createdAt: string) => {
    const minutes = Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) / 1000 / 60
    );
    return minutes;
  };

  const getOrderColor = (createdAt: string) => {
    const minutes = getOrderDuration(createdAt);
    if (minutes < 15) return 'border-green-500';
    if (minutes < 30) return 'border-yellow-500';
    return 'border-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Flame className="h-8 w-8 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold">Sistema de Cozinha</h1>
                <p className="text-sm text-slate-400">
                  {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} em preparo
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="container mx-auto px-4 py-6">
        {orders.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-xl text-slate-300">
                Nenhum pedido em preparo no momento
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Novos pedidos aparecerão aqui automaticamente
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const duration = getOrderDuration(order.created_at);
              const colorClass = getOrderColor(order.created_at);

              return (
                <Card
                  key={order.id}
                  className={`bg-slate-800 border-4 ${colorClass} shadow-lg`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl text-white">
                          Pedido #{order.id.slice(0, 8).toUpperCase()}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-400">
                            {formatDistanceToNow(new Date(order.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {order.is_paid && (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            PAGO
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-lg font-bold ${
                            duration < 15
                              ? 'text-green-400 border-green-400'
                              : duration < 30
                              ? 'text-yellow-400 border-yellow-400'
                              : 'text-red-400 border-red-400'
                          }`}
                        >
                          {duration}min
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Cliente */}
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <p className="font-semibold text-lg text-white">
                        {order.customer_name}
                      </p>
                      <p className="text-sm text-slate-300">
                        {order.delivery_type === 'delivery'
                          ? '🚴 Entrega'
                          : '🏃 Retirada'}
                      </p>
                    </div>

                    {/* Itens */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-400 uppercase">
                        Itens do Pedido:
                      </p>
                      {order.order_items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="bg-slate-700/30 rounded-lg p-3 border border-slate-600"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-bold text-lg text-white">
                              {item.quantity}x
                            </span>
                            <span className="font-semibold text-white flex-1 ml-2">
                              {item.product_name}
                            </span>
                          </div>

                          {/* Detalhes da Pizza */}
                          {item.pizza_size && (
                            <div className="text-sm text-slate-300 space-y-1 mt-2 pl-8">
                              <p>
                                <span className="text-slate-400">Tamanho:</span>{' '}
                                {item.pizza_size}
                              </p>
                              {item.pizza_flavors &&
                                item.pizza_flavors.length > 0 && (
                                  <p>
                                    <span className="text-slate-400">
                                      Sabores:
                                    </span>{' '}
                                    {item.pizza_flavors.join(', ')}
                                  </p>
                                )}
                              {item.pizza_dough && (
                                <p>
                                  <span className="text-slate-400">Massa:</span>{' '}
                                  {item.pizza_dough}
                                </p>
                              )}
                              {item.pizza_edge && (
                                <p>
                                  <span className="text-slate-400">Borda:</span>{' '}
                                  {item.pizza_edge}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Observações */}
                          {item.observations && (
                            <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-600 rounded">
                              <p className="text-sm font-semibold text-yellow-300">
                                ⚠️ OBS: {item.observations}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Observações do Pedido */}
                    {order.notes && (
                      <div className="p-3 bg-yellow-900/30 border border-yellow-600 rounded">
                        <p className="text-sm font-semibold text-yellow-300">
                          📝 Obs Geral: {order.notes}
                        </p>
                      </div>
                    )}

                    {/* Botão Pronto */}
                    <Button
                      size="lg"
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-14"
                      onClick={() => markAsReady(order.id)}
                    >
                      <CheckCircle className="h-6 w-6 mr-2" />
                      PEDIDO PRONTO
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-400">
        🔄 Atualização automática ativa
      </div>
    </div>
  );
}
