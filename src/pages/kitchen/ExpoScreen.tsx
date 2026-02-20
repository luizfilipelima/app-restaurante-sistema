/**
 * Expo Screen — Tela de Expedição / Garçom
 *
 * Exibe pedidos com status 'ready' (prontos para entrega) em tempo real.
 * Otimizada para tablets usados pelos garçons no salão.
 *
 * Fluxo: KDS marca PRONTO → aparece aqui → garçom clica "Entregar" → completa o pedido
 *
 * Acesso:
 *   • URL canônica:  app.quiero.food/{slug}/garcom
 *   • Legado:        app.quiero.food/expo?restaurant_id=xxx
 */

import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ConciergeBell,
  CheckCircle2,
  Loader2,
  LayoutDashboard,
  UtensilsCrossed,
  Bike,
  AlertTriangle,
  User,
  Wifi,
  WifiOff,
  Package,
  ChefHat,
  Timer,
  Flame,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ExpoOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  observations?: string | null;
  pizza_size?: string | null;
  pizza_flavors?: string[] | null;
  pizza_dough?: string | null;
  pizza_edge?: string | null;
}

interface ExpoOrder {
  id: string;
  restaurant_id: string;
  customer_name: string;
  order_source?: string | null;
  table_id?: string | null;
  notes?: string | null;
  status: string;
  updated_at: string;
  ready_at?: string | null;
  accepted_at?: string | null;
  order_items: ExpoOrderItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Segundos desde que o pedido ficou pronto (usa ready_at se disponível, fallback updated_at) */
function secondsWaiting(order: ExpoOrder): number {
  const ts = order.ready_at || order.updated_at;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

type Urgency = 'fresh' | 'warm' | 'hot' | 'critical';

function getUrgency(seconds: number): Urgency {
  if (seconds < 120)  return 'fresh';    // < 2 min
  if (seconds < 300)  return 'warm';     // 2–5 min
  if (seconds < 600)  return 'hot';      // 5–10 min
  return 'critical';                     // > 10 min
}

const URGENCY_CONFIG: Record<Urgency, {
  border: string;
  timerBg: string;
  label: string;
  labelColor: string;
  glow: string;
  pulse: boolean;
}> = {
  fresh:    { border: 'border-emerald-500',  timerBg: 'bg-emerald-500 text-white',       label: 'Recém pronto',    labelColor: 'text-emerald-400', glow: '',                               pulse: false },
  warm:     { border: 'border-amber-400',    timerBg: 'bg-amber-400 text-slate-900',     label: 'Aguardando',      labelColor: 'text-amber-400',   glow: '',                               pulse: false },
  hot:      { border: 'border-orange-500',   timerBg: 'bg-orange-500 text-white',        label: 'Urgente!',        labelColor: 'text-orange-400',  glow: 'ring-1 ring-orange-500/40',      pulse: false },
  critical: { border: 'border-red-500',      timerBg: 'bg-red-500 text-white animate-pulse', label: 'CRÍTICO!',    labelColor: 'text-red-400',     glow: 'ring-2 ring-red-500/60 animate-[ping_2s_ease-in-out_infinite]', pulse: true },
};

// ─── Componente: Card de pedido pronto ───────────────────────────────────────

function ExpoCard({
  order,
  delivering,
  onDeliver,
}: {
  order: ExpoOrder;
  delivering: boolean;
  onDeliver: () => void;
}) {
  const secs    = secondsWaiting(order);
  const urgency = getUrgency(secs);
  const cfg     = URGENCY_CONFIG[urgency];

  const isTableOrder    = order.order_source === 'table' || !!order.table_id;
  const isComandaOrder  = order.order_source === 'comanda';
  const tableLabel      = order.customer_name?.replace(/^Mesa\s+/i, '') || '?';
  const isCritical      = urgency === 'critical';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`
        relative flex flex-col rounded-2xl border-2 bg-slate-800 overflow-hidden shadow-xl
        ${cfg.border} ${cfg.glow}
        ${isCritical ? 'shadow-red-900/30' : ''}
      `}
    >
      {/* Barra de urgência no topo */}
      <div className={`h-1.5 w-full ${isCritical ? 'bg-red-500 animate-pulse' : cfg.border.replace('border-', 'bg-')}`} />

      {/* Header do card */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-700/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Mesa / tipo */}
          <div className="flex items-center gap-2 flex-wrap">
            {isTableOrder ? (
              <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg px-2.5 py-1">
                <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                <span className="text-xl font-black text-amber-300 leading-none">
                  Mesa {tableLabel}
                </span>
              </div>
            ) : isComandaOrder ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                <Package className="h-4 w-4 text-emerald-400" />
                <span className="text-lg font-black text-emerald-300 leading-none">
                  Comanda
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-lg px-2.5 py-1">
                <Bike className="h-4 w-4 text-cyan-400" />
                <span className="text-lg font-black text-cyan-300 leading-none">
                  Delivery
                </span>
              </div>
            )}

