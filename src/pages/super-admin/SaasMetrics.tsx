import { useQueryClient } from '@tanstack/react-query';
import { useSaasMetrics, saasMetricsKey } from '@/hooks/queries/useSaasMetrics';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Store,
  UserPlus,
  RefreshCw,
  ArrowUpRight,
  DollarSign,
  Zap,
} from 'lucide-react';

// ─── Paleta de cores por plano ─────────────────────────────────────────────────

const PLAN_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  core:       { bar: '#94a3b8', badge: 'bg-slate-100 text-slate-600',   text: 'text-slate-600'  },
  standard:   { bar: '#f97316', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700' },
  enterprise: { bar: '#7c3aed', badge: 'bg-violet-100 text-violet-700', text: 'text-violet-700' },
};

// ─── Tooltip customizado ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="font-medium">
          {p.dataKey === 'tenant_count'
            ? `${p.value} restaurante${p.value !== 1 ? 's' : ''}`
            : `R$ ${Number(p.value).toFixed(2).replace('.', ',')}`
          }
        </p>
      ))}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function SaasMetrics() {
  const qc = useQueryClient();
  const { data: metrics, isLoading, isError, dataUpdatedAt } = useSaasMetrics();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: saasMetricsKey() });
  };

  // ── Preparar dados do gráfico ────────────────────────────────────────────
  const chartData = (metrics?.revenue_by_plan ?? []).map((item) => ({
    ...item,
    fill: PLAN_COLORS[item.plan_name]?.bar ?? '#94a3b8',
  }));

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500 p-8">
        <Zap className="h-12 w-12 text-violet-200" />
        <p className="font-semibold">Não foi possível carregar as métricas.</p>
        <p className="text-sm text-slate-400">
          Verifique se a migration <code>20260220_saas_admin_features.sql</code> foi executada.
        </p>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão financeira consolidada do SaaS
            {lastUpdated && (
              <span className="ml-2 text-slate-400">· Atualizado às {lastUpdated}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* MRR */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg shadow-violet-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">
                MRR Atual
              </p>
              <p className="text-3xl font-extrabold mt-2">
                {formatCurrency(metrics.total_mrr)}
              </p>
              <p className="text-xs text-violet-200 mt-1.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Receita mensal recorrente
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
          {/* Decoração sutil */}
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
        </div>

        {/* Total de Restaurantes */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Total de Restaurantes
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {metrics.total_tenants}
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                {metrics.total_tenants === 1 ? 'restaurante ativo' : 'restaurantes ativos'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Store className="h-5 w-5 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Novos (7 dias) */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Novos (7 dias)
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {metrics.new_tenants_7d}
              </p>
              <p className={`text-xs mt-1.5 flex items-center gap-1 ${
                metrics.new_tenants_7d > 0 ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                <ArrowUpRight className="h-3 w-3" />
                {metrics.new_tenants_7d > 0
                  ? `${metrics.new_tenants_7d} novo${metrics.new_tenants_7d !== 1 ? 's' : ''} esta semana`
                  : 'Nenhum novo esta semana'}
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              metrics.new_tenants_7d > 0 ? 'bg-emerald-50' : 'bg-slate-100'
            }`}>
              <UserPlus className={`h-5 w-5 ${metrics.new_tenants_7d > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Distribuição por plano ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Gráfico */}
        <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Restaurantes por Plano
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Distribuição de tenants ativos entre os planos de assinatura
          </p>

          {chartData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">
              Nenhum dado disponível. Execute a migration e atribua planos.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="plan_label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                <Bar dataKey="tenant_count" radius={[8, 8, 0, 0]} maxBarSize={56}>
                  {chartData.map((entry) => (
                    <Cell key={entry.plan_name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela de receita por plano */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Receita por Plano
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            MRR estimado por cada tier de assinatura
          </p>

          <div className="space-y-3">
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum dado</p>
            ) : (
              chartData.map((item) => {
                const palette = PLAN_COLORS[item.plan_name];
                const totalRevenue = metrics.total_mrr;
                const pct = totalRevenue > 0
                  ? Math.round((item.monthly_revenue_brl / totalRevenue) * 100)
                  : 0;

                return (
                  <div key={item.plan_name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: palette?.bar }}
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {item.plan_label}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${palette?.badge}`}>
                          {item.tenant_count}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatCurrency(item.monthly_revenue_brl)}
                      </span>
                    </div>
                    {/* Barra de progresso */}
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: palette?.bar,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Total */}
          {chartData.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Total MRR
              </span>
              <span className="text-base font-extrabold text-violet-700">
                {formatCurrency(metrics.total_mrr)}
              </span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
