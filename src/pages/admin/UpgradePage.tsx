import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import {
  useRestaurantSubscription,
  useSubscriptionPlans,
} from '@/hooks/queries/useSubscriptionManager';
import {
  Check,
  X,
  Lock,
  Sparkles,
  ArrowLeft,
  MessageCircle,
  Zap,
  CreditCard,
} from 'lucide-react';

// ─── Número de WhatsApp do suporte comercial ─────────────────────────────────
// Altere aqui para o número real: formato internacional sem + (ex: 5511999998888)
const WHATSAPP_SUPPORT = '5511999998888';

// ─── Dados estáticos da tabela de comparação (seção 3.2 do documento) ─────────

interface FeatureRow {
  label: string;
  core: boolean;
  standard: boolean;
  enterprise: boolean;
  highlight?: boolean; // destaque visual (Enterprise-only)
}

interface FeatureGroup {
  label: string;
  rows: FeatureRow[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: 'Cardápio & Pedidos',
    rows: [
      { label: 'Cardápio interativo público',        core: true,  standard: true,  enterprise: true  },
      { label: 'Receber pedidos (Kanban)',            core: true,  standard: true,  enterprise: true  },
      { label: 'Cancelar pedidos',                   core: true,  standard: true,  enterprise: true  },
      { label: 'Pedidos de mesa via QR Code',         core: false, standard: true,  enterprise: true  },
      { label: 'Notificação de status via WhatsApp',  core: false, standard: true,  enterprise: true  },
      { label: 'Impressão térmica automática',        core: false, standard: true,  enterprise: true  },
      { label: 'Exportação de pedidos (CSV)',          core: false, standard: true,  enterprise: true  },
    ],
  },
  {
    label: 'Cardápio Administrativo',
    rows: [
      { label: 'CRUD básico de produtos',              core: true,  standard: true,  enterprise: true  },
      { label: 'Gerenciamento de categorias',          core: true,  standard: true,  enterprise: true  },
      { label: 'Upload de imagem de produtos',         core: false, standard: true,  enterprise: true  },
      { label: 'Config. de Pizza / Marmita',           core: false, standard: true,  enterprise: true  },
      { label: 'Drag & drop de produtos',              core: false, standard: true,  enterprise: true  },
    ],
  },
  {
    label: 'Delivery & Salão',
    rows: [
      { label: 'Delivery com zonas de entrega',       core: false, standard: true,  enterprise: true  },
      { label: 'Gestão de entregadores',              core: false, standard: true,  enterprise: true  },
      { label: 'Mesas & QR Codes',                    core: false, standard: true,  enterprise: true  },
      { label: 'Chamada de garçom',                   core: false, standard: true,  enterprise: true  },
    ],
  },
  {
    label: 'Marca & Configurações',
    rows: [
      { label: 'Configurações básicas',               core: true,  standard: true,  enterprise: true  },
      { label: 'Personalização de marca (logo/cores)', core: false, standard: true,  enterprise: true  },
      { label: 'Múltiplos idiomas / moedas',          core: false, standard: true,  enterprise: true  },
      { label: 'Impressão (configuração 58/80mm)',     core: false, standard: true,  enterprise: true  },
    ],
  },
  {
    label: 'Analytics & BI',
    rows: [
      { label: 'KPIs básicos de dashboard',           core: true,  standard: true,  enterprise: true  },
      { label: 'Gráficos de faturamento e canais',    core: false, standard: true,  enterprise: true  },
      { label: 'Exportação de relatórios (CSV/XLSX)', core: false, standard: true,  enterprise: true  },
      { label: 'BI: Análise de Retenção',             core: false, standard: false, enterprise: true, highlight: true },
      { label: 'BI: Risco de Churn + WhatsApp',       core: false, standard: false, enterprise: true, highlight: true },
      { label: 'BI: Matriz BCG de Produtos',          core: false, standard: false, enterprise: true, highlight: true },
      { label: 'Filtros avançados de período',        core: false, standard: false, enterprise: true, highlight: true },
    ],
  },
  {
    label: 'Buffet & Inventário',
    rows: [
      { label: 'Módulo Buffet completo (comandas)',   core: false, standard: false, enterprise: true, highlight: true },
      { label: 'Operação offline-first',              core: false, standard: false, enterprise: true, highlight: true },
      { label: 'Inventário com custo e CMV',          core: false, standard: false, enterprise: true, highlight: true },
      { label: 'Importação/Exportação de produtos',  core: false, standard: false, enterprise: true, highlight: true },
    ],
  },
  {
    label: 'Cozinha & Equipe',
    rows: [
      { label: 'Display de cozinha (KDS)',            core: true,  standard: true,  enterprise: true  },
      { label: 'Usuários adicionais com cargos (RBAC)', core: false, standard: false, enterprise: true, highlight: true },
    ],
  },
];

