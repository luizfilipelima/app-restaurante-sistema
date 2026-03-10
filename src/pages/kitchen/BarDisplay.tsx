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
import { Clock, AlertTriangle, Wine, ArrowRight, UtensilsCrossed, Bike, Scale, LayoutDashboard } from 'lucide-react';

type OrderItemWithProduct = {
  product?: { print_destination?: string } | null;
  bar_ready_at?: string | null;
};

export default function BarDisplay() {
  const { user } = useAuthStore();

  const { slug: slugFromPath } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const slugFromQuery = searchParams.get('slug');
  const restaurantIdFromUrl = searchParams.get('restaurant_id');
  const slug = slugFromPath || slugFromQuery;

  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [resolving, setResolving] = useState(!!slug);

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
    document.title = restaurantName ? `Bar - ${restaurantName}` : 'Bar';
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
      const normalized = raw.map((o) => ({
        ...o,
        tables: Array.isArray(o.tables) ? o.tables[0] : o.tables,
      }));

      // Filtra pedidos que têm pelo menos um item de bar ainda pendente (sem bar_ready_at)
      const barOrders = normalized.filter((o) => {
        const barItems = (o.order_items ?? []).filter(
          (it: OrderItemWithProduct) => (it.product?.print_destination ?? 'kitchen') === 'bar' && !it.bar_ready_at
        );
        return barItems.length > 0;
      });

      setOrders(barOrders);
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
      .channel(`bar-orders-${effectiveRestaurantId}`)
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
            setNewOrderIds((prev) => [...prev, newRow.id]);
            toast({
              title: '🔔 Novo pedido de bar!',
              description: `Pedido #${(newRow.id ?? '').slice(0, 8).toUpperCase()}`,
              className: 'bg-amber-500 text-white border-none',
            });
            setTimeout(() => setNewOrderIds((prev) => prev.filter((id) => id !== newRow.id)), 10000);
          }
          refreshSilently();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items',
        },
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

  const markBarReady = async (orderId: string) => {
    try {
      await supabase.rpc('mark_order_bar_items_ready', { p_order_id: orderId });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao marcar pronto', variant: 'destructive' });
      loadOrders(true);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (newStatus === 'ready') {
      await markBarReady(orderId);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o)));
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'preparing') payload.accepted_at = now;

      await supabase.from('orders').update(payload).eq('id', orderId);
    } catch (e) {
      console.error(e);
      loadOrders(true);
    }
  };

  if (resolving) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!effectiveRestaurantId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-6 text-slate-300">
        <Wine className="h-16 w-16 text-slate-600" />
        <h2 className="text-xl font-semibold text-white">Nenhum restaurante selecionado</h2>
        <p className="text-center text-sm max-w-sm">
          Abra a Central do Bar a partir do painel do restaurante (botão Central do Bar no header).
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
          <Wine className="h-8 w-8" /> Carregando Central do Bar...
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');

  type OrderCategory = 'local_fisico' | 'delivery' | 'buffet';
  const getOrderCategory = (o: DatabaseOrder): OrderCategory => {
    if (o.order_source === 'buffet') return 'buffet';
    if (o.order_source === 'table' || o.table_id) return 'local_fisico';
    if (o.order_source === 'comanda') return 'local_fisico';
    if (o.order_source === 'delivery' || o.delivery_type === 'delivery') return 'delivery';
    if (o.order_source === 'pickup' || o.delivery_type === 'pickup') return 'delivery';
    return 'local_fisico';
  };

  const groupByCategory = <T extends { id: string }>(list: T[], getCat: (x: T) => OrderCategory) => {
    const groups: Record<OrderCategory, T[]> = { local_fisico: [], delivery: [], buffet: [] };
    list.forEach((o) => {
      const c = getCat(o);
      groups[c].push(o);
    });
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
              <div
                className={`grid gap-4 ${variant === 'preparing' && ordersList.length > 1 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}
              >
                {ordersList.map((order) => (
                  <BarOrderCard
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
        {Object.values(ordersByCat).every((arr) => arr.length === 0) && <BarEmptyState message={emptyMsg} />}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden font-sans">
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-2xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/20">
                <Wine className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  BAR{restaurantName ? ` — ${restaurantName}` : ''}
                </h1>
                <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span> {pendingOrders.length} Pendentes
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> {preparingOrders.length} Em Preparo
                  </span>
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

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {renderOrderColumn(
            'AGUARDANDO',
            'text-yellow-500',
            <Clock className="h-6 w-6" />,
            pendingByCat,
            (id) => updateStatus(id, 'preparing'),
            'INICIAR PREPARO',
            'bg-blue-600 hover:bg-blue-700',
            'pending',
            'Sem novos pedidos de bar'
          )}
          {renderOrderColumn(
            'EM PREPARO',
            'text-blue-500',
            <Wine className="h-6 w-6" />,
            preparingByCat,
            (id) => updateStatus(id, 'ready'),
            'PRONTO',
            'bg-green-600 hover:bg-green-700',
            'preparing',
            'Bar livre'
          )}
        </div>
      </div>
    </div>
  );
}

function BarOrderCard({
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

  const tableNum = order.tables?.number ?? order.customer_name?.match(/^Mesa\s*(\d+)/i)?.[1] ?? null;
  const badgeLabel =
    category === 'buffet'
      ? 'BUFFET / KG'
      : category === 'delivery'
        ? isDelivery
          ? 'DELIVERY'
          : 'RETIRADA'
        : isTableOrder
          ? `MESA ${tableNum ?? '?'}`
          : isComandaOrder
            ? 'COMANDA'
            : 'LOCAL';

  // Exibe apenas itens de bar
  const barItems = (order.order_items ?? []).filter(
    (it: OrderItemWithProduct) => (it.product?.print_destination ?? 'kitchen') === 'bar'
  );

  return (
    <Card className={`bg-slate-800 border-2 ${borderColor} shadow-xl relative overflow-hidden transition-all duration-300`}>
      {isNew && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 animate-pulse" />}

      <CardHeader className="pb-2 bg-slate-800/50 border-b border-slate-700/50">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl font-black text-white">#{order.id.slice(0, 4).toUpperCase()}</h3>
              <Badge variant="outline" className={`shrink-0 border-0 text-xs font-bold ${categoryConfig.badgeClass}`}>
                <IconComp className="h-3 w-3 mr-1" />
                {badgeLabel}
              </Badge>
            </div>
            {(isTableOrder || isComandaOrder) && order.customer_name && !/^Mesa\s+\d+$/i.test(order.customer_name) && (
              <p className="text-slate-400 text-sm font-medium mt-0.5">Cliente: {order.customer_name}</p>
            )}
            {category === 'delivery' && (
              <p className="text-slate-400 text-sm font-medium mt-0.5">{order.customer_name}</p>
            )}
          </div>
          <Badge className={`${timerColor} text-lg font-bold border-0 px-3 py-1 rounded-md shrink-0`}>{duration} min</Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="space-y-3">
          {barItems.map((item: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 bg-slate-900/30 p-2 rounded-lg">
              <div className="bg-amber-600 text-white font-bold text-xl min-w-[2.5rem] h-10 flex items-center justify-center rounded">
                {item.quantity}
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-100 leading-tight">{item.product_name}</p>
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
                {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                  <div className="mt-1 text-sm text-amber-300 pl-2 border-l-2 border-amber-500/50">
                    {item.addons.map((a: { name: string; quantity?: number }, i: number) => {
                      const qty = a.quantity ?? 1;
                      const label = qty > 1 ? `${a.name} (${qty}x)` : a.name;
                      return <p key={i}>+ {label}</p>;
                    })}
                  </div>
                )}
                {item.observations && (
                  <p className="text-red-400 font-bold text-sm mt-1 uppercase flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {item.observations}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
            <p className="text-red-400 font-bold text-base uppercase flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> OBS: {order.notes}
            </p>
          </div>
        )}

        <Button className={`w-full h-14 text-xl font-bold ${actionColor} shadow-lg mt-2`} onClick={onAction}>
          {actionLabel} <ArrowRight className="ml-2 h-6 w-6" />
        </Button>
      </CardContent>
    </Card>
  );
}

function BarEmptyState({ message }: { message: string }) {
  return (
    <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
      <Wine className="h-10 w-10 mb-2 opacity-20" />
      <p className="font-medium">{message}</p>
    </div>
  );
}
