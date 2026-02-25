import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/core/supabase';
import { useTranslation } from 'react-i18next';
import { hasBankAccountData, formatBankAccountLines } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import {
  CheckCircle2,
  Circle,
  Clock,
  UtensilsCrossed,
  Bike,
  PackageCheck,
  XCircle,
  MessageCircle,
  ArrowLeft,
  User,
  Car,
  Gift,
  Wifi,
  Copy,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderStatus, DeliveryType } from '@/types';
import { toast } from '@/hooks/shared/use-toast';

// ── Tipos locais ──────────────────────────────────────────────────────────────

interface TrackingOrder {
  id: string;
  restaurant_id: string;
  customer_name: string;
  status: OrderStatus;
  delivery_type: string;
  delivery_address?: string | null;
  address_details?: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_bank_account?: { bank_name?: string; agency?: string; account?: string; holder?: string; alias?: string } | null;
  order_source?: string | null;
  courier_id?: string | null;
  loyalty_redeemed?: boolean;
  created_at: string;
  updated_at: string;
}

interface TrackingRestaurant {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  currency?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  phone_country?: string | null;
  pix_key?: string | null;
  bank_account?: { pyg?: { bank_name?: string; holder?: string; alias?: string }; ars?: { bank_name?: string; agency?: string; account?: string; holder?: string } } | { bank_name?: string; agency?: string; account?: string; holder?: string } | null;
}

interface TrackingCourier {
  id: string;
  name: string;
  vehicle_plate?: string | null;
}

interface TrackingData {
  order: TrackingOrder;
  restaurant: TrackingRestaurant;
  courier: TrackingCourier | null;
}

// ── Constantes de sequência ───────────────────────────────────────────────────

const DELIVERY_STEPS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.DELIVERING,
  OrderStatus.COMPLETED,
];

const PICKUP_STEPS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
];

function getBankAccountForDisplay(
  order: TrackingOrder,
  restaurant: TrackingRestaurant
): { bank_name?: string; agency?: string; account?: string; holder?: string; alias?: string } | null {
  if (order.payment_bank_account && hasBankAccountData(order.payment_bank_account as { bank_name?: string; agency?: string; account?: string; holder?: string; alias?: string })) {
    return order.payment_bank_account as { bank_name?: string; agency?: string; account?: string; holder?: string; alias?: string };
  }
  const ba = restaurant.bank_account;
  if (!ba || typeof ba !== 'object') return null;
  if ('bank_name' in ba || 'agency' in ba || 'account' in ba || 'holder' in ba) {
    return ba as { bank_name?: string; agency?: string; account?: string; holder?: string };
  }
  const byCountry = ba as { pyg?: { bank_name?: string; holder?: string; alias?: string }; ars?: { bank_name?: string; agency?: string; account?: string; holder?: string } };
  const ars = byCountry.ars && (byCountry.ars.bank_name || byCountry.ars.agency || byCountry.ars.account || byCountry.ars.holder) ? byCountry.ars : null;
  const pyg = byCountry.pyg && (byCountry.pyg.bank_name || byCountry.pyg.holder || byCountry.pyg.alias) ? byCountry.pyg : null;
  return (ars ?? pyg) ?? null;
}

function getStepIndex(status: OrderStatus, isDelivery: boolean): number {
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;
  const idx = steps.indexOf(status);
  return idx === -1 ? 0 : idx;
}

// ── Ícone por step ────────────────────────────────────────────────────────────