// ─── Configuração visual de cada plano ───────────────────────────────────────

const PLAN_CONFIG: Record<string, {
  label: string;
  badge?: string;
  tagline: string;
  gradient: string;
  headerBg: string;
  headerText: string;
  border: string;
  ring: string;
  ctaBg: string;
  ctaHover: string;
  badgeBg: string;
  badgeText: string;
  checkColor: string;
}> = {
  core: {
    label: 'Core',
    tagline: 'Para começar a digitalizar',
    gradient: 'from-slate-50 to-white',
    headerBg: 'bg-slate-800',
    headerText: 'text-slate-100',
    border: 'border-slate-200',
    ring: 'ring-slate-200',
    ctaBg: 'bg-slate-800 hover:bg-slate-900',
    ctaHover: '',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    checkColor: 'text-slate-500',
  },
  standard: {
    label: 'Standard',
    badge: 'Mais Popular',
    tagline: 'Para restaurantes em crescimento',
    gradient: 'from-orange-50 to-white',
    headerBg: 'bg-gradient-to-br from-[#F87116] to-[#ea580c]',
    headerText: 'text-white',
    border: 'border-[#F87116]',
    ring: 'ring-2 ring-[#F87116] ring-offset-2',
    ctaBg: 'bg-[#F87116] hover:bg-[#ea580c]',
    ctaHover: '',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    checkColor: 'text-[#F87116]',
  },
  enterprise: {
    label: 'Enterprise',
    tagline: 'Para redes e alto volume',
    gradient: 'from-violet-50 to-white',
    headerBg: 'bg-gradient-to-br from-violet-700 to-purple-900',
    headerText: 'text-white',
    border: 'border-violet-300',
    ring: 'ring-violet-200',
    ctaBg: 'bg-violet-700 hover:bg-violet-800',
    ctaHover: '',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    checkColor: 'text-violet-600',
  },
};

// ─── Helper: formata preço do banco ──────────────────────────────────────────

function formatPrice(priceBrl: number): string {
  if (priceBrl === 0) return 'Gratuito';
  return `R$\u00a0${priceBrl.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/mês`;
}

// ─── Helper: gera URL do WhatsApp com mensagem pré-preenchida ─────────────────

function buildWhatsAppUrl(restaurantName: string, planLabel: string): string {
  const msg = encodeURIComponent(
    `Olá! Sou do restaurante ${restaurantName} e quero fazer upgrade para o plano ${planLabel}.`,
  );
  return `https://wa.me/${WHATSAPP_SUPPORT}?text=${msg}`;
}

// ─── Ícones de check/x da tabela comparativa ─────────────────────────────────

function CheckIcon({ has, planKey }: { has: boolean; planKey: string }) {
  const { checkColor } = PLAN_CONFIG[planKey];
  if (has) {
    return <Check className={`h-4 w-4 mx-auto ${checkColor}`} strokeWidth={2.5} />;
  }
  return <X className="h-4 w-4 mx-auto text-slate-200" strokeWidth={2} />;
}

// ─── Mapeamento de feature flag → info contextual ────────────────────────────

