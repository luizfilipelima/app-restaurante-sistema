import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { DatabaseOrder, OrderStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, CheckCircle, Bell, AlertTriangle, Package, ChefHat } from 'lucide-react';

export default function KitchenDisplay() {
  const { user, signOut } = useAuthStore();
  const [orders, setOrders] = useState<DatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);

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
          
          // Detectar novo pedido
          if (payload.eventType === 'INSERT' || 
              (payload.eventType === 'UPDATE' && (payload.new as any).status === OrderStatus.PREPARING)) {
            const newOrderId = (payload.new as any).id;
            setNewOrderIds(prev => [...prev, newOrderId]);
            
            // Notificação sonora e visual
            toast({
              title: "🔔 Novo pedido na cozinha!",
              description: `Pedido #${newOrderId.slice(0, 8).toUpperCase()}`,
              variant: "default",
            });
            
            // Remover destaque após 5 segundos
            setTimeout(() => {
              setNewOrderIds(prev => prev.filter(id => id !== newOrderId));
            }, 5000);
          }
          
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
      
      toast({
        title: "✅ Pedido pronto!",
        description: `Pedido #${orderId.slice(0, 8).toUpperCase()} finalizado`,
        variant: "success",
      });
    } catch (error) {
      console.error('Erro ao marcar como pronto:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível marcar o pedido como pronto",
        variant: "destructive",
      });
    }
  };

  const getOrderDuration = (createdAt: string) => {
    const minutes = Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) / 1000 / 60
    );
    return minutes;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header Skeleton */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl bg-slate-700" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64 bg-slate-700" />
                <Skeleton className="h-4 w-40 bg-slate-700" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Cards Skeleton */}
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-96 w-full rounded-2xl bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-40 shadow-2xl">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                <ChefHat className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1">Sistema de Cozinha</h1>
                <div className="flex items-center gap-3">
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 font-semibold text-sm">
                    <Package className="h-3 w-3 mr-1" />
                    {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                  </Badge>
                  <span className="text-sm text-slate-400">
                    🔄 Atualização automática
                  </span>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={signOut}
              className="bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="container mx-auto px-6 py-8">
        {orders.length === 0 ? (
          <Card className="bg-slate-800/50 border-2 border-slate-700 shadow-2xl">
            <CardContent className="p-16 text-center">
              <div className="mx-auto w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-slate-200 mb-2">
                Tudo pronto! 🎉
              </p>
              <p className="text-lg text-slate-400">
                Nenhum pedido em preparo no momento
              </p>
              <p className="text-sm text-slate-500 mt-3">
                Novos pedidos aparecerão aqui automaticamente
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders.map((order, index) => {
              const duration = getOrderDuration(order.created_at);
              const isNew = newOrderIds.includes(order.id);
              
              let statusColor = {
                border: 'border-green-500',
                gradient: 'from-green-500/20 to-emerald-600/20',
                badge: 'bg-green-500',
                text: 'text-green-400'
              };
              
              if (duration >= 30) {
                statusColor = {
                  border: 'border-red-500',
                  gradient: 'from-red-500/20 to-rose-600/20',
                  badge: 'bg-red-500',
                  text: 'text-red-400'
                };
              } else if (duration >= 15) {
                statusColor = {
                  border: 'border-yellow-500',
                  gradient: 'from-yellow-500/20 to-orange-600/20',
                  badge: 'bg-yellow-500',
                  text: 'text-yellow-400'
                };
              }

              return (
                <Card
                  key={order.id}
                  className={`bg-slate-800/80 backdrop-blur-sm border-4 ${statusColor.border} shadow-2xl transition-all hover:scale-[1.02] animate-slide-in-bottom ${
                    isNew ? 'animate-pulse-subtle ring-4 ring-orange-500' : ''
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardHeader className="pb-4 bg-gradient-to-br ${statusColor.gradient}">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-2xl font-bold text-white mb-2 truncate">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-300 flex-shrink-0" />
                          <span className="text-sm text-slate-300 truncate">
                            {formatDistanceToNow(new Date(order.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end flex-shrink-0">
                        {isNew && (
                          <Badge className="bg-orange-500 text-white border-0 shadow-lg animate-pulse">
                            <Bell className="h-3 w-3 mr-1" />
                            NOVO
                          </Badge>
                        )}
                        {order.is_paid && (
                          <Badge className="bg-green-600 text-white border-0 shadow-md">
                            💰 PAGO
                          </Badge>
                        )}
                        <Badge
                          className={`${statusColor.badge} text-white border-0 shadow-md text-xl font-bold px-3 py-1`}
                        >
                          {duration >= 30 && <AlertTriangle className="h-4 w-4 mr-1" />}
                          {duration}min
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-5">
                    {/* Cliente */}
                    <div className="bg-gradient-to-r from-slate-700/70 to-slate-700/40 rounded-xl p-4 border border-slate-600">
                      <p className="font-bold text-xl text-white mb-1">
                        {order.customer_name}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-slate-600 text-white font-semibold">
                          {order.delivery_type === 'delivery'
                            ? '🚴 Entrega'
                            : '🏃 Retirada'}
                        </Badge>
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-600">
                        <Package className="h-4 w-4 text-slate-400" />
                        <p className="text-sm font-bold text-slate-300 uppercase tracking-wide">
                          Itens do Pedido
                        </p>
                      </div>
                      {order.order_items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="bg-slate-700/50 rounded-xl p-4 border-2 border-slate-600 hover:border-slate-500 transition-colors"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <Badge className="bg-orange-600 text-white text-xl font-black px-3 py-1 shadow-md">
                              {item.quantity}x
                            </Badge>
                            <span className="font-bold text-xl text-white leading-tight flex-1">
                              {item.product_name}
                            </span>
                          </div>

                          {/* Detalhes da Pizza */}
                          {item.pizza_size && (
                            <div className="text-base text-slate-200 space-y-2 mt-3 pl-2 border-l-4 border-orange-500 ml-2">
                              <p className="flex items-baseline gap-2">
                                <span className="text-slate-400 font-semibold min-w-[80px]">Tamanho:</span>
                                <span className="font-bold">{item.pizza_size}</span>
                              </p>
                              {item.pizza_flavors &&
                                item.pizza_flavors.length > 0 && (
                                  <p className="flex items-baseline gap-2">
                                    <span className="text-slate-400 font-semibold min-w-[80px]">Sabores:</span>
                                    <span className="font-bold">{item.pizza_flavors.join(', ')}</span>
                                  </p>
                                )}
                              {item.pizza_dough && (
                                <p className="flex items-baseline gap-2">
                                  <span className="text-slate-400 font-semibold min-w-[80px]">Massa:</span>
                                  <span className="font-bold">{item.pizza_dough}</span>
                                </p>
                              )}
                              {item.pizza_edge && (
                                <p className="flex items-baseline gap-2">
                                  <span className="text-slate-400 font-semibold min-w-[80px]">Borda:</span>
                                  <span className="font-bold">{item.pizza_edge}</span>
                                </p>
                              )}
                            </div>
                          )}

                          {/* Observações */}
                          {item.observations && (
                            <div className="mt-4 p-3 bg-yellow-900/40 border-2 border-yellow-500 rounded-xl">
                              <p className="text-base font-bold text-yellow-200 flex items-start gap-2">
                                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <span>{item.observations}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Observações do Pedido */}
                    {order.notes && (
                      <div className="p-4 bg-yellow-900/40 border-2 border-yellow-500 rounded-xl">
                        <p className="text-base font-bold text-yellow-200 flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <span><span className="font-black">OBS GERAL:</span> {order.notes}</span>
                        </p>
                      </div>
                    )}

                    {/* Botão Pronto */}
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-black text-xl h-16 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                      onClick={() => markAsReady(order.id)}
                    >
                      <CheckCircle className="h-7 w-7 mr-3" />
                      PEDIDO PRONTO
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