function StepIcon({ status, state }: { status: OrderStatus; state: 'done' | 'active' | 'upcoming' }) {
  const base = 'h-7 w-7 flex-shrink-0';
  const color =
    state === 'done'     ? 'text-success' :
    state === 'active'   ? 'text-primary'  :
                           'text-muted-foreground';

  if (status === OrderStatus.CANCELLED) return <XCircle className={`${base} text-destructive`} />;

  const icons: Record<OrderStatus, JSX.Element> = {
    [OrderStatus.PENDING]:   <Clock className={`${base} ${color}`} />,
    [OrderStatus.PREPARING]: <UtensilsCrossed className={`${base} ${color}`} />,
    [OrderStatus.READY]:     <PackageCheck className={`${base} ${color}`} />,
    [OrderStatus.DELIVERING]:<Bike className={`${base} ${color}`} />,
    [OrderStatus.COMPLETED]: <CheckCircle2 className={`${base} ${color}`} />,
    [OrderStatus.CANCELLED]: <XCircle className={`${base} text-destructive`} />,
  };

  return icons[status] ?? <Circle className={`${base} ${color}`} />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildWhatsAppLink(restaurant: TrackingRestaurant, orderId: string): string {
  const raw = (restaurant.whatsapp || restaurant.phone || '').replace(/\D/g, '');
  if (!raw) return '#';
  const country = restaurant.phone_country || 'BR';
  const prefix = country === 'PY' ? '595' : country === 'AR' ? '54' : '55';
  const number = raw.startsWith(prefix) ? raw : prefix + raw;
  const shortId = orderId.slice(0, 8).toUpperCase();
  const msg = encodeURIComponent(`Olá! Preciso de ajuda com meu pedido #${shortId}`);
  return `https://wa.me/${number}?text=${msg}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface OrderTrackingProps {
  tenantSlug?: string;
}

export default function OrderTracking({ tenantSlug: tenantSlugProp }: OrderTrackingProps = {}) {
  const params   = useParams<{ restaurantSlug?: string; slug?: string; orderId: string }>();
  const navigate = useNavigate();
  const { t }    = useTranslation();

  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    params.slug ??
    null;

  const orderId = params.orderId ?? '';

  const [data,    setData]    = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [live,    setLive]    = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [bankCopied, setBankCopied] = useState(false);

  // Armazena o timestamp de quando cada status foi detectado pelo frontend
  const [statusTimestamps, setStatusTimestamps] = useState<Partial<Record<OrderStatus, string>>>({});
  const initialLoaded = useRef(false);

  // ── Carrega idioma: prefere escolha do cliente (sessionStorage), senão restaurante ─
  useEffect(() => {
    if (!restaurantSlug) return;
    (async () => {
      try {
        const userHasChosen = hasStoredMenuLanguage();
        if (userHasChosen) {
          i18n.changeLanguage(getStoredMenuLanguage());
          return;
        }
        const { data: rest } = await supabase
          .from('restaurants')
          .select('language')
          .eq('slug', restaurantSlug)
          .single();
        const lang = (rest?.language === 'es' ? 'es' : 'pt') as MenuLanguage;
        setStoredMenuLanguage(lang);
        await i18n.changeLanguage(lang);
      } catch {
        // silencioso
      }
    })();
  }, [restaurantSlug]);

  // ── Fetch via RPC (com retry para eventual consistência após checkout) ────
  const fetchOrder = useCallback(async (retryCount = 0) => {
    if (!orderId) { setError('ID inválido'); setLoading(false); return; }

    const maxRetries = 5;
    const retryDelayMs = 2000;

    try {
      const { data: rpc, error: rpcErr } = await supabase.rpc('get_order_tracking', {
        p_order_id: orderId.trim(),
      });

      if (rpcErr) throw rpcErr;
      if (!rpc?.ok) {
        const errMsg = rpc?.error ?? 'Pedido não encontrado';
        if (retryCount < maxRetries && (errMsg.includes('não encontrado') || errMsg.includes('not found') || errMsg.includes('Pedido'))) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          return fetchOrder(retryCount + 1);
        }
        throw new Error(errMsg);
      }

      const tracking = rpc as { ok: true; order: TrackingOrder; restaurant: TrackingRestaurant; courier: TrackingCourier | null };
      setData({ order: tracking.order, restaurant: tracking.restaurant, courier: tracking.courier });
      setError(null);
      sessionStorage.removeItem(`order_just_placed_${orderId}`);

      if (!initialLoaded.current) {
        initialLoaded.current = true;
        const ts: Partial<Record<OrderStatus, string>> = {
          [OrderStatus.PENDING]: tracking.order.created_at,
        };
        if (tracking.order.status !== OrderStatus.PENDING) {
          ts[tracking.order.status] = tracking.order.updated_at;
        }
        setStatusTimestamps(ts);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pedido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const justPlaced = sessionStorage.getItem(`order_just_placed_${orderId}`);
    if (justPlaced) {
      const t = setTimeout(() => fetchOrder(0), 1800);
      return () => clearTimeout(t);
    }
    fetchOrder();
  }, [fetchOrder, orderId]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order_tracking_${orderId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<TrackingOrder>;
          if (!updated) return;

          setData((prev) => {
            if (!prev) return prev;
            const merged: TrackingOrder = { ...prev.order, ...updated };
            return { ...prev, order: merged };
          });

          // Registra timestamp do novo status
          if (updated.status) {
            setStatusTimestamps((prev) => ({
              ...prev,
              [updated.status as OrderStatus]: new Date().toISOString(),
            }));
          }

          // Atualiza courier se mudou
          if (updated.courier_id) {
            supabase
              .from('couriers')
              .select('id, name, vehicle_plate')
              .eq('id', updated.courier_id)
              .single()
              .then(({ data: c }) => {
                if (c) setData((prev) => prev ? { ...prev, courier: c } : prev);
              });
          }
        }
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  // ── Renderização ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">{t('tracking.loading')}</p>
      </div>
    );
  }

  if (error || !data) {
    const isTechnicalError = error?.toLowerCase().includes('record') || error?.toLowerCase().includes('not assigned');
    const displayError = isTechnicalError ? t('tracking.notFoundDesc') : (error ?? t('tracking.notFoundDesc'));
    const backPath = tenantSlugProp ? '/' : (restaurantSlug ? `/${restaurantSlug}` : '/');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-6">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <XCircle className="h-10 w-10 text-destructive" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t('tracking.notFound')}</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{displayError}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            onClick={() => { setError(null); setLoading(true); fetchOrder(0); }}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
          >
            {t('tracking.retry')}
          </button>
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('tracking.backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  const { order, restaurant, courier } = data;
  const isDelivery = order.delivery_type === DeliveryType.DELIVERY;
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIndex = getStepIndex(order.status, isDelivery);
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isCompleted = order.status === OrderStatus.COMPLETED;
  const validCurrencies = ['BRL', 'PYG', 'ARS', 'USD'] as const;
  const currency = validCurrencies.includes(restaurant.currency as typeof validCurrencies[number])
    ? (restaurant.currency as typeof validCurrencies[number])
    : 'BRL';
  const shortId = order.id.slice(0, 8).toUpperCase();
  const whatsAppLink = buildWhatsAppLink(restaurant, order.id);

  // Rótulos das etapas
  function stepLabel(s: OrderStatus): string {
    if (s === OrderStatus.COMPLETED) {
      return isDelivery ? t('tracking.step_completed') : t('tracking.step_completed_pickup');
    }
    const map: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]:    t('tracking.step_pending'),
      [OrderStatus.PREPARING]:  t('tracking.step_preparing'),
      [OrderStatus.READY]:      t('tracking.step_ready'),
      [OrderStatus.DELIVERING]: t('tracking.step_delivering'),
      [OrderStatus.COMPLETED]:  t('tracking.step_completed'),
      [OrderStatus.CANCELLED]:  t('tracking.step_cancelled'),
    };
    return map[s] ?? s;
  }

  function stepDesc(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]:    t('tracking.step_pending_desc'),
      [OrderStatus.PREPARING]:  t('tracking.step_preparing_desc'),
      [OrderStatus.READY]:      t('tracking.step_ready_desc'),
      [OrderStatus.DELIVERING]: t('tracking.step_delivering_desc'),
      [OrderStatus.COMPLETED]:  t('tracking.step_completed_desc'),
      [OrderStatus.CANCELLED]:  t('tracking.step_cancelled_desc'),
    };
    return map[s] ?? '';
  }

  return (
    <div data-testid="order-tracking-page" className="min-h-screen bg-background">

      {/* ── Topo ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(tenantSlugProp ? '/' : (restaurantSlug ? `/${restaurantSlug}` : '/'))}
          className="p-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors -ml-1"
          aria-label={t('tracking.backToMenu')}
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>

        {restaurant.logo && (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="h-9 w-9 rounded-full object-cover border border-border shadow-sm"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{restaurant.name}</p>
          <p className="text-xs text-muted-foreground truncate">{t('tracking.orderNumber', { id: shortId })}</p>
        </div>

        {/* Indicador ao vivo */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
          ${live
            ? 'bg-success/10 border-success/30 text-success'
            : 'bg-muted border-border text-muted-foreground'}`}
        >
          <Wifi className={`h-3 w-3 ${live ? 'animate-pulse' : ''}`} />
          {t('tracking.liveLabel')}
        </div>
      </header>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-32 space-y-5">

        {/* Banner de status atual */}
        <AnimatePresence mode="wait">
          <motion.div
            key={order.status}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3 }}
            className={`rounded-2xl p-5 shadow-sm border ${
              isCancelled
                ? 'bg-destructive/10 border-destructive/30'
                : isCompleted
                  ? 'bg-success/10 border-success/30'
                  : 'bg-primary/10 border-primary/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-inner ${
                isCancelled
                  ? 'bg-destructive/20'
                  : isCompleted
                    ? 'bg-success/20'
                    : 'bg-primary/20'
              }`}>
                <StepIcon status={order.status} state="active" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base ${
                  isCancelled ? 'text-destructive' : isCompleted ? 'text-success' : 'text-primary'
                }`}>
                  {stepLabel(order.status)}
                </p>
                <p className={`text-xs mt-0.5 ${
                  isCancelled ? 'text-destructive/80' : isCompleted ? 'text-success' : 'text-primary'
                }`}>
                  {stepDesc(order.status)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {t('tracking.placedAt', { time: fmtTime(order.created_at) })}
              {!isCancelled && !isCompleted && (
                <span className="ml-2 font-medium text-primary">• {t('tracking.estimatedTime')}</span>
              )}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* ── Linha do tempo ────────────────────────────────────────────── */}
        {!isCancelled && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
            <div className="space-y-0">
              {steps.map((step, idx) => {
                const state: 'done' | 'active' | 'upcoming' =
                  idx < currentIndex ? 'done' :
                  idx === currentIndex ? 'active' :
                  'upcoming';

                const isLast = idx === steps.length - 1;
                const ts = statusTimestamps[step];

                return (
                  <div key={step} className="flex gap-3">
                    {/* Coluna esquerda: ícone + linha */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={{
                          scale: state === 'active' ? [1, 1.15, 1] : 1,
                        }}
                        transition={{ duration: 0.5, repeat: state === 'active' ? Infinity : 0, repeatDelay: 2 }}
                      >
                        <StepIcon status={step} state={state} />
                      </motion.div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 mt-1 mb-1 rounded-full min-h-[28px] transition-colors duration-700 ${
                          state === 'done' ? 'bg-success' : 'bg-border'
                        }`} />
                      )}
                    </div>

                    {/* Coluna direita: textos */}
                    <div className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''}`}>
                      <p className={`text-sm font-semibold leading-tight ${
                        state === 'done'     ? 'text-success' :
                        state === 'active'   ? 'text-primary'  :
                                               'text-muted-foreground'
                      }`}>
                        {stepLabel(step)}
                      </p>
                      {state !== 'upcoming' && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {stepDesc(step)}
                        </p>
                      )}
                      {ts && (
                        <p className="text-xs font-medium text-muted-foreground mt-1">
                          {fmtTime(ts)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Card do entregador ────────────────────────────────────────── */}
        <AnimatePresence>
          {(order.status === OrderStatus.DELIVERING || order.status === OrderStatus.COMPLETED) && courier && (
            <motion.div
              key="courier-card"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden"
            >
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bike className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                      {t('tracking.courierTitle')}
                    </p>
                    <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {courier.name}
                    </p>
                    {courier.vehicle_plate && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('tracking.courierPlate')}: <span className="font-mono font-semibold">{courier.vehicle_plate}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Resgate de fidelidade ─────────────────────────────────────── */}
        {order.loyalty_redeemed && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
            <Gift className="h-5 w-5 text-purple-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-purple-700">{t('tracking.loyaltyRedeemed')}</p>
          </div>
        )}

        {/* ── Resumo do pedido ──────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            {t('tracking.summaryTitle')}
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('tracking.subtotal')}</span>
              <span>{formatPrice(order.subtotal, currency)}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t('tracking.deliveryFee')}</span>
                <span>{formatPrice(order.delivery_fee, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground pt-1.5 border-t border-border">
              <span>{t('tracking.total')}</span>
              <span>{formatPrice(order.total, currency)}</span>
            </div>
          </div>

          {/* Método de pagamento */}
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {(() => {
                const pm = order.payment_method;
                if (pm === 'pix')  return t('tracking.paymentPix');
                if (pm === 'bank_transfer') return 'Transferência Bancária';
                if (pm === 'qrcode') return 'QR Code na entrega';
                if (pm === 'card') return t('tracking.paymentCard');
                if (pm === 'cash') return t('tracking.paymentCash');
                return t('tracking.paymentTable');
              })()}
            </p>
          </div>

          {/* Dados para pagamento PIX ou Transferência (pedido pendente) */}
          {order.status === OrderStatus.PENDING && (order.payment_method === 'pix' || order.payment_method === 'bank_transfer') && (
            <div className="pt-3 border-t border-border space-y-2">
              {order.payment_method === 'pix' && restaurant.pix_key && (
                <div className="p-3 rounded-xl bg-success/10 border border-success/30">
                  <p className="text-xs font-semibold text-success mb-1.5">Envie o PIX para:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-foreground break-all bg-card/80 px-2.5 py-2 rounded-lg border border-border">
                      {restaurant.pix_key}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(restaurant.pix_key!);
                          setPixCopied(true);
                          toast({ title: 'Chave PIX copiada!' });
                          setTimeout(() => setPixCopied(false), 2000);
                        } catch {
                          toast({ title: 'Não foi possível copiar', variant: 'destructive' });
                        }
                      }}
                      className="flex-shrink-0 h-10 w-10 rounded-lg bg-success hover:bg-success/90 text-primary-foreground flex items-center justify-center transition-colors"
                      title="Copiar chave PIX"
                    >
                      {pixCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-success mt-2">Envie o comprovante pelo WhatsApp após o pagamento.</p>
                </div>
              )}
              {order.payment_method === 'bank_transfer' && (() => {
                const ba = getBankAccountForDisplay(order, restaurant);
                return ba && hasBankAccountData(ba) && (
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-800 mb-2">Envie a transferência para:</p>
                    <div className="space-y-1.5 text-sm text-indigo-900">
                      {formatBankAccountLines(ba).map((line) => {
                        const idx = line.indexOf(': ');
                        const label = idx >= 0 ? line.slice(0, idx) : line;
                        const value = idx >= 0 ? line.slice(idx + 2) : '';
                        return <p key={label}><span className="text-indigo-600">{label}:</span> {value}</p>;
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(formatBankAccountLines(ba).join('\n'));
                          setBankCopied(true);
                          toast({ title: 'Dados bancários copiados!' });
                          setTimeout(() => setBankCopied(false), 2000);
                        } catch {
                          toast({ title: 'Não foi possível copiar', variant: 'destructive' });
                        }
                      }}
                      className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-700 hover:text-indigo-800"
                    >
                      {bankCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {bankCopied ? 'Copiado!' : 'Copiar dados'}
                    </button>
                    <p className="text-xs text-indigo-700 mt-2">Envie o comprovante pelo WhatsApp após o pagamento.</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </main>

      {/* ── Botão flutuante de ajuda ──────────────────────────────────── */}
      {whatsAppLink !== '#' && (
        <motion.a
          href={whatsAppLink}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          className="fixed bottom-6 right-5 flex items-center gap-2 bg-[#25D366] text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:bg-[#20ba5a] active:scale-95 transition-all z-30"
        >
          <MessageCircle className="h-5 w-5" />
          {t('tracking.helpWhatsApp')}
        </motion.a>
      )}
    </div>
  );
}