const FEATURE_INFO: Record<string, { label: string; planRequired: string; description: string }> = {
  feature_buffet_module:       { label: 'Módulo Buffet',              planRequired: 'enterprise', description: 'Gerencie comandas, escaneie produtos e opere 100% offline.' },
  feature_tables:              { label: 'Mesas & QR Codes',            planRequired: 'standard',   description: 'Crie mesas virtuais, gere QR Codes e receba chamadas de garçom.' },
  feature_couriers:            { label: 'Gestão de Entregadores',      planRequired: 'standard',   description: 'Cadastre entregadores, controle o status e vincule aos pedidos.' },
  feature_delivery_zones:      { label: 'Zonas de Entrega',            planRequired: 'standard',   description: 'Configure bairros com taxas personalizadas exibidas no checkout.' },
  feature_bcg_matrix:          { label: 'Matriz BCG de Produtos',      planRequired: 'enterprise', description: 'Classifique seu cardápio em Estrelas, Vacas, Interrogações e Abacaxis.' },
  feature_churn_recovery:      { label: 'Recuperação de Churn',        planRequired: 'enterprise', description: 'Identifique clientes em risco e contacte-os via WhatsApp.' },
  feature_retention_analytics: { label: 'Análise de Retenção',         planRequired: 'enterprise', description: 'Veja a taxa de clientes recorrentes e tendência de fidelização.' },
  feature_inventory_cost:      { label: 'Inventário com CMV',          planRequired: 'enterprise', description: 'Controle custo de insumos, CMV e margem de lucro por produto.' },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UpgradePage() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const restaurantId = useAdminRestaurantId();
  const { data: restaurant } = useRestaurant(restaurantId);

  // Assinatura atual e catálogo de planos
  const { data: subscription, isLoading: loadingSub } = useRestaurantSubscription(restaurantId);
  const { data: plans = [], isLoading: loadingPlans } = useSubscriptionPlans();

  // Feature que causou o bloqueio (opcional — vem do state de navegação)
  const blockedFeatureFlag = (location.state as { feature?: string } | null)?.feature ?? '';
  const blockedFeatureInfo = FEATURE_INFO[blockedFeatureFlag];

  const isLoading = loadingSub || loadingPlans;
  const restaurantName = restaurant?.name ?? 'meu restaurante';

  // Plano atual do restaurante
  const currentPlan = plans.find((p) => p.id === subscription?.plan_id);
  const currentPlanName = currentPlan?.name ?? 'core'; // sem assinatura → trata como Core

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* ── Navegação ─────────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {/* ── Banner contextual (só aparece quando vindo de um bloqueio) ──── */}
        {blockedFeatureInfo && (
          <div className="mb-10 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-200/60 text-amber-600">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {blockedFeatureInfo.label} não está disponível no seu plano atual
              </p>
              <p className="mt-0.5 text-sm text-amber-700">{blockedFeatureInfo.description}</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-200/60 px-3 py-0.5 text-xs font-semibold text-amber-800">
                <Sparkles className="h-3 w-3" />
                Disponível no plano {PLAN_CONFIG[blockedFeatureInfo.planRequired]?.label}
              </p>
            </div>
          </div>
        )}

        {/* ── Título ─────────────────────────────────────────────────────── */}
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-orange-700">
            <CreditCard className="h-3.5 w-3.5" />
            Planos & Assinatura
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Escolha o plano ideal para o seu restaurante
          </h1>
          <p className="mt-3 text-base text-slate-500 max-w-xl mx-auto">
            Todos os planos incluem suporte, atualizações e as funcionalidades essenciais.
            Faça upgrade a qualquer momento.
          </p>
        </div>

        {/* ── Cards de planos (3 colunas) ────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-start">
            {plans.map((plan) => {
              const cfg = PLAN_CONFIG[plan.name] ?? PLAN_CONFIG.core;
              const isCurrent = plan.name === currentPlanName;
              const isPopular = !!cfg.badge;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${cfg.gradient} ${cfg.border} shadow-sm transition-shadow hover:shadow-md ${isPopular ? `${cfg.ring}` : ''}`}
                >
                  {/* Badge "Mais Popular" */}
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-bold shadow-sm ${cfg.badgeBg} ${cfg.badgeText}`}>
                        <Sparkles className="h-3 w-3" />
                        {cfg.badge}
                      </span>
                    </div>
                  )}

                  {/* Header do card */}
                  <div className={`rounded-t-2xl px-6 py-6 ${cfg.headerBg}`}>
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-1 opacity-70 ${cfg.headerText}`}>
                      {cfg.tagline}
                    </p>
                    <h2 className={`text-2xl font-bold ${cfg.headerText}`}>{cfg.label}</h2>
                    <div className="mt-3">
                      {isLoading ? (
                        <Skeleton className="h-7 w-28" />
                      ) : (
                        <span className={`text-3xl font-extrabold ${cfg.headerText}`}>
                          {formatPrice(plan.price_brl)}
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className={`mt-2 text-sm opacity-75 ${cfg.headerText}`}>{plan.description}</p>
                    )}
                  </div>

                  {/* Destaques rápidos do plano */}
                  <div className="flex-1 px-6 py-5 space-y-2.5">
                    {FEATURE_GROUPS.map((group) =>
                      group.rows
                        .filter((row) => {
                          if (plan.name === 'core') return row.core;
                          if (plan.name === 'standard') return row.standard && !row.core;
                          // enterprise → mostra somente os exclusivos (enterprise only)
                          return row.enterprise && !row.standard;
                        })
                        .slice(0, 4) // máximo 4 por grupo para manter cards concisos
                        .map((row) => (
                          <div key={row.label} className="flex items-start gap-2.5 text-sm text-slate-700">
                            <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.checkColor}`} strokeWidth={2.5} />
                            <span>{row.label}</span>
                          </div>
                        ))
                    ).flat().slice(0, 7)}

                    {/* "+ Tudo do plano X" para planos superiores */}
                    {plan.name === 'standard' && (
                      <div className="flex items-start gap-2.5 text-sm text-slate-500 italic">
                        <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.checkColor}`} strokeWidth={2.5} />
                        <span>Tudo do plano Core</span>
                      </div>
                    )}
                    {plan.name === 'enterprise' && (
                      <div className="flex items-start gap-2.5 text-sm text-slate-500 italic">
                        <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.checkColor}`} strokeWidth={2.5} />
                        <span>Tudo do plano Standard</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6">
                    {isCurrent ? (
                      <div className="flex flex-col items-center gap-2">
                        <button
                          disabled
                          className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-2.5 text-sm font-semibold text-slate-400 cursor-not-allowed"
                        >
                          ✓ Seu Plano Atual
                        </button>
                        {subscription?.status === 'trial' && (
                          <p className="text-xs text-amber-600 font-medium">
                            Período de teste ativo
                          </p>
                        )}
                      </div>
                    ) : (
                      <a
                        href={buildWhatsAppUrl(restaurantName, cfg.label)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md ${cfg.ctaBg}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Quero este Plano
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tabela de comparação completa ─────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_100px_100px_100px] bg-slate-900 text-white">
            <div className="px-5 py-4 text-sm font-semibold">Funcionalidade</div>
            {(['core', 'standard', 'enterprise'] as const).map((planKey) => {
              const cfg = PLAN_CONFIG[planKey];
              const planRecord = plans.find((p) => p.name === planKey);
              const isCurrent = planKey === currentPlanName;
              return (
                <div key={planKey} className={`px-2 py-4 text-center ${planKey === 'standard' ? 'bg-[#F87116]/20' : ''}`}>
                  <p className="text-xs font-bold uppercase tracking-wider">{cfg.label}</p>
                  {isCurrent && (
                    <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                      Atual
                    </span>
                  )}
                  {planRecord && !isCurrent && (
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatPrice(planRecord.price_brl)}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grupos de features */}
          {FEATURE_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Separador de grupo */}
              <div className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_100px_100px_100px] bg-slate-50 border-t border-slate-200">
                <div className="col-span-4 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </div>
              </div>

              {/* Linhas de features */}
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_100px_100px_100px] border-t border-slate-100 transition-colors hover:bg-slate-50/80 ${row.highlight ? 'bg-violet-50/40' : ''}`}
                >
                  <div className="px-5 py-3 text-sm text-slate-700 flex items-center gap-2">
                    {row.highlight && <Zap className="h-3 w-3 text-violet-500 flex-shrink-0" />}
                    {row.label}
                  </div>
                  <div className="py-3 flex items-center justify-center">
                    <CheckIcon has={row.core} planKey="core" />
                  </div>
                  <div className={`py-3 flex items-center justify-center ${row.standard ? 'bg-orange-50/30' : ''}`}>
                    <CheckIcon has={row.standard} planKey="standard" />
                  </div>
                  <div className="py-3 flex items-center justify-center">
                    <CheckIcon has={row.enterprise} planKey="enterprise" />
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Rodapé da tabela com CTAs */}
          <div className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_100px_100px_100px] border-t border-slate-200 bg-white">
            <div className="px-5 py-4 text-xs text-slate-400 flex items-center">
              Fale conosco pelo WhatsApp para fazer upgrade
            </div>
            {(['core', 'standard', 'enterprise'] as const).map((planKey) => {
              const cfg = PLAN_CONFIG[planKey];
              const planRecord = plans.find((p) => p.name === planKey);
              const isCurrent = planKey === currentPlanName;
              return (
                <div key={planKey} className="px-2 py-4 flex items-center justify-center">
                  {isCurrent ? (
                    <span className="text-[11px] font-semibold text-slate-400">Atual</span>
                  ) : planRecord ? (
                    <a
                      href={buildWhatsAppUrl(restaurantName, cfg.label)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Fazer upgrade para ${cfg.label}`}
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-white transition-all hover:shadow ${cfg.ctaBg}`}
                    >
                      <MessageCircle className="h-3 w-3" />
                      Upgrade
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Nota de rodapé ─────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-slate-400">
          <span>Dúvidas? Fale com o nosso suporte:</span>
          <a
            href={`https://wa.me/${WHATSAPP_SUPPORT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-medium text-[#25D366] hover:text-[#1ebe5d] transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Comercial
          </a>
          <span className="hidden sm:block text-slate-300">·</span>
          <Link
            to="/admin"
            className="text-slate-500 hover:text-slate-800 transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
