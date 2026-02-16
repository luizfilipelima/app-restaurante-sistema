import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { DatabaseOrder } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Clock, AlertTriangle, ChefHat, ArrowRight } from 'lucide-react';

// MOCK DATA PARA KDS (Visualização se vazio)
const MOCK_ORDERS: any[] = [
  { id: '1a2b3c', customer_name: 'João Silva', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), status: 'preparing', delivery_type: 'delivery', order_items: [
    { id: '1', quantity: 1, product_name: 'Pizza Margherita', pizza_size: 'Grande', pizza_flavors: ['Margherita'], pizza_dough: 'Tradicional', pizza_edge: 'Catupiry' },
    { id: '2', quantity: 2, product_name: 'Coca-Cola 2L' }
  ] },
  { id: '4d5e6f', customer_name: 'Maria Oliveira', created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(), status: 'preparing', delivery_type: 'pickup', notes: 'SEM CEBOLA NA PIZZA', order_items: [
    { id: '3', quantity: 1, product_name: 'Pizza Meio a Meio', pizza_size: 'Grande', pizza_flavors: ['Calabresa', 'Frango com Catupiry'], pizza_dough: 'Tradicional', observations: 'Bem passada' }
  ] },
  { id: '7g8h9i', customer_name: 'Pedro Santos', created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(), status: 'pending', delivery_type: 'delivery', order_items: [
    { id: '4', quantity: 1, product_name: 'Hambúrguer X-Tudo' }
  ] },
];

