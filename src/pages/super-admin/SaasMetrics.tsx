import { useQueryClient } from '@tanstack/react-query';
import { useSaasMetrics, saasMetricsKey } from '@/hooks/queries/useSaasMetrics';
import { useSubscriptionPlans, subscriptionKeys } from '@/hooks/queries/useSubscriptionManager';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  DollarSign,
  Zap,
  Download,
  ChevronDown,
  Flame,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Variantes de animação ─────────────────────────────────────────────────────

const kpiContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const kpiCardVariants = {
  hidden:  { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

const sectionVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: 0.32 },
  },
};

// ─── Paleta de cores por plano ─────────────────────────────────────────────────

const PLAN_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  core:       { bar: '#94a3b8', badge: 'bg-slate-100 text-slate-600',   text: 'text-slate-600'  },
  standard:   { bar: '#f97316', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700' },
  enterprise: { bar: '#c2410c', badge: 'bg-orange-100 text-orange-800', text: 'text-orange-800' },
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
  const { data: plans = [] } = useSubscriptionPlans();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: saasMetricsKey() });
    qc.invalidateQueries({ queryKey: subscriptionKeys.plans() });
  };

  // Usa preços da página Planos (useSubscriptionPlans) para garantir consistência
  const planPriceMap = Object.fromEntries(plans.map((p) => [p.name, p.price_brl]));
  const usePlanPrices = plans.length > 0;
  const revenueByPlan = (metrics?.revenue_by_plan ?? []).map((item) => {
    if (usePlanPrices) {
      const priceBrl = planPriceMap[item.plan_name] ?? 0;
      const monthlyRevenueBrl = Math.round((item.tenant_count ?? 0) * priceBrl * 100) / 100;
      return { ...item, monthly_revenue_brl: monthlyRevenueBrl };
    }
    return item;
  });
  const totalMrr = usePlanPrices
    ? revenueByPlan.reduce((sum, item) => sum + item.monthly_revenue_brl, 0)
    : (metrics?.total_mrr ?? 0);
  const arpu = metrics?.total_tenants
    ? totalMrr / metrics.total_tenants
    : 0;

  const handleExportCSV = () => {
    if (!metrics) return;
    const rows = [
      ['Métrica', 'Valor'],
      ['MRR Atual', formatCurrency(totalMrr)],
      ['Total Restaurantes', String(metrics.total_tenants)],
      ['Novos (7 dias)', String(metrics.new_tenants_7d)],
      ['ARPU', formatCurrency(arpu)],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saas-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Preparar dados do gráfico (usa receita recalculada com preços da página Planos) ───
  const chartData = revenueByPlan.map((item) => ({
    ...item,
    fill: PLAN_COLORS[item.plan_name]?.bar ?? '#94a3b8',
  }));

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 bg-slate-200" />
            <Skeleton className="h-4 w-64 bg-slate-200" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-metric-card">
              <Skeleton className="h-4 w-24 bg-slate-200" />
              <Skeleton className="h-8 w-32 mt-3 bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="admin-card p-6">
              <Skeleton className="h-5 w-48 bg-slate-200" />
              <Skeleton className="h-[200px] w-full mt-4 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500 p-8">
        <Zap className="h-12 w-12 text-orange-200" />
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
    <div className="p-6 lg:p-8 space-y-6 min-w-0">

      {/* ── Header (estilo Dashboard BI) ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard BI</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Visão financeira consolidada do SaaS
            {lastUpdated && (
              <span className="text-slate-400"> · Atualizado às {lastUpdated}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Exportar
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleExportCSV}>
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Atualizar dados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── KPI Cards (4 cards brancos como referência) ────────────────────── */}
      <motion.div
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0"
        variants={kpiContainerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="admin-metric-card" variants={kpiCardVariants}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">MRR</p>
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(totalMrr)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Receita mensal recorrente</p>
        </motion.div>

        <motion.div className="admin-metric-card" variants={kpiCardVariants}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">Restaurantes</p>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Store className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.total_tenants}</p>
          <p className="text-xs text-slate-400 mt-1">
            {metrics.total_tenants === 1 ? 'restaurante ativo' : 'restaurantes ativos'}
          </p>
        </motion.div>

        <motion.div className="admin-metric-card" variants={kpiCardVariants}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">Novos (7 dias)</p>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
              metrics.new_tenants_7d > 0 ? 'bg-violet-50' : 'bg-slate-100'
            }`}>
              <UserPlus className={`h-4 w-4 ${metrics.new_tenants_7d > 0 ? 'text-violet-600' : 'text-slate-400'}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.new_tenants_7d}</p>
          <p className="text-xs text-slate-400 mt-1">
            {metrics.new_tenants_7d > 0 ? 'novos esta semana' : 'nenhum novo'}
          </p>
        </motion.div>

        <motion.div className="admin-metric-card" variants={kpiCardVariants}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">ARPU</p>
            <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(arpu)}</p>
          <p className="text-xs text-slate-400 mt-1">Receita média por restaurante</p>
        </motion.div>
      </motion.div>

      {/* ── Receita por plano (no topo) ─────────────────────────────────────── */}
      <motion.div
        className="admin-card p-6 min-w-0 overflow-hidden"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <h3 className="text-base font-semibold text-slate-700 mb-4">Receita por Plano</h3>
        <p className="text-xs text-slate-400 mb-5">MRR estimado por cada tier de assinatura</p>
        <div className="space-y-3">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum dado</p>
          ) : (
            chartData.map((item) => {
              const palette = PLAN_COLORS[item.plan_name];
              const pct = totalMrr > 0 ? Math.round((item.monthly_revenue_brl / totalMrr) * 100) : 0;
              return (
                <div key={item.plan_name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: palette?.bar }} />
                      <span className="text-sm font-medium text-slate-700">{item.plan_label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${palette?.badge}`}>
                        {item.tenant_count}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{formatCurrency(item.monthly_revenue_brl)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: palette?.bar }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* ── Segunda linha: Distribuição + Gráfico (estilo Tempos Op. + Movimento) ─ */}
      <motion.div
        className="grid gap-4 grid-cols-1 lg:grid-cols-2 min-w-0"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="admin-card p-6 min-w-0 overflow-hidden">
          <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Distribuição por Plano
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(chartData.length > 0 ? chartData : [
              { plan_name: 'core', plan_label: 'Core', tenant_count: 0 },
              { plan_name: 'standard', plan_label: 'Standard', tenant_count: 0 },
              { plan_name: 'enterprise', plan_label: 'Enterprise', tenant_count: 0 },
            ]).map((item) => {
              const planName = item.plan_name ?? 'core';
              const bg = planName === 'core' ? 'bg-orange-50 border-orange-100' : planName === 'standard' ? 'bg-cyan-50 border-cyan-100' : 'bg-slate-50 border-slate-100';
              const iconColor = planName === 'core' ? 'text-orange-600' : planName === 'standard' ? 'text-cyan-600' : 'text-slate-600';
              return (
                <div key={planName} className={`rounded-xl border px-4 py-3 flex flex-col gap-1 ${bg}`}>
                  <div className={`flex items-center gap-1.5 ${iconColor}`}>
                    <Store className="h-4 w-4" />
                    <span className="text-xs font-medium">{item.plan_label}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{item.tenant_count}</p>
                  <p className="text-[11px] text-slate-400">restaurantes</p>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            * Tenants ativos por tier de assinatura
          </p>
        </div>

        <div className="admin-card p-6 min-w-0 overflow-hidden">
          <div className="pb-4">
            <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Store className="h-4 w-4 text-blue-500" />
              Restaurantes por Plano
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribuição de tenants ativos entre os planos
            </p>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="min-w-0 min-h-[200px]">
              <ResponsiveContainer width="100%" height={200} minWidth={0}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="plan_label" stroke="#888" style={{ fontSize: '11px' }} />
                  <YAxis allowDecimals={false} stroke="#888" style={{ fontSize: '11px' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                  <Bar dataKey="tenant_count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.plan_name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Terceira linha: Lucro/Receita total (estilo Lucro Estimado) ───── */}
      <motion.div className="admin-metric-card min-w-0" variants={sectionVariants} initial="hidden" animate="visible">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-slate-500">Total MRR</p>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
        <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(totalMrr)}</p>
        <p className="text-xs text-slate-400 mt-1">Receita mensal recorrente consolidada</p>
      </motion.div>

    </div>
  );
}
