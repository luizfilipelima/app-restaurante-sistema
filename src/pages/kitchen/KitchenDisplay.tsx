import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/core/supabase';
import { useAuthStore } from '@/store/authStore';
import { useSessionManager } from '@/hooks/auth/useSessionManager';
import { DatabaseOrder } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/shared/use-toast';
import { Clock, AlertTriangle, ChefHat, ArrowRight, UtensilsCrossed, Bike, Scale, LayoutDashboard, Wine } from 'lucide-react';

export default function KitchenDisplay() {
  const { user } = useAuthStore();

  // slug via path param:
  //   /{slug}/kds  (rota canônica, app subdomain)
  //   kds.quiero.food/{slug}  (subdomínio kds)
  const { slug: slugFromPath } = useParams<{ slug?: string }>();

  // slug / restaurant_id via query params (legado: app.quiero.food/kitchen?slug=...)
  const [searchParams] = useSearchParams();
  const slugFromQuery       = searchParams.get('slug');
  const restaurantIdFromUrl = searchParams.get('restaurant_id');

  // Prioridade: path param > query param > restaurant_id na URL > perfil do usuário
  const slug = slugFromPath || slugFromQuery;

  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [resolving, setResolving]   = useState(!!slug);

  useEffect(() => {
    if (!slug) {
      setResolvedId(user?.restaurant_id || restaurantIdFromUrl || null);
      setResolving(false);
      return;
    }

    supabase
      .from('restaurants')
      .select('id, name')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.id) {
          setResolvedId(data.id);
          setRestaurantName((data as { name?: string }).name?.trim() ?? '');
        } else {
          setResolvedId(user?.restaurant_id || restaurantIdFromUrl || null);
        }
        setResolving(false);
      });
  }, [slug, restaurantIdFromUrl, user?.restaurant_id]);

  useEffect(() => {
    if (!resolvedId || restaurantName) return;
    supabase
      .from('restaurants')
      .select('name')
      .eq('id', resolvedId)
      .single()
      .then(({ data, error }) => {
        if (!error && (data as { name?: string })?.name) {
          setRestaurantName(((data as { name?: string }).name ?? '').trim());
        }
      });
  }, [resolvedId, restaurantName]);

  const effectiveRestaurantId = resolvedId;

  useEffect(() => {
    document.title = restaurantName ? `KDS - ${restaurantName}` : 'KDS';
    return () => { document.title = ''; };
  }, [restaurantName]);

  const [orders, setOrders] = useState<DatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Gerenciar sessões simultâneas (máximo 3 por restaurante)
  useSessionManager(user?.id || null, effectiveRestaurantId);

  const loadOrders = useCallback(async (silent = false) => {
    if (!effectiveRestaurantId) return;

    try {
      if (!silent) setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          tables(number),
          order_items(*, product:products(print_destination))
        `)
        .eq('restaurant_id', effectiveRestaurantId)
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      const raw = (data ?? []) as any[];
      const normalized = raw
        .map((o) => {
          const filteredItems = (o.order_items ?? []).filter(
            (it: { product?: { print_destination?: string }; bar_ready_at?: string | null }) => {
              const dest = it.product?.print_destination ?? 'kitchen';
              if (dest === 'bar' && it.bar_ready_at) return false;
              return true;
            }
          );
          return { ...o, tables: Array.isArray(o.tables) ? o.tables[0] : o.tables, order_items: filteredItems };
        })
        .filter((o) => (o.order_items ?? []).length > 0);
      setOrders(normalized);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setOrders([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [effectiveRestaurantId]);

  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSilently = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      loadOrdersRef.current(true);
    }, 300);
  }, []);

  useEffect(() => {
    if (!effectiveRestaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    loadOrders(false);
    const channel = supabase
      .channel(`kitchen-orders-${effectiveRestaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${effectiveRestaurantId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (payload.eventType === 'INSERT' && newRow?.status && ['pending', 'preparing'].includes(newRow.status)) {
            const newOrderId = newRow.id;
            setNewOrderIds(prev => [...prev, newOrderId]);
            toast({
              title: "🔔 Novo pedido!",
              description: `Pedido #${(newOrderId ?? '').slice(0, 8).toUpperCase()}`,
              className: "bg-blue-500 text-white border-none",
            });
            setTimeout(() => setNewOrderIds(prev => prev.filter(id => id !== newOrderId)), 10000);
          }
          refreshSilently();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_items' },
        () => refreshSilently()
      )
      .subscribe();

    const poll = setInterval(() => loadOrdersRef.current(true), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [effectiveRestaurantId, loadOrders, refreshSilently]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));

    if (effectiveRestaurantId) {
      try {
        const now = new Date().toISOString();
        const payload: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'preparing') payload.accepted_at = now;
        if (newStatus === 'ready') payload.ready_at = now;

        await supabase.from('orders').update(payload).eq('id', orderId);
        if (newStatus === 'preparing') {
          import('@/lib/whatsapp/notifyOrderStatusWhatsApp').then(({ notifyOrderStatusWhatsApp }) =>
            notifyOrderStatusWhatsApp(orderId, 'preparing')
          ).catch(() => {});
        }
      } catch (e) {
        console.error(e);
        loadOrders(true);
      }
    }
  };

  // Aguarda a resolução do slug antes de renderizar qualquer conteúdo
  if (resolving) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!effectiveRestaurantId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-6 text-slate-300">
        <ChefHat className="h-16 w-16 text-slate-600" />
        <h2 className="text-xl font-semibold text-white">Nenhum restaurante selecionado</h2>
        <p className="text-center text-sm max-w-sm">
          Abra o modo cozinha a partir do painel de restaurantes (botão Cozinha no card) ou do painel admin do restaurante.
        </p>
        <Button asChild variant="ghost" size="sm" className="gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
          <Link to="/super-admin/restaurants">
            <LayoutDashboard className="h-4 w-4" />
            Ir para restaurantes
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse flex items-center gap-3">
          <ChefHat className="h-8 w-8" /> Carregando KDS...
        </div>
      </div>
    );
  }

  // Ordenar por created_at ASC para que novos pedidos apareçam abaixo dos já exibidos
  const byCreatedAsc = (a: DatabaseOrder, b: DatabaseOrder) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  const pendingOrders = orders.filter(o => o.status === 'pending').sort(byCreatedAsc);
  const preparingOrders = orders.filter(o => o.status === 'preparing').sort(byCreatedAsc);

  // Categorias para agrupamento no KDS
  type OrderCategory = 'local_fisico' | 'delivery' | 'buffet';
  const getOrderCategory = (o: DatabaseOrder): OrderCategory => {
    if (o.order_source === 'buffet') return 'buffet';
    if (o.order_source === 'table' || o.table_id) return 'local_fisico'; // pedido de mesa = local
    if (o.order_source === 'comanda') return 'local_fisico';
    if (o.order_source === 'delivery' || o.delivery_type === 'delivery') return 'delivery';
    if (o.order_source === 'pickup' || o.delivery_type === 'pickup') return 'delivery';
    return 'local_fisico';
  };

  const groupByCategory = <T extends { id: string }>(list: T[], getCat: (x: T) => OrderCategory) => {
    const groups: Record<OrderCategory, T[]> = { local_fisico: [], delivery: [], buffet: [] };
    list.forEach((o) => { const c = getCat(o); groups[c].push(o); });
    return groups;
  };

  const pendingByCat = groupByCategory(pendingOrders, getOrderCategory);
  const preparingByCat = groupByCategory(preparingOrders, getOrderCategory);

  const categoryConfig: Record<OrderCategory, { label: string; icon: typeof UtensilsCrossed; badgeClass: string; headerClass: string }> = {
    local_fisico: {
      label: 'Local Físico',
      icon: UtensilsCrossed,
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      headerClass: 'text-amber-400 border-amber-500/30',
    },
    delivery: {
      label: 'Delivery / Retirada',
      icon: Bike,
      badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
      headerClass: 'text-cyan-400 border-cyan-500/30',
    },
    buffet: {
      label: 'Buffet / Kg',
      icon: Scale,
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      headerClass: 'text-emerald-400 border-emerald-500/30',
    },
  };

  const renderOrderColumn = (
    title: string,
    titleColor: string,
    titleIcon: React.ReactNode,
    ordersByCat: Record<OrderCategory, DatabaseOrder[]>,
    onAction: (id: string) => void,
    actionLabel: string,
    actionColor: string,
    variant: 'pending' | 'preparing',
    emptyMsg: string
  ) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <h2 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
          {titleIcon} {title}
        </h2>
        <Badge className={`${titleColor.replace('text-', 'bg-').replace('400', '500')}/20 ${titleColor} border-0 text-lg px-3`}>
          {Object.values(ordersByCat).reduce((s, arr) => s + arr.length, 0)}
        </Badge>
      </div>

      <div className="space-y-6">
        {(['local_fisico', 'delivery', 'buffet'] as OrderCategory[]).map((cat) => {
          const ordersList = ordersByCat[cat];
          const cfg = categoryConfig[cat];
          const IconComp = cfg.icon;
          if (ordersList.length === 0) return null;
          return (
            <div key={cat} className="space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-slate-900/30 ${cfg.headerClass}`}>
                <IconComp className="h-5 w-5 shrink-0" />
                <span className="font-bold text-sm uppercase tracking-wide">{cfg.label}</span>
                <Badge variant="outline" className={`ml-auto border-0 text-xs font-bold ${cfg.badgeClass}`}>
                  {ordersList.length}
                </Badge>
              </div>
              <div className={`grid gap-4 ${variant === 'preparing' && ordersList.length > 1 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                {ordersList.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    category={cat}
                    categoryConfig={categoryConfig[cat]}
                    isNew={newOrderIds.includes(order.id)}
                    onAction={() => onAction(order.id)}
                    actionLabel={actionLabel}
                    actionColor={actionColor}
                    variant={variant}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {Object.values(ordersByCat).every((arr) => arr.length === 0) && (
          <EmptyState message={emptyMsg} />
        )}
      </div>
    </div>
  );

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
                <h1 className="text-2xl font-black tracking-tight text-white">
                  COZINHA{restaurantName ? ` — ${restaurantName}` : ''}
                </h1>
                <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> {pendingOrders.length} Pendentes</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {preparingOrders.length} Em Preparo</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-black font-mono tabular-nums">
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board — agrupado por Local Físico, Delivery e Buffet/Kg */}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          
          {/* Coluna: Pendentes */}
          {renderOrderColumn(
            'AGUARDANDO',
            'text-yellow-500',
            <Clock className="h-6 w-6" />,
            pendingByCat,
            (id) => updateStatus(id, 'preparing'),
            'INICIAR PREPARO',
            'bg-blue-600 hover:bg-blue-700',
            'pending',
            'Sem novos pedidos'
          )}

          {/* Coluna: Em Preparo */}
          {renderOrderColumn(
            'EM PREPARO',
            'text-blue-500',
            <ChefHat className="h-6 w-6" />,
            preparingByCat,
            (id) => updateStatus(id, 'ready'),
            'PRONTO',
            'bg-green-600 hover:bg-green-700',
            'preparing',
            'Cozinha livre'
          )}

        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  category,
  categoryConfig,
  isNew,
  onAction,
  actionLabel,
  actionColor,
  variant,
}: {
  order: DatabaseOrder & { tables?: { number: number } | null };
  category: 'local_fisico' | 'delivery' | 'buffet';
  categoryConfig: { label: string; icon: typeof UtensilsCrossed; badgeClass: string };
  isNew: boolean;
  onAction: () => void;
  actionLabel: string;
  actionColor: string;
  variant: 'pending' | 'preparing';
}) {
  const duration = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 1000 / 60);
  const isTableOrder = order.order_source === 'table' || !!order.table_id;
  const isComandaOrder = order.order_source === 'comanda';
  const isDelivery = order.order_source === 'delivery' || order.delivery_type === 'delivery';
  const IconComp = categoryConfig.icon;

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

  // Tag para pedidos de mesa: sempre mostrar MESA quando order_source=table ou table_id
  const tableNum = order.tables?.number ?? order.customer_name?.match(/^Mesa\s*(\d+)/i)?.[1] ?? null;
  const badgeLabel = category === 'buffet'
    ? 'BUFFET / KG'
    : category === 'delivery'
      ? (isDelivery ? 'DELIVERY' : 'RETIRADA')
      : isTableOrder
        ? `MESA ${tableNum ?? '?'}`
        : isComandaOrder
          ? 'COMANDA'
          : 'LOCAL';

  return (
    <Card className={`bg-slate-800 border-2 ${borderColor} shadow-xl relative overflow-hidden transition-all duration-300`}>
      {isNew && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
      )}

      <CardHeader className="pb-2 bg-slate-800/50 border-b border-slate-700/50">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="flex flex-col gap-1.5">
              <Badge variant="outline" className={`shrink-0 border-2 w-fit text-xl font-black px-4 py-1.5 rounded-lg ${categoryConfig.badgeClass}`}>
                <IconComp className="h-5 w-5 mr-2" />
                {badgeLabel}
              </Badge>
              <span className="text-sm font-medium text-slate-400">#{order.id.slice(0, 4).toUpperCase()}</span>
            </div>
            {(isTableOrder || isComandaOrder) && order.customer_name && !/^Mesa\s+\d+$/i.test(order.customer_name) && (
              <p className="text-slate-400 text-sm font-medium mt-0.5">Cliente: {order.customer_name}</p>
            )}
            {category === 'delivery' && (
              <p className="text-slate-400 text-sm font-medium mt-0.5">{order.customer_name}</p>
            )}
          </div>
          <Badge className={`${timerColor} text-lg font-bold border-0 px-3 py-1 rounded-md shrink-0`}>
            {duration} min
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Items List */}
        <div className="space-y-3">
          {order.order_items?.map((item: any, idx: number) => {
            const dest = item.product?.print_destination ?? 'kitchen';
            const sectorTag = dest === 'bar' ? 'BAR' : 'COZINHA';
            const sectorClass = dest === 'bar'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
              : 'bg-orange-500/20 text-orange-400 border-orange-500/50';
            const itemTitle = item.pizza_flavors && item.pizza_flavors.length > 0
              ? item.pizza_flavors.join(' + ')
              : (item.product_name || 'Item');
            return (
            <div key={idx} className="flex items-start gap-3 bg-slate-900/30 p-2 rounded-lg">
              <div className="bg-slate-700 text-white font-bold text-xl min-w-[2.5rem] h-10 flex items-center justify-center rounded">
                {item.quantity}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-bold text-slate-100 leading-tight">{itemTitle}</p>
                  <Badge variant="outline" className={`shrink-0 border text-xs font-bold ${sectorClass}`}>
                    {dest === 'bar' ? <Wine className="h-3 w-3 mr-1" /> : <ChefHat className="h-3 w-3 mr-1" />}
                    {sectorTag}
                  </Badge>
                </div>
                {/* Pizza Details — Sabores já no título quando há pizza_flavors */}
                {(item.pizza_size || item.pizza_edge || item.pizza_dough) && (
                  <div className="mt-1 text-sm text-slate-400 pl-2 border-l-2 border-slate-600">
                    {item.pizza_size && <p>Tamanho: {item.pizza_size}</p>}
                    {item.pizza_dough && <p>Massa: {item.pizza_dough}</p>}
                    {item.pizza_edge && <p>Borda: {item.pizza_edge}</p>}
                  </div>
                )}
                {/* Addons - sem preços */}
                {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                  <div className="mt-1 text-sm text-amber-300 pl-2 border-l-2 border-amber-500/50">
                    {item.addons.map((a: { name: string; quantity?: number }, i: number) => {
                      const qty = a.quantity ?? 1;
                      const label = qty > 1 ? `${a.name} (${qty}x)` : a.name;
                      return (
                        <p key={i}>+ {label}</p>
                      );
                    })}
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
            );
          })}
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