export default function KitchenDisplay() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<DatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (user?.restaurant_id) {
      loadOrders();
      subscribeToOrders();
    } else {
      // Se não tiver user (dev mode), carrega mocks após timeout
      setTimeout(() => {
        setOrders(MOCK_ORDERS as unknown as DatabaseOrder[]);
        setLoading(false);
      }, 1000);
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user?.restaurant_id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*)
        `)
        .eq('restaurant_id', user.restaurant_id)
        .in('status', ['pending', 'preparing']) // Pegar pendentes e preparando para o Kanban
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setOrders(data);
      } else {
        setOrders(MOCK_ORDERS as unknown as DatabaseOrder[]);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setOrders(MOCK_ORDERS as unknown as DatabaseOrder[]);
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
          
          if (payload.eventType === 'INSERT' || 
              (payload.eventType === 'UPDATE' && ['pending', 'preparing'].includes((payload.new as any).status))) {
            const newOrderId = (payload.new as any).id;
            setNewOrderIds(prev => [...prev, newOrderId]);
            
            toast({
              title: "🔔 Novo pedido!",
              description: `Pedido #${newOrderId.slice(0, 8).toUpperCase()}`,
              className: "bg-blue-500 text-white border-none",
            });
            
            setTimeout(() => {
              setNewOrderIds(prev => prev.filter(id => id !== newOrderId));
            }, 10000);
          }
          
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));

    if (user?.restaurant_id) {
      try {
        await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      } catch (e) {
        console.error(e);
        loadOrders(); // Revert on error
      }
    } else {
      toast({ title: "Modo Demonstração", description: "Status atualizado localmente." });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse flex items-center gap-3">
          <ChefHat className="h-8 w-8" /> Carregando KDS...
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden font-sans">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-2xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
                <ChefHat className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">COZINHA</h1>
                <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> {pendingOrders.length} Pendentes</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {preparingOrders.length} Em Preparo</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black font-mono tabular-nums">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Coluna: Pendentes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800">
              <h2 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
                <Clock className="h-6 w-6" /> AGUARDANDO
              </h2>
              <Badge className="bg-yellow-500/20 text-yellow-500 border-0 text-lg px-3">{pendingOrders.length}</Badge>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {pendingOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  isNew={newOrderIds.includes(order.id)} 
                  onAction={() => updateStatus(order.id, 'preparing')}
                  actionLabel="INICIAR PREPARO"
                  actionColor="bg-blue-600 hover:bg-blue-700"
                  variant="pending"
                />
              ))}
              {pendingOrders.length === 0 && <EmptyState message="Sem novos pedidos" />}
            </div>
          </div>

          {/* Coluna: Em Preparo */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800">
              <h2 className="text-xl font-bold text-blue-500 flex items-center gap-2">
                <ChefHat className="h-6 w-6" /> EM PREPARO
              </h2>
              <Badge className="bg-blue-500/20 text-blue-500 border-0 text-lg px-3">{preparingOrders.length}</Badge>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {preparingOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  isNew={newOrderIds.includes(order.id)} 
                  onAction={() => updateStatus(order.id, 'ready')}
                  actionLabel="PRONTO"
                  actionColor="bg-green-600 hover:bg-green-700"
                  variant="preparing"
                />
              ))}
              {preparingOrders.length === 0 && <EmptyState message="Cozinha livre" />}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, isNew, onAction, actionLabel, actionColor, variant }: any) {
  const duration = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 1000 / 60);
  
  let borderColor = 'border-slate-700';
  let timerColor = 'bg-slate-800 text-slate-300';
  
  if (variant === 'preparing') {
    if (duration >= 20) {
      borderColor = 'border-red-500 ring-1 ring-red-500';
      timerColor = 'bg-red-500 text-white animate-pulse';
    } else if (duration >= 10) {
      borderColor = 'border-yellow-500';
      timerColor = 'bg-yellow-500 text-black';
    } else {
      borderColor = 'border-blue-500';
      timerColor = 'bg-blue-500 text-white';
    }
  }

  return (
    <Card className={`bg-slate-800 border-2 ${borderColor} shadow-xl relative overflow-hidden transition-all duration-300`}>
      {isNew && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
      )}
      
      <CardHeader className="pb-2 bg-slate-800/50 border-b border-slate-700/50">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-black text-white">#{order.id.slice(0, 4).toUpperCase()}</h3>
            <p className="text-slate-400 text-sm font-medium">{order.customer_name}</p>
          </div>
          <Badge className={`${timerColor} text-lg font-bold border-0 px-3 py-1 rounded-md`}>
            {duration} min
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Items List */}
        <div className="space-y-3">
          {order.order_items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 bg-slate-900/30 p-2 rounded-lg">
              <div className="bg-slate-700 text-white font-bold text-xl min-w-[2.5rem] h-10 flex items-center justify-center rounded">
                {item.quantity}
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-100 leading-tight">{item.product_name}</p>
                {/* Pizza Details */}
                {(item.pizza_size || item.pizza_flavors) && (
                  <div className="mt-1 text-sm text-slate-400 pl-2 border-l-2 border-slate-600">
                    {item.pizza_size && <p>Tamanho: {item.pizza_size}</p>}
                    {item.pizza_dough && <p>Massa: {item.pizza_dough}</p>}
                    {item.pizza_edge && <p>Borda: {item.pizza_edge}</p>}
                    {item.pizza_flavors && item.pizza_flavors.length > 0 && (
                      <p className="text-slate-300">Sabores: {item.pizza_flavors.join(' + ')}</p>
                    )}
                  </div>
                )}
                {/* Item Observation */}
                {item.observations && (
                  <p className="text-red-400 font-bold text-sm mt-1 uppercase flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {item.observations}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Order Notes */}
        {order.notes && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
            <p className="text-red-400 font-bold text-base uppercase flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> OBS: {order.notes}
            </p>
          </div>
        )}

        <Button 
          className={`w-full h-14 text-xl font-bold ${actionColor} shadow-lg mt-2`}
          onClick={onAction}
        >
          {actionLabel} <ArrowRight className="ml-2 h-6 w-6" />
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
      <ChefHat className="h-10 w-10 mb-2 opacity-20" />
      <p className="font-medium">{message}</p>
    </div>
  );
}