            {/* ID curto */}
            <span className="text-xs font-mono text-slate-500 font-bold">
              #{order.id.slice(0, 6).toUpperCase()}
            </span>
          </div>

          {/* Nome do cliente / garçom */}
          {!isTableOrder && order.customer_name && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-sm text-slate-300 font-medium truncate">
                {order.customer_name}
              </span>
            </div>
          )}
        </div>

        {/* Timer de espera */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-base font-black tabular-nums px-3 py-1.5 rounded-xl ${cfg.timerBg}`}>
            {formatWait(secs)}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.labelColor}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Lista de itens */}
      <div className="px-4 py-3 space-y-2.5 flex-1">
        {order.order_items?.map((item, idx) => (
          <div key={item.id || idx} className="flex items-start gap-3">
            <div className="min-w-[2rem] h-8 flex items-center justify-center bg-slate-700 rounded-lg text-white font-black text-lg flex-shrink-0">
              {item.quantity}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-base font-bold text-slate-100 leading-snug">
                {item.product_name}
              </p>
              {/* Detalhes de pizza */}
              {(item.pizza_size || (item.pizza_flavors && item.pizza_flavors.length > 0)) && (
                <div className="mt-0.5 text-xs text-slate-400 pl-2 border-l border-slate-600 space-y-0.5">
                  {item.pizza_size  && <p>Tamanho: {item.pizza_size}</p>}
                  {item.pizza_dough && <p>Massa: {item.pizza_dough}</p>}
                  {item.pizza_edge  && <p>Borda: {item.pizza_edge}</p>}
                  {item.pizza_flavors && item.pizza_flavors.length > 0 && (
                    <p className="text-slate-300">Sabores: {item.pizza_flavors.join(' + ')}</p>
                  )}
                </div>
              )}
              {/* Observação */}
              {item.observations && (
                <p className="text-xs font-bold text-red-400 mt-0.5 flex items-center gap-1 uppercase">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {item.observations}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Obs gerais do pedido */}
        {order.notes && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 mt-1">
            <p className="text-sm font-bold text-red-400 flex items-center gap-2 uppercase">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {order.notes}
            </p>
          </div>
        )}
      </div>

      {/* Botão Entregar */}
      <div className="px-4 pb-4 pt-2">
        <button
          onClick={onDeliver}
          disabled={delivering}
          className={`
            w-full h-14 rounded-xl flex items-center justify-center gap-3
            text-lg font-black uppercase tracking-wide
            transition-all duration-200
            ${delivering
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : isCritical
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 active:scale-[0.98]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98]'
            }
          `}
        >
          {delivering ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-6 w-6" />
          )}
          {delivering ? 'Registrando…' : 'Marcar Entregue'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Componente: Empty state ──────────────────────────────────────────────────

function ExpoEmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-20 text-slate-600">
      <div className="relative">
        <ConciergeBell className="h-20 w-20 opacity-20" />
        <ChefHat className="absolute -bottom-1 -right-1 h-8 w-8 opacity-30" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xl font-bold text-slate-500">Nenhum pedido aguardando</p>
        <p className="text-sm text-slate-600">Quando a cozinha marcar um pedido como Pronto, aparece aqui</p>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExpoScreen() {
  const { user } = useAuthStore();

  // Resolução do restaurante — mesma lógica do KDS
  const { slug: slugFromPath }  = useParams<{ slug?: string }>();
  const [searchParams]          = useSearchParams();
  const slugFromQuery            = searchParams.get('slug');
  const restaurantIdFromUrl      = searchParams.get('restaurant_id');
  const slug                     = slugFromPath || slugFromQuery;

  const [resolvedId,  setResolvedId]  = useState<string | null>(null);
  const [resolving,   setResolving]   = useState(!!slug);

  useEffect(() => {
    if (!slug) {
      setResolvedId(user?.restaurant_id || restaurantIdFromUrl || null);
      setResolving(false);
      return;
    }
    supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        setResolvedId(error ? (user?.restaurant_id || restaurantIdFromUrl || null) : (data?.id ?? null));
        setResolving(false);
      });
  }, [slug, restaurantIdFromUrl, user?.restaurant_id]);

  const restaurantId = resolvedId;

  // ── Estado ─────────────────────────────────────────────────────────────────

  const [orders,      setOrders]      = useState<ExpoOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [isLive,      setIsLive]      = useState(false);
  const [delivering,  setDelivering]  = useState<string | null>(null);
  const [now,         setNow]         = useState(() => Date.now());

  // Tick a cada segundo para atualizar timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, restaurant_id, customer_name, order_source, table_id, notes,
          status, updated_at, ready_at, accepted_at, delivered_at,
          order_items(id, product_name, quantity, observations,
            pizza_size, pizza_flavors, pizza_dough, pizza_edge)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'ready')
        .order('ready_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      // Fallback: ordena por updated_at para pedidos sem ready_at
      const sorted = [...(data ?? [])].sort((a, b) => {
        const ta = new Date((a as any).ready_at || a.updated_at).getTime();
        const tb = new Date((b as any).ready_at || b.updated_at).getTime();
        return ta - tb; // mais antigos primeiro (maior urgência)
      });
      setOrders(sorted as unknown as ExpoOrder[]);
    } catch (err) {
      console.error('ExpoScreen: erro ao carregar pedidos', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // ── Realtime ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!restaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    loadOrders();

    const channel = supabase
      .channel(`expo-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          const oldStatus = (payload.old as any)?.status;

          // Novo pedido PRONTO → entra na tela com notificação
          if (newStatus === 'ready' && oldStatus !== 'ready') {
            const orderName = (payload.new as any)?.customer_name || 'Pedido';
            toast({
              title: '🔔 Pronto para entrega!',
              description: `${orderName} está aguardando no balcão`,
              className: 'bg-emerald-600 text-white border-none',
            });
          }

          loadOrders();
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, loadOrders]);

  // ── Marcar como entregue ───────────────────────────────────────────────────

  const handleDeliver = async (order: ExpoOrder) => {
    setDelivering(order.id);
    try {
      // Pedidos de mesa → completed direto (garçom entrega na mesa)
      // Outros (delivery/pickup) → delivering (saiu para entrega)
      const isTableOrComanda = order.order_source === 'table'
        || order.order_source === 'comanda'
        || !!order.table_id;

      const nextStatus = isTableOrComanda ? 'completed' : 'delivering';

      const { error } = await supabase
        .from('orders')
        .update({
          status:       nextStatus,
          delivered_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      // Remove otimisticamente da lista
      setOrders(prev => prev.filter(o => o.id !== order.id));

      toast({
        title: '✅ Entregue!',
        description: isTableOrComanda
          ? `Pedido ${order.customer_name || ''} marcado como concluído.`
          : `Pedido enviado para entrega.`,
        className: 'bg-slate-800 text-white border-slate-700',
      });
    } catch (err) {
      console.error('ExpoScreen: erro ao marcar entregue', err);
      toast({ title: 'Erro ao marcar como entregue', variant: 'destructive' });
      loadOrders(); // recarrega em caso de erro
    } finally {
      setDelivering(null);
    }
  };

  // ── Estados de carregamento / sem restaurante ──────────────────────────────

  if (resolving) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-6 text-slate-300">
        <ConciergeBell className="h-16 w-16 text-slate-600" />
        <h2 className="text-xl font-semibold text-white">Nenhum restaurante selecionado</h2>
        <p className="text-center text-sm max-w-sm text-slate-500">
          Acesse esta tela pelo painel admin ou adicione <code className="bg-slate-800 px-1 rounded">?restaurant_id=...</code> na URL.
        </p>
        <Link
          to={
            user?.role === 'super_admin' && restaurantIdFromUrl
              ? `/super-admin/restaurants/${restaurantIdFromUrl}/orders`
              : slug
                ? `/${slug}/painel/orders`
                : '/admin/orders'
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium"
        >
          <LayoutDashboard className="h-4 w-4" />
          Ir para o painel
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white text-xl animate-pulse">
          <ConciergeBell className="h-8 w-8 text-emerald-400" />
          Carregando Expo Screen…
        </div>
      </div>
    );
  }

  // Estatísticas
  const critical = orders.filter(o => getUrgency(secondsWaiting(o)) === 'critical').length;
  const urgent   = orders.filter(o => ['hot', 'critical'].includes(getUrgency(secondsWaiting(o)))).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-2xl">
        <div className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">

            {/* Identidade */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/30 flex-shrink-0">
                <ConciergeBell className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white leading-none">
                  EXPEDIÇÃO
                </h1>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-none">
                  Tela do Garçom
                </p>
              </div>
            </div>

            {/* Contadores */}
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-emerald-400">
                  {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>
              {urgent > 0 && (
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 animate-pulse">
                  <Flame className="h-3.5 w-3.5 text-red-400" />
                  <span className="font-semibold text-red-400">
                    {critical > 0 ? `${critical} crítico${critical > 1 ? 's' : ''}` : `${urgent} urgente${urgent > 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
            </div>

            {/* Lado direito: status + relógio + voltar */}
            <div className="flex items-center gap-3">
              {/* Indicador de conexão */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                isLive
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800 border border-slate-700 text-slate-500'
              }`}>
                {isLive ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Wifi className="h-3 w-3" />
                    Ao Vivo
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Conectando…
                  </>
                )}
              </div>

              {/* Relógio */}
              <span className="text-xl font-black font-mono tabular-nums text-white hidden sm:block">
                {new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>

              {/* Voltar ao painel */}
              <Link
                to={
                  user?.role === 'super_admin' && restaurantId
                    ? `/super-admin/restaurants/${restaurantId}/orders`
                    : slug
                      ? `/${slug}/painel/orders`
                      : '/admin/orders'
                }
                className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Voltar ao painel
              </Link>
            </div>
          </div>
        </div>

        {/* Legenda de urgência */}
        <div className="border-t border-slate-800/80 px-4 sm:px-6 py-2 flex items-center gap-4 text-[11px] text-slate-500 overflow-x-auto">
          <span className="font-semibold text-slate-600 whitespace-nowrap">Tempo no balcão:</span>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="whitespace-nowrap">Até 2 min</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="whitespace-nowrap">2–5 min</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
            <span className="whitespace-nowrap">5–10 min</span>
          </div>
          <div className="flex items-center gap-1 text-red-400 font-semibold">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="whitespace-nowrap">+10 min</span>
            <Timer className="h-3 w-3" />
          </div>
        </div>
      </header>

      {/* ── Grid de pedidos ─────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="popLayout">
          {orders.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ExpoEmptyState />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {orders.map(order => (
                <ExpoCard
                  key={order.id}
                  order={order}
                  delivering={delivering === order.id}
                  onDeliver={() => handleDeliver(order)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
