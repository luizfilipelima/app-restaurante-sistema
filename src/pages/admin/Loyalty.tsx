/**
 * Programa de Fidelidade — Página independente
 *
 * Layout moderno com Hero, métricas, configuração de canais, preview de cartão
 * estilo Stamp Card e ranking com medalhas.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAdminRestaurantId, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { useRestaurant, useLoyaltyProgram, useLoyaltyMetrics, useSaveLoyaltyProgram, useAdminProducts } from '@/hooks/queries';
import type { LoyaltyProgram, LoyaltyScoringChannels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Gift,
  Star,
  Trophy,
  Loader2,
  Bike,
  LayoutGrid,
  Scale,
  HelpCircle,
  History,
} from 'lucide-react';

const CHANNELS: Array<{
  key: keyof LoyaltyScoringChannels;
  icon: typeof Bike;
  labelKey: string;
  tipKey: string;
}> = [
  { key: 'delivery', icon: Bike, labelKey: 'channelDelivery', tipKey: 'channelDeliveryTip' },
  { key: 'table', icon: LayoutGrid, labelKey: 'channelTable', tipKey: 'channelTableTip' },
  { key: 'buffet', icon: Scale, labelKey: 'channelBuffet', tipKey: 'channelBuffetTip' },
];

const defaultChannels: LoyaltyScoringChannels = {
  delivery: true,
  table: true,
  buffet: true,
};

export default function AdminLoyalty() {
  const restaurantId = useAdminRestaurantId();
  const basePath = useAdminBasePath();
  const navigate = useNavigate();
  const { t } = useAdminTranslation();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: program } = useLoyaltyProgram(restaurantId);
  const { data: metrics, isLoading: loadingMetrics } = useLoyaltyMetrics(
    restaurantId,
    program?.orders_required ?? 10
  );
  const { data: products = [] } = useAdminProducts(restaurantId);
  const saveMutation = useSaveLoyaltyProgram();

  const [form, setForm] = useState<Partial<LoyaltyProgram>>({
    enabled: program?.enabled ?? false,
    orders_required: program?.orders_required ?? 10,
    reward_description: program?.reward_description ?? '1 produto grátis',
    reward_product_id: program?.reward_product_id ?? undefined,
    scoring_channels: program?.scoring_channels ?? defaultChannels,
    points_validity_days: program?.points_validity_days ?? undefined,
  });
  const [previewPulse, setPreviewPulse] = useState(false);

  useEffect(() => {
    if (program) {
      setForm({
        enabled: program.enabled,
        orders_required: program.orders_required,
        reward_description: program.reward_description,
        scoring_channels: program.scoring_channels ?? defaultChannels,
        points_validity_days: program.points_validity_days ?? undefined,
      });
    }
  }, [program?.id, program?.enabled, program?.orders_required, program?.reward_description, program?.reward_product_id, program?.scoring_channels, program?.points_validity_days]);

  const handleSave = async () => {
    if (!restaurantId) return;
    try {
      await saveMutation.mutateAsync({
        restaurant_id: restaurantId,
        enabled: form.enabled ?? false,
        orders_required: Math.max(2, Math.min(100, form.orders_required ?? 10)),
        reward_description: (form.reward_description || '1 produto grátis').slice(0, 120),
        reward_product_id: form.reward_product_id || null,
        scoring_channels: form.scoring_channels ?? defaultChannels,
        points_validity_days: form.points_validity_days && form.points_validity_days > 0
          ? form.points_validity_days
          : null,
      });
      setPreviewPulse(true);
      setTimeout(() => setPreviewPulse(false), 600);
      toast({ title: t('common.success'), description: t('loyalty.sectionTitle') });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
  };

  const toggleChannel = (key: keyof LoyaltyScoringChannels) => {
    const ch = form.scoring_channels ?? { ...defaultChannels };
    setForm({
      ...form,
      scoring_channels: { ...ch, [key]: !ch[key] },
    });
  };

  const ordersRequired = Math.max(2, Math.min(100, form.orders_required ?? 10));
  const displayMax = Math.min(ordersRequired, 12);
  const completedDisplay = Math.min(Math.round((5 / ordersRequired) * displayMax), displayMax);

  return (
    <div className="space-y-6 pb-10">
        {/* ── Hero Section ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-violet-600 p-6 sm:p-8 text-white shadow-xl"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Gift className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t('loyalty.pageTitle')}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-white/90 max-w-xl">
              {t('loyalty.heroMessage', { name: restaurant?.name || 'seu restaurante' })}
            </p>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2)_0%,_transparent_50%)]" />
        </motion.div>

        {/* ── Métricas principais ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              label: t('loyalty.totalRedeemed'),
              value: loadingMetrics ? '—' : (metrics?.totalRedeemed ?? 0),
              icon: Gift,
              color: 'from-amber-50 to-orange-50 border-amber-200 text-amber-700',
              iconBg: 'bg-amber-100',
            },
            {
              label: t('loyalty.activeClients'),
              value: loadingMetrics ? '—' : (metrics?.activeClients ?? 0),
              icon: Trophy,
              color: 'from-violet-50 to-purple-50 border-violet-200 text-violet-700',
              iconBg: 'bg-violet-100',
            },
            {
              label: t('loyalty.totalPoints'),
              value: loadingMetrics ? '—' : (metrics?.totalPointsDistributed ?? 0),
              icon: Star,
              color: 'from-amber-50 to-yellow-50 border-amber-200 text-amber-800',
              iconBg: 'bg-amber-100',
            },
          ].map(({ label, value, icon: Icon, color, iconBg }) => (
            <div
              key={label}
              className={`rounded-xl border bg-gradient-to-br ${color} p-4 flex items-center gap-4 shadow-sm`}
            >
              <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-xs font-medium opacity-80">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Configuração do Jogo ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Star className="h-[18px] w-[18px] text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('loyalty.configTitle')}</h2>
              <p className="text-xs text-slate-500">{t('loyalty.sectionDesc')}</p>
            </div>
          </div>

          {/* Toggle ativar */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50 border border-slate-100 mb-5">
            <div>
              <p className="text-sm font-medium text-slate-800">{t('loyalty.toggleLabel')}</p>
              <p className="text-[11px] text-slate-500">{t('loyalty.toggleDesc')}</p>
            </div>
            <Switch
              checked={form.enabled ?? false}
              onCheckedChange={(v: boolean) => setForm({ ...form, enabled: v })}
              className="data-[state=checked]:bg-violet-500"
            />
          </div>

          {/* Canais de pontuação */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              {t('loyalty.channelsTitle')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CHANNELS.map(({ key, icon: Icon, labelKey, tipKey }) => {
                const enabled = (form.scoring_channels ?? defaultChannels)[key] ?? true;
                return (
                  <button
                    key={key}
                    type="button"
                    title={t(`loyalty.${tipKey}`)}
                    onClick={() => toggleChannel(key)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      enabled
                        ? 'border-violet-400 bg-violet-50 text-violet-800'
                        : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        enabled ? 'bg-violet-200' : 'bg-slate-200'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${enabled ? 'text-violet-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{t(`loyalty.${labelKey}`)}</p>
                      <p className="text-[10px] opacity-75 flex items-center gap-1">
                        {enabled ? 'Ativo' : 'Inativo'}
                        <HelpCircle className="h-3 w-3" />
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Regra de resgate + Validade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <Label className="text-xs font-medium">{t('loyalty.ordersRequired')}</Label>
              <Input
                type="number"
                min={2}
                max={100}
                value={form.orders_required ?? 10}
                onChange={(e) =>
                  setForm({
                    ...form,
                    orders_required: Math.max(2, Math.min(100, parseInt(e.target.value) || 10)),
                  })
                }
                className="mt-1"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{t('loyalty.ordersRequiredHint')}</p>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium">{t('loyalty.rewardLabel')}</Label>
              <Input
                value={form.reward_description ?? ''}
                onChange={(e) => setForm({ ...form, reward_description: e.target.value })}
                placeholder={t('loyalty.rewardPlaceholder')}
                maxLength={120}
                className="mt-1"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{t('loyalty.rewardHint')}</p>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium">{t('loyalty.rewardProductLabel')}</Label>
              <Select
                value={form.reward_product_id ?? 'none'}
                onValueChange={(v) => setForm({ ...form, reward_product_id: v === 'none' ? undefined : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('loyalty.rewardProductPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('loyalty.rewardProductNone')}</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500 mt-0.5">{t('loyalty.rewardProductHint')}</p>
            </div>
          </div>
          <div className="mb-5">
            <Label className="text-xs font-medium">{t('loyalty.validityLabel')}</Label>
            <Input
              type="number"
              min={1}
              max={365}
              placeholder={t('loyalty.validityPlaceholder')}
              value={form.points_validity_days ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                setForm({ ...form, points_validity_days: v && v > 0 ? v : undefined });
              }}
              className="mt-1 max-w-[140px]"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">{t('loyalty.validityHint')}</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !restaurantId}
            className="gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {t('loyalty.saveBtn')}
          </Button>
        </motion.div>

        {/* ── Preview do Cartão (Stamp Card) ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-6 transition-all ${
            previewPulse ? 'ring-4 ring-violet-300 ring-offset-2' : ''
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-3">
            Preview do cartão digital
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Selos estilo Stamp Card */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: displayMax }).map((_, i) => (
                <div
                  key={i}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    i < completedDisplay
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-200'
                      : 'bg-white border-2 border-dashed border-slate-200'
                  }`}
                >
                  {i < completedDisplay ? (
                    restaurant?.logo ? (
                      <img
                        src={restaurant.logo}
                        alt=""
                        className="h-6 w-6 rounded object-cover"
                      />
                    ) : (
                      <Star className="h-5 w-5 text-white" />
                    )
                  ) : (
                    <Star className="h-4 w-4 text-slate-300" />
                  )}
                </div>
              ))}
              {ordersRequired > 12 && (
                <span className="text-xs text-slate-500 self-center">+{ordersRequired - 12}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600">
                {completedDisplay} de {ordersRequired} pedidos — faltam {Math.max(0, ordersRequired - completedDisplay)}{' '}
                para ganhar: <strong>{form.reward_description || '—'}</strong>
              </p>
              {/* Barra de progresso */}
              <div className="mt-2 h-2 rounded-full bg-white/80 overflow-hidden border border-slate-100">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (completedDisplay / ordersRequired) * 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Ranking (Leaderboard) ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Trophy className="h-[18px] w-[18px] text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">{t('loyalty.topClientsTitle')}</h2>
          </div>

          {loadingMetrics ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (metrics?.topClients ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Nenhum cliente com pontos ainda. Ative o programa e conclua pedidos.
            </p>
          ) : (
            <div className="space-y-2">
              {(metrics!.topClients as Array<{ customer_phone: string; points: number; redeemed_count: number }>).map(
                (c, i) => (
                  <div
                    key={c.customer_phone}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Medalhas */}
                      <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                        {i === 0 ? (
                          <span className="text-amber-500" title="1º lugar">🥇</span>
                        ) : i === 1 ? (
                          <span className="text-slate-400" title="2º lugar">🥈</span>
                        ) : i === 2 ? (
                          <span className="text-amber-600" title="3º lugar">🥉</span>
                        ) : (
                          <span className="text-slate-400 text-xs">{i + 1}.</span>
                        )}
                      </span>
                      <span className="font-mono text-sm text-slate-800 truncate">{c.customer_phone}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-sm font-semibold text-violet-600">{c.points} pts</span>
                      {c.redeemed_count > 0 && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          {c.redeemed_count}x 🎁
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 gap-1 text-xs"
                        onClick={() =>
                          navigate(`${basePath}/orders?phone=${encodeURIComponent(c.customer_phone)}`)
                        }
                      >
                        <History className="h-3.5 w-3.5" />
                        {t('loyalty.viewOrderHistory')}
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </motion.div>
      </div>
  );
}
