import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  useSubscriptionPlans,
  useFeaturesCatalog,
  usePlanFeatures,
  useTogglePlanFeature,
  subscriptionKeys,
} from '@/hooks/queries/useSubscriptionManager';
import type { SubscriptionPlan, Feature } from '@/hooks/queries/useSubscriptionManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Check,
  Loader2,
  CreditCard,
  AlertCircle,
  Info,
  Puzzle,
} from 'lucide-react';

// ─── Visual por plano ─────────────────────────────────────────────────────────

const PLAN_STYLE: Record<string, {
  border:  string;
  header:  string;
  badge:   string;
  accent:  string;
  ring:    string;
}> = {
  core: {
    border: 'border-slate-200',
    header: 'bg-slate-50 border-b border-slate-200',
    badge:  'bg-slate-100 text-slate-600',
    accent: 'text-slate-600',
    ring:   'focus-visible:ring-slate-400',
  },
  standard: {
    border: 'border-orange-200',
    header: 'bg-orange-50 border-b border-orange-200',
    badge:  'bg-orange-100 text-orange-700',
    accent: 'text-orange-700',
    ring:   'focus-visible:ring-orange-400',
  },
  enterprise: {
    border: 'border-violet-200',
    header: 'bg-violet-50 border-b border-violet-200',
    badge:  'bg-violet-100 text-violet-700',
    accent: 'text-violet-700',
    ring:   'focus-visible:ring-violet-400',
  },
};

// ─── Estado de edição local por plano ─────────────────────────────────────────

interface PlanDraft {
  label:       string;
  description: string;
  price_brl:   string;  // string para controlar o input; converte em number no save
}

function toDraft(p: SubscriptionPlan): PlanDraft {
  return {
    label:       p.label,
    description: p.description ?? '',
    price_brl:   p.price_brl.toString(),
  };
}

// ─── Componente de card editável por plano ────────────────────────────────────

interface PlanCardProps {
  plan:    SubscriptionPlan;
  onSaved: () => void;
}

