import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isUUID } from '@/hooks/useResolveRestaurantId';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  useSubscriptionPlans,
  useFeaturesCatalog,
  usePlanFeatures,
  useRestaurantSubscription,
  useFeatureOverrides,
  useUpdateSubscription,
  useToggleFeatureOverride,
  type Feature,
} from '@/hooks/queries/useSubscriptionManager';
import {
  ArrowLeft,
  CreditCard,
  Puzzle,
  Check,
  Info,
  Loader2,
  Store,
  AlertCircle,
  Zap,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ─── Mapeamento de módulos para labels amigáveis ──────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  menu_publico:     'Cardápio Público',
  pedidos:          'Pedidos',
  cardapio_admin:   'Cardápio (Admin)',
  buffet:           'Buffet & Comandas',
  mesas:            'Mesas & Salão',
  entregadores:     'Entregadores',
  delivery:         'Delivery & Zonas',
  inventario:       'Inventário & Financeiro',
  dashboard:        'BI & Analytics',
  cozinha:          'Cozinha (KDS)',
  configuracoes:    'Configurações',
};

const PLAN_COLORS: Record<string, { badge: string; bg: string; text: string; border: string }> = {
  core:       { badge: 'bg-slate-100 text-slate-700 border-slate-200',   bg: 'bg-slate-50',  text: 'text-slate-700', border: 'border-slate-200' },
  standard:   { badge: 'bg-blue-100 text-blue-700 border-blue-200',      bg: 'bg-blue-50',   text: 'text-blue-700',  border: 'border-blue-200'  },
  enterprise: { badge: 'bg-amber-100 text-amber-700 border-amber-200',   bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200' },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RestaurantDetails() {
  /**
   * :identifier pode ser slug amigável ("pizzaria-do-joao") ou UUID bruto.
   * Usamos o hook useResolveRestaurantId para obter o UUID real do restaurante,
   * que é necessário para todas as queries/mutations no Supabase.
   */
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Dados do restaurante — busca por slug OU por id dependendo do formato do identifier.
  const { data: restaurant, isLoading: loadingRestaurant } = useQuery({
    queryKey: ['restaurant-by-identifier', identifier],
    queryFn: async () => {
      if (!identifier) return null;

      /**
       * Estratégia de lookup:
       *   - Se o identifier é um UUID válido → consulta direto por `id`.
       *   - Se parece um slug → consulta por `slug`.
       * Isso evita passar um texto não-UUID para uma coluna UUID no Postgres,
       * o que causaria um erro de cast.
       */
      const column = isUUID(identifier) ? 'id' : 'slug';

      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo, is_active')
        .eq(column, identifier)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!identifier,
  });

  /**
   * ID real do restaurante (UUID) para uso em todas as queries/mutations filhas.
   * Só fica disponível após o fetch acima concluir.
   * Enquanto `restaurant` é null/undefined, as queries filhas ficam desabilitadas.
   */
  const restaurantId = restaurant?.id ?? null;

  // Dados de assinatura e features — todas as queries usam o UUID real (restaurantId).
  const { data: plans = [], isLoading: loadingPlans } = useSubscriptionPlans();
  const { data: features = [], isLoading: loadingFeatures } = useFeaturesCatalog();
  const { data: subscription, isLoading: loadingSubscription } = useRestaurantSubscription(restaurantId);
  const { data: overrides = [], isLoading: loadingOverrides } = useFeatureOverrides(restaurantId);

  // Plan atual (por id no banco ou selecionado no dropdown)
  const activePlanId = selectedPlanId ?? subscription?.plan_id ?? null;
  const { data: planFeatures = [] } = usePlanFeatures(activePlanId);

  // Mutations — também precisam do UUID real.
  const updateSubscription = useUpdateSubscription(restaurantId ?? '');
  const toggleOverride = useToggleFeatureOverride(restaurantId ?? '');

  const isLoading = loadingRestaurant || loadingPlans || loadingFeatures || loadingSubscription || loadingOverrides;

  // Plano selecionado no dropdown (objeto completo)
  const activePlan = plans.find((p) => p.id === activePlanId);
  // Conjunto de feature_ids incluídos no plano atual (para lógica visual)
  const planFeatureIds = new Set(planFeatures.map((pf) => pf.feature_id));
  // Map de override por feature_id
  const overrideMap = new Map(overrides.map((o) => [o.feature_id, o]));

  // Agrupar features por módulo
  const featuresByModule = features.reduce<Record<string, Feature[]>>((acc, f) => {
    const mod = f.module || 'outros';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(f);
    return acc;
  }, {});

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSavePlan = async () => {
    if (!activePlanId) return;
    setSavingPlan(true);
    try {
      await updateSubscription.mutateAsync(activePlanId);
      setSelectedPlanId(null); // reseta seleção após salvar
      toast({ title: 'Plano atualizado', description: `Plano ${activePlan?.label} aplicado com sucesso.` });
    } catch (err) {
      toast({ title: 'Erro ao salvar plano', description: String(err), variant: 'destructive' });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleToggleOverride = async (featureId: string, newState: boolean) => {
    try {
      await toggleOverride.mutateAsync({ featureId, isEnabled: newState });
      toast({
        title: newState ? 'Feature habilitada' : 'Override removido',
        description: newState
          ? 'A feature foi liberada para este restaurante.'
          : 'O restaurante voltará a usar o acesso padrão do plano.',
      });
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const planChanged = selectedPlanId !== null && selectedPlanId !== subscription?.plan_id;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-800 -ml-2"
            onClick={() => navigate('/super-admin')}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Super Admin
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-3 min-w-0">
            {restaurant?.logo ? (
              <img src={restaurant.logo} alt={restaurant.name} className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Store className="h-4 w-4 text-orange-500" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">{restaurant?.name}</h1>
              <p className="text-xs text-slate-400 truncate">{restaurant?.slug}</p>
            </div>
          </div>
          <div className="ml-auto">
            <Badge variant={restaurant?.is_active ? 'default' : 'secondary'}>
              {restaurant?.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── Alerta: slug ausente ────────────────────────────────────────── */}
        {/*
         * Exibido quando o restaurante foi carregado com sucesso mas não possui
         * um slug configurado. Isso significa que os links estão usando o UUID
         * como fallback, o que dificulta a identificação visual nas URLs.
         */}
        {restaurant && !restaurant.slug && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Este restaurante ainda não possui um link personalizado (slug)
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Configure um slug nas configurações do restaurante para melhor organização.
                Sem slug, os links usam o UUID bruto como identificador na URL.
              </p>
            </div>
            <button
              onClick={() => navigate(`/super-admin/restaurants/${restaurantId}`)}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <Settings className="h-3 w-3" />
              Ir para Admin
            </button>
          </div>
        )}

        {/* ── Card: Plano Atual ───────────────────────────────────────────── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-base">Plano Atual</CardTitle>
                <CardDescription>Selecione e salve o plano de assinatura deste restaurante.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Aviso: sem assinatura cadastrada */}
            {!subscription && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <span>Este restaurante ainda não possui um plano cadastrado. Selecione um plano abaixo e salve.</span>
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Plano de assinatura</label>
                <Select
                  value={activePlanId ?? ''}
                  onValueChange={(val) => setSelectedPlanId(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um plano…" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => {
                      const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.core;
                      return (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colors.badge}`}>
                              {plan.label}
                            </span>
                            <span className="text-sm text-slate-600">
                              {plan.price_brl > 0
                                ? formatCurrency(plan.price_brl) + '/mês'
                                : 'Grátis'}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSavePlan}
                disabled={!planChanged || savingPlan}
                className="bg-[#F87116] hover:bg-[#ea580c] text-white"
              >
                {savingPlan ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando…</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" />Salvar plano</>
                )}
              </Button>
            </div>

            {/* Detalhes do plano selecionado */}
            {activePlan && (
              <div className={`p-4 rounded-lg border ${PLAN_COLORS[activePlan.name]?.bg ?? ''} ${PLAN_COLORS[activePlan.name]?.border ?? ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${PLAN_COLORS[activePlan.name]?.text ?? ''}`}>
                    {activePlan.label}
                  </span>
                  {!planChanged && subscription?.status && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {subscription.status === 'active' ? 'Ativo' : subscription.status}
                    </Badge>
                  )}
                  {planChanged && (
                    <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-300">
                      Não salvo
                    </Badge>
                  )}
                </div>
                {activePlan.description && (
                  <p className="text-sm text-slate-600">{activePlan.description}</p>
                )}
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {activePlan.price_brl > 0 ? `${formatCurrency(activePlan.price_brl)}/mês` : 'Grátis'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Card: Funcionalidades (Overrides) ──────────────────────────── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Puzzle className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Funcionalidades (Overrides)</CardTitle>
                <CardDescription>
                  Features incluídas no plano são marcadas automaticamente. Você pode habilitar extras individualmente.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Legenda */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 border-b border-slate-100 pb-4">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-green-500" />
                Incluso no plano (não editável)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-orange-400" />
                Override ativo (extra liberado)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-slate-200" />
                Bloqueado / não contratado
              </span>
            </div>

            {/* Features agrupadas por módulo */}
            {Object.entries(featuresByModule).map(([module, moduleFeatures]) => (
              <div key={module}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 px-1">
                  {MODULE_LABELS[module] ?? module}
                </h3>
                <div className="space-y-1">
                  {moduleFeatures.map((feature) => {
                    const isInPlan  = planFeatureIds.has(feature.id);
                    const override  = overrideMap.get(feature.id);
                    const isEnabled = isInPlan || (override?.is_enabled ?? false);
                    const isTogglingThis = toggleOverride.isPending &&
                      toggleOverride.variables?.featureId === feature.id;

                    const planColor = PLAN_COLORS[feature.min_plan] ?? PLAN_COLORS.core;

                    return (
                      <FeatureRow
                        key={feature.id}
                        feature={feature}
                        isInPlan={isInPlan}
                        isEnabled={isEnabled}
                        isLoading={isTogglingThis}
                        planColor={planColor}
                        onToggle={(val) => handleToggleOverride(feature.id, val)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {features.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma feature cadastrada. Execute a migração <code>20260219_init_access_control.sql</code> no Supabase.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ─── Sub-componente: linha de uma feature ────────────────────────────────────

interface FeatureRowProps {
  feature: Feature;
  isInPlan: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  planColor: { badge: string; bg: string; text: string; border: string };
  onToggle: (val: boolean) => void;
}

function FeatureRow({ feature, isInPlan, isEnabled, isLoading, planColor, onToggle }: FeatureRowProps) {
  return (
    <div
      className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors ${
        isInPlan
          ? 'bg-green-50/60 border border-green-100'
          : isEnabled
          ? 'bg-orange-50/40 border border-orange-100'
          : 'bg-white border border-slate-100 hover:bg-slate-50'
      }`}
    >
      {/* Nome e descrição */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{feature.label}</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${planColor.badge}`}>
            {feature.min_plan}
          </span>
          {isInPlan && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <Check className="h-2.5 w-2.5" />
              Incluso no plano
            </span>
          )}
          {!isInPlan && isEnabled && (
            <span className="text-[10px] font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              Override ativo
            </span>
          )}
        </div>
        {feature.description && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{feature.description}</p>
        )}
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <Switch
            checked={isEnabled}
            disabled={isInPlan} // Não pode desativar o que está no plano
            onCheckedChange={onToggle}
            className={isInPlan ? 'data-[state=checked]:bg-green-500' : undefined}
            aria-label={`Toggle ${feature.label}`}
          />
        )}
      </div>
    </div>
  );
}
