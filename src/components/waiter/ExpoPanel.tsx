/**
 * Expedição — pedidos prontos para retirada no Terminal do Garçom.
 * Tema claro, timer colorido (verde/amarelo/laranja/vermelho).
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  UtensilsCrossed,
  Bike,
  Package,
} from 'lucide-react';
import type { ExpoOrder } from '@/hooks/orders/useReadyOrders';

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
  if (seconds < 120) return 'fresh';
  if (seconds < 300) return 'warm';
  if (seconds < 600) return 'hot';
  return 'critical';
}

const URGENCY_CONFIG: Record<
  Urgency,
  { border: string; timerBg: string; label: string; labelColor: string; glow: string }
> = {
  fresh: {
    border: 'border-emerald-400',
    timerBg: 'bg-emerald-500 text-white',
    label: 'Recém pronto',
    labelColor: 'text-emerald-600',
    glow: '',
  },
  warm: {
    border: 'border-amber-400',
    timerBg: 'bg-amber-400 text-slate-900',
    label: 'Aguardando',
    labelColor: 'text-amber-600',
    glow: '',
  },
  hot: {
    border: 'border-orange-500',
    timerBg: 'bg-orange-500 text-white',
    label: 'Urgente!',
    labelColor: 'text-orange-600',
    glow: 'ring-1 ring-orange-400/50',
  },
  critical: {
    border: 'border-red-500',
    timerBg: 'bg-red-500 text-white animate-pulse',
    label: 'CRÍTICO!',
    labelColor: 'text-red-600',
    glow: 'ring-2 ring-red-500/60',
  },
};

function ExpoCard({
  order,
  delivering,
  onDeliver,
}: {
  order: ExpoOrder;
  delivering: boolean;
  onDeliver: () => void;
}) {
  const secs = secondsWaiting(order);
  const urgency = getUrgency(secs);
  const cfg = URGENCY_CONFIG[urgency];

  const isTableOrder = order.order_source === 'table' || !!order.table_id;
  const isComandaOrder = order.order_source === 'comanda';
  // Número da mesa: preferir tables.number (join), fallback para customer_name quando no formato "Mesa N"
  const tableNum = order.tables?.number ?? (order.customer_name?.match(/^Mesa\s+(\d+)$/i)?.[1] ?? null);
  const tableLabel = tableNum != null ? String(tableNum) : '?';
  const isPersonName = order.customer_name && !/^Mesa\s+\d+$/i.test(order.customer_name);
  const isCritical = urgency === 'critical';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`
        relative flex flex-col rounded-2xl border-2 bg-white overflow-hidden shadow-lg
        ${cfg.border} ${cfg.glow}
        ${isCritical ? 'shadow-red-200' : ''}
      `}
    >
      {/* Barra de urgência no topo */}
      <div
        className={`h-1.5 w-full ${
          isCritical ? 'bg-red-500 animate-pulse' : cfg.border.replace('border-', 'bg-')
        }`}
      />

      {/* Header do card */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isTableOrder ? (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1">
                <UtensilsCrossed className="h-4 w-4 text-amber-600" />
                <span className="text-xl font-black text-amber-800 leading-none">Mesa {tableLabel}</span>
              </div>
            ) : isComandaOrder ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1">
                <Package className="h-4 w-4 text-emerald-600" />
                <span className="text-lg font-black text-emerald-800 leading-none">Comanda</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 rounded-lg px-2.5 py-1">
                <Bike className="h-4 w-4 text-cyan-600" />
                <span className="text-lg font-black text-cyan-800 leading-none">Delivery</span>
              </div>
            )}
            <span className="text-xs font-mono text-slate-400 font-bold">
              #{order.id.slice(0, 6).toUpperCase()}
            </span>
          </div>
          {isTableOrder && isPersonName && (
            <p className="text-sm text-slate-600 font-medium truncate mt-1.5">Cliente: {order.customer_name}</p>
          )}
          {!isTableOrder && order.customer_name && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-sm text-slate-600 font-medium truncate">{order.customer_name}</span>
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
      <div className="px-4 py-3 space-y-2.5 flex-1 max-h-[280px] overflow-y-auto">
        {order.order_items?.map((item, idx) => (
          <div key={item.id || idx} className="flex items-start gap-3">
            <div className="min-w-[2rem] h-8 flex items-center justify-center bg-slate-100 rounded-lg text-slate-800 font-black text-lg flex-shrink-0">
              {item.quantity}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-base font-bold text-slate-800 leading-snug">{item.product_name}</p>
              {(item.pizza_size || (item.pizza_flavors && item.pizza_flavors.length > 0)) && (
                <div className="mt-0.5 text-xs text-slate-500 pl-2 border-l border-slate-300 space-y-0.5">
                  {item.pizza_size && <p>Tamanho: {item.pizza_size}</p>}
                  {item.pizza_dough && <p>Massa: {item.pizza_dough}</p>}
                  {item.pizza_edge && <p>Borda: {item.pizza_edge}</p>}
                  {item.pizza_flavors && item.pizza_flavors.length > 0 && (
                    <p className="text-slate-600">Sabores: {item.pizza_flavors.join(' + ')}</p>
                  )}
                </div>
              )}
              {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                <div className="mt-0.5 text-xs text-amber-700 pl-2 border-l border-amber-400/60 space-y-0.5">
                  {item.addons.map((a: { name: string; quantity?: number }, i: number) => (
                    <p key={i}>+ {(a.quantity ?? 1) > 1 ? `${a.name} (${a.quantity}x)` : a.name}</p>
                  ))}
                </div>
              )}
              {item.observations && (
                <p className="text-xs font-bold text-red-600 mt-0.5 flex items-center gap-1 uppercase">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {item.observations}
                </p>
              )}
            </div>
          </div>
        ))}
        {order.notes && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mt-1">
            <p className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase">
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
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : isCritical
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-md active:scale-[0.98]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-[0.98]'
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

function ExpoEmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
      <div className="rounded-2xl bg-slate-100 p-8">
        <UtensilsCrossed className="h-16 w-16 text-slate-400" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-bold text-slate-600">Nenhum pedido aguardando</p>
        <p className="text-sm text-slate-500">Quando a cozinha marcar um pedido como Pronto, aparece aqui</p>
      </div>
    </div>
  );
}

export interface ExpoPanelProps {
  orders: ExpoOrder[];
  loading: boolean;
  delivering: string | null;
  onDeliver: (order: ExpoOrder) => void;
}

export function ExpoPanel({ orders, loading, delivering, onDeliver }: ExpoPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando expedição…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Legenda de urgência */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-4 overflow-x-auto pb-1">
        <span className="font-semibold text-slate-600 shrink-0">Tempo no balcão:</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Até 2 min</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>2–5 min</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <span>5–10 min</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-red-600 font-semibold">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>+10 min</span>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {orders.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ExpoEmptyState />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <ExpoCard
                key={order.id}
                order={order}
                delivering={delivering === order.id}
                onDeliver={() => onDeliver(order)}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
