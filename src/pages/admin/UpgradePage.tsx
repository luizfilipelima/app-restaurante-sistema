import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Lock,
  Sparkles,
  ArrowLeft,
  Check,
  Zap,
  BarChart3,
  Users,
  Truck,
  Scale,
  ShoppingBag,
} from 'lucide-react';

// Mapeamento de feature flag → info de marketing exibida ao usuário
const FEATURE_INFO: Record<string, { label: string; plan: string; description: string; icon: React.ElementType }> = {
  feature_buffet_module:     { label: 'Módulo Buffet',          plan: 'Enterprise', description: 'Gerencie comandas, escaneie produtos e opere 100% offline.',           icon: Scale      },
  feature_tables:            { label: 'Mesas & QR Codes',        plan: 'Standard',   description: 'Crie mesas virtuais, gere QR Codes e receba chamadas de garçom.',     icon: ShoppingBag },
  feature_couriers:          { label: 'Gestão de Entregadores',  plan: 'Standard',   description: 'Cadastre entregadores, controle o status e vincule aos pedidos.',     icon: Truck       },
  feature_delivery_zones:    { label: 'Zonas de Entrega',        plan: 'Standard',   description: 'Configure bairros com taxas personalizadas exibidas no checkout.',    icon: Truck       },
  feature_bcg_matrix:        { label: 'Matriz BCG de Produtos',  plan: 'Enterprise', description: 'Classifique seu cardápio em Estrelas, Vacas, Interrogações e Abacaxis.', icon: BarChart3  },
  feature_churn_recovery:    { label: 'Recuperação de Churn',    plan: 'Enterprise', description: 'Identifique clientes em risco e contacte-os via WhatsApp.',           icon: Users       },
  feature_retention_analytics:{ label: 'Análise de Retenção',   plan: 'Enterprise', description: 'Veja a taxa de clientes recorrentes e tendência de fidelização.',     icon: BarChart3   },
  feature_inventory_cost:    { label: 'Inventário com CMV',      plan: 'Enterprise', description: 'Controle custo de insumos, CMV e margem de lucro por produto.',       icon: BarChart3   },
};

const PLAN_HIGHLIGHTS: Record<string, { color: string; bg: string; border: string; features: string[] }> = {
  Standard: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    features: [
      'Pedidos de mesa via QR Code',
      'Canal de delivery com zonas de entrega',
      'Gestão de entregadores',
      'Notificação de status via WhatsApp',
      'Impressão térmica automática',
      'Analytics de faturamento e canais',
      'Personalização de marca (logo e cores)',
    ],
  },
  Enterprise: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    features: [
      'Tudo do plano Standard',
      'Módulo Buffet completo (offline-first)',
      'Matriz BCG estratégica do cardápio',
      'Recuperação de churn via WhatsApp',
      'Análise de retenção de clientes',
      'Inventário com custo e CMV',
      'RBAC completo (múltiplos usuários com cargos)',
      'Filtros avançados de período no dashboard',
    ],
  },
};

export default function UpgradePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // A feature que causou o bloqueio é passada via state de navegação
  const featureFlag = (location.state as { feature?: string } | null)?.feature ?? '';
  const featureInfo = FEATURE_INFO[featureFlag];
  const planRequired = featureInfo?.plan ?? 'Standard';
  const planHighlights = PLAN_HIGHLIGHTS[planRequired];

  const FeatureIcon = featureInfo?.icon ?? Lock;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">

        {/* Botão voltar */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Header do card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-10 text-white text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              {featureInfo ? (
                <FeatureIcon className="h-7 w-7 text-white" />
              ) : (
                <Lock className="h-7 w-7 text-white" />
              )}
            </div>
            <h1 className="text-2xl font-bold">
              {featureInfo ? featureInfo.label : 'Funcionalidade bloqueada'}
            </h1>
            <p className="mt-2 text-slate-300 text-sm max-w-md mx-auto">
              {featureInfo
                ? featureInfo.description
                : 'Esta funcionalidade não está disponível no seu plano atual.'}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Disponível no plano <span className="font-bold">{planRequired}</span>
            </div>
          </div>

          {/* Destaques do plano */}
          {planHighlights && (
            <div className={`px-8 py-6 border-b ${planHighlights.bg} ${planHighlights.border}`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${planHighlights.color}`}>
                O que você desbloqueia no plano {planRequired}
              </p>
              <ul className="space-y-2">
                {planHighlights.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${planHighlights.color}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="px-8 py-6 flex flex-col sm:flex-row items-center gap-3">
            <Button
              className="w-full sm:w-auto gap-2 bg-[#F87116] hover:bg-[#ea580c] text-white shadow-sm"
              onClick={() => {
                // Futuramente: abrir modal de planos ou redirecionar para página de pricing
                window.open('mailto:suporte@quiero.food?subject=Upgrade de plano', '_blank');
              }}
            >
              <Zap className="h-4 w-4" />
              Fazer upgrade do plano
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:w-auto text-slate-600"
              onClick={() => navigate('/admin')}
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </div>

        {/* Nota de rodapé */}
        <p className="text-center text-xs text-slate-400">
          Entre em contato com o suporte para alterar seu plano:
          <a
            href="mailto:suporte@quiero.food"
            className="ml-1 text-[#F87116] hover:underline font-medium"
          >
            suporte@quiero.food
          </a>
        </p>

      </div>
    </div>
  );
}