function PlanCard({ plan, onSaved }: PlanCardProps) {
  const style = PLAN_STYLE[plan.name] ?? PLAN_STYLE.core;
  const [draft, setDraft] = useState<PlanDraft>(() => toDraft(plan));
  const [saving, setSaving] = useState(false);

  // Detecta se há mudanças não salvas
  const original  = toDraft(plan);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(original);

  const set = (field: keyof PlanDraft, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const handleSave = async () => {
    const priceBrl = parseFloat(draft.price_brl.replace(',', '.'));

    if (isNaN(priceBrl) || priceBrl < 0) {
      toast({
        title: 'Preço inválido',
        description: 'Digite um valor numérico positivo para o preço em BRL.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          label:       draft.label.trim(),
          description: draft.description.trim() || null,
          price_brl:   priceBrl,
        })
        .eq('id', plan.id);

      if (error) throw error;

      toast({
        title: 'Plano atualizado',
        description: `As alterações do plano ${draft.label} foram salvas.`,
        variant: 'default',
      });
      onSaved();
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-2xl border ${style.border} bg-white shadow-sm overflow-hidden`}>
      {/* Header do card */}
      <div className={`px-6 py-4 ${style.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className={`h-4 w-4 ${style.accent}`} />
            <h3 className="font-bold text-slate-800">{plan.name.toUpperCase()}</h3>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
              Plano {plan.sort_order}
            </span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700`}>
            Ativo
          </span>
        </div>

        {/* Nota de segurança */}
        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <Info className="h-3 w-3 flex-shrink-0" />
          O campo <code className="font-mono bg-slate-200/60 px-1 rounded">name</code> não é editável
          — é o identificador técnico usado pelas feature flags.
        </p>
      </div>

      {/* Campos editáveis */}
      <div className="px-6 py-5 space-y-4">

        {/* Label / Nome de exibição */}
        <div className="space-y-1.5">
          <Label htmlFor={`label-${plan.id}`} className="text-xs font-semibold text-slate-600">
            Nome de Exibição
          </Label>
          <Input
            id={`label-${plan.id}`}
            value={draft.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="Ex: Standard"
            className="h-9 text-sm"
          />
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label htmlFor={`desc-${plan.id}`} className="text-xs font-semibold text-slate-600">
            Descrição
          </Label>
          <textarea
            id={`desc-${plan.id}`}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descreva o que está incluso neste plano..."
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Preço */}
        <div className="space-y-1.5">
          <Label htmlFor={`price-brl-${plan.id}`} className="text-xs font-semibold text-slate-600">
            Preço (R$ / mês)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
              R$
            </span>
            <Input
              id={`price-brl-${plan.id}`}
              value={draft.price_brl}
              onChange={(e) => set('price_brl', e.target.value)}
              placeholder="0.00"
              className="h-9 pl-8 text-sm font-mono"
            />
          </div>
        </div>

        {/* Botão salvar */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-2"
            size="sm"
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
          {hasChanges && !saving && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Há alterações não salvas
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Ordem das categorias nas tabs ────────────────────────────────────────────

const CATEGORY_ORDER = [
  'Operação & Cozinha',
  'Salão & PDV',
  'Delivery & Logística',
  'Gestão & BI',
  'Marketing',
  'Geral',
] as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Plans() {
  const qc = useQueryClient();
  const { data: plans = [], isLoading, isError } = useSubscriptionPlans();
  const { data: features = [], isLoading: loadingFeatures } = useFeaturesCatalog();

  const corePlan = plans.find((p) => p.name === 'core');
  const standardPlan = plans.find((p) => p.name === 'standard');
  const enterprisePlan = plans.find((p) => p.name === 'enterprise');

  const { data: coreFeatures = [] } = usePlanFeatures(corePlan?.id);
  const { data: standardFeatures = [] } = usePlanFeatures(standardPlan?.id);
  const { data: enterpriseFeatures = [] } = usePlanFeatures(enterprisePlan?.id);

  const coreFeatureIds = new Set(coreFeatures.map((pf) => pf.feature_id));
  const standardFeatureIds = new Set(standardFeatures.map((pf) => pf.feature_id));
  const enterpriseFeatureIds = new Set(enterpriseFeatures.map((pf) => pf.feature_id));

  const toggleCore = useTogglePlanFeature(corePlan?.id ?? '');
  const toggleStandard = useTogglePlanFeature(standardPlan?.id ?? '');
  const toggleEnterprise = useTogglePlanFeature(enterprisePlan?.id ?? '');

  const featuresByCategory = features.reduce<Record<string, Feature[]>>((acc, f) => {
    const cat = f.category ?? 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const knownCategories = CATEGORY_ORDER.filter((c) => (featuresByCategory[c]?.length ?? 0) > 0);
  const otherCategories = Object.keys(featuresByCategory).filter(
    (k) => !(CATEGORY_ORDER as readonly string[]).includes(k),
  );
  const categories = [...knownCategories, ...otherCategories];

  const handlePlanSaved = () => {
    qc.invalidateQueries({ queryKey: subscriptionKeys.plans() });
  };

  const handleToggleFeature = async (
    planName: 'core' | 'standard' | 'enterprise',
    featureId: string,
    included: boolean,
  ) => {
    const plan = planName === 'core' ? corePlan : planName === 'standard' ? standardPlan : enterprisePlan;
    const mutation = planName === 'core' ? toggleCore : planName === 'standard' ? toggleStandard : toggleEnterprise;
    if (!plan?.id) return;
    try {
      await mutation.mutateAsync({ featureId, included });
      toast({
        title: included ? 'Feature adicionada' : 'Feature removida',
        description: `Plano ${plan.label} atualizado.`,
      });
    } catch (err) {
      toast({ title: 'Erro ao atualizar plano', description: String(err), variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-slate-400">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p className="font-semibold text-slate-600">Nenhum plano encontrado.</p>
        <p className="text-sm text-center max-w-sm">
          Execute a migration <code>20260219_init_access_control.sql</code> para criar os planos iniciais.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planos & Preços</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Edite o nome de exibição, descrição, preços e features de cada plano de assinatura.
        </p>
      </div>

      {/* Aviso de segurança */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>Atenção:</strong> Alterações de preço afetam a exibição na página de planos mas{' '}
          <strong>não cancelam ou alteram assinaturas existentes</strong> automaticamente.
          Comunique mudanças de preço aos clientes antes de salvar.
        </p>
      </div>

      {/* Cards de planos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSaved={handlePlanSaved} />
        ))}
      </div>

      {/* Card: Features por Plano */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Puzzle className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base">Features por Plano</CardTitle>
              <CardDescription>
                Marque quais features cada plano inclui. Agrupadas por categoria.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFeatures ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : features.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">
              Nenhuma feature cadastrada. Execute as migrations de acesso no Supabase.
            </p>
          ) : (
            <Tabs defaultValue={categories[0] ?? 'Geral'} className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-slate-100/80 w-full mb-4">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {/* Header da tabela */}
                <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <span>Feature</span>
                  <span className="text-center">Core</span>
                  <span className="text-center">Standard</span>
                  <span className="text-center">Enterprise</span>
                </div>
                {categories.map((cat) => (
                  <TabsContent key={cat} value={cat} className="mt-0">
                    {(featuresByCategory[cat] ?? []).map((feature) => (
                      <PlanFeatureRow
                        key={feature.id}
                        feature={feature}
                        coreIncluded={coreFeatureIds.has(feature.id)}
                        standardIncluded={standardFeatureIds.has(feature.id)}
                        enterpriseIncluded={enterpriseFeatureIds.has(feature.id)}
                        onToggle={handleToggleFeature}
                        isLoading={{
                          core: toggleCore.isPending && toggleCore.variables?.featureId === feature.id,
                          standard: toggleStandard.isPending && toggleStandard.variables?.featureId === feature.id,
                          enterprise: toggleEnterprise.isPending && toggleEnterprise.variables?.featureId === feature.id,
                        }}
                      />
                    ))}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Legenda de slug */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Identificadores técnicos (não editáveis)
        </p>
        <div className="flex flex-wrap gap-2">
          {plans.map((p) => (
            <Badge key={p.id} variant="outline" className="font-mono text-xs">
              {p.name}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Os slugs técnicos são usados internamente pelas feature flags e não podem ser alterados
          sem impactar a lógica do sistema.
        </p>
      </div>
    </div>
  );
}

// ─── Linha de feature na tabela de planos ─────────────────────────────────────

interface PlanFeatureRowProps {
  feature: Feature;
  coreIncluded: boolean;
  standardIncluded: boolean;
  enterpriseIncluded: boolean;
  onToggle: (plan: 'core' | 'standard' | 'enterprise', featureId: string, included: boolean) => void;
  isLoading: { core: boolean; standard: boolean; enterprise: boolean };
}

function PlanFeatureRow({
  feature,
  coreIncluded,
  standardIncluded,
  enterpriseIncluded,
  onToggle,
  isLoading,
}: PlanFeatureRowProps) {
  const planStyle = (plan: string) =>
    PLAN_STYLE[plan] ?? PLAN_STYLE.core;

  return (
    <div
      className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-3 items-center border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
    >
      <div className="min-w-0">
        <span className="text-sm font-medium text-slate-800">{feature.label}</span>
        <span
          className={`ml-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${planStyle(feature.min_plan).badge}`}
        >
          {feature.min_plan}
        </span>
      </div>
      <div className="flex justify-center">
        {isLoading.core ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <Checkbox
            checked={coreIncluded}
            onCheckedChange={(checked) =>
              onToggle('core', feature.id, checked === true)
            }
            aria-label={`${feature.label} no Core`}
          />
        )}
      </div>
      <div className="flex justify-center">
        {isLoading.standard ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <Checkbox
            checked={standardIncluded}
            onCheckedChange={(checked) =>
              onToggle('standard', feature.id, checked === true)
            }
            aria-label={`${feature.label} no Standard`}
          />
        )}
      </div>
      <div className="flex justify-center">
        {isLoading.enterprise ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <Checkbox
            checked={enterpriseIncluded}
            onCheckedChange={(checked) =>
              onToggle('enterprise', feature.id, checked === true)
            }
            aria-label={`${feature.label} no Enterprise`}
          />
        )}
      </div>
    </div>
  );
}
