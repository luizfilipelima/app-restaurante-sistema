import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { useDashboardStats, useDashboardKPIs, useDashboardAnalytics, useRestaurant } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { exportDashboardCSV, exportDashboardXLSX } from '@/lib/dashboard-export';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, Clock, RotateCcw, Loader2,
  MapPin, Scale, AlertTriangle, TrendingUp as TrendingUpIcon, Flame, Bike, HelpCircle,
  Users, LayoutGrid, Download, FileSpreadsheet, FileText, ChevronDown, Printer,
} from 'lucide-react';
import DashboardPrintReport from '@/components/admin/DashboardPrintReport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChurnRecoveryList } from '@/components/admin/ChurnRecoveryList';
import { MenuMatrixBCG } from '@/components/admin/MenuMatrixBCG';
import type { DashboardAdvancedStatsResponse } from '@/types/dashboard-analytics';
type PeriodValue = '30' | '365' | 'max';

const AREA_VALUES = ['all', 'delivery', 'table', 'pickup', 'buffet'] as const;
type AreaValue = 'all' | 'delivery' | 'table' | 'pickup' | 'buffet';

// ─── Variantes de animação stagger para os cards de métrica ─────────────────

const metricContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const metricCardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

// ─────────────────────────────────────────────────────────────────────────────

function getDateRange(period: PeriodValue) {
  const end = new Date();
  let start: Date;
  if (period === '30') start = subDays(end, 30);
  else if (period === '365') start = subDays(end, 365);
  else start = new Date(2020, 0, 1);
  return { start, end };
}

export default function AdminDashboard() {
  const { t } = useAdminTranslation();
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: restaurant } = useRestaurant(restaurantId);
  const [period, setPeriod] = useState<PeriodValue>('30');
  const [areaFilter, setAreaFilter] = useState<AreaValue>('all');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [printing,  setPrinting]  = useState(false);

  const { start, end } = useMemo(() => getDateRange(period), [period]);
  const prevRange = useMemo(() => {
    if (period === '30') return { start: subDays(start, 30), end: start };
    if (period === '365') return { start: subDays(start, 365), end: start };
    return null;
  }, [period, start]);

  const areaForRpc = areaFilter;

  const { data: kpisData, isLoading: loadingKPIs } = useDashboardKPIs({
    tenantId: restaurantId,
    startDate: start,
    endDate: end,
    areaFilter: areaForRpc,
  });

  const { data: statsData, isLoading: loadingBI } = useDashboardStats({
    tenantId: restaurantId,
    startDate: start,
    endDate: end,
    areaFilter: areaForRpc,
  });

  const { data: analyticsFallback } = useDashboardAnalytics({
    tenantId: restaurantId,
    startDate: start,
    endDate: end,
    areaFilter: areaForRpc,
    enabled: !!restaurantId,
  });

  const analytics = (statsData ?? analyticsFallback) as DashboardAdvancedStatsResponse | undefined;

  const { data: prevAnalytics } = useDashboardStats({
    tenantId: restaurantId,
    startDate: prevRange?.start ?? start,
    endDate: prevRange?.end ?? start,
    areaFilter: areaForRpc,
    enabled: !!prevRange,
  });

  const metrics = useMemo(() => {
    const k = analytics?.kpis ?? kpisData;
    return {
      totalRevenue: k?.total_faturado ?? 0,
      totalOrders: k?.total_pedidos ?? 0,
      averageTicket: k?.ticket_medio ?? 0,
      pendingOrders: k?.pedidos_pendentes ?? 0,
    };
  }, [analytics?.kpis, kpisData]);

  const hasKpis = !!kpisData || !!(analytics && analytics.kpis);
  const loading = loadingKPIs && loadingBI && !hasKpis;

  const prevMetrics = useMemo(() => ({
    totalRevenue: prevAnalytics?.kpis?.total_faturado ?? 0,
    totalOrders: prevAnalytics?.kpis?.total_pedidos ?? 0,
  }), [prevAnalytics]);

  const dailyRevenue = useMemo(() => {
    const trend = analytics?.sales_trend ?? [];
    const last7 = trend.slice(-7);
    return last7.map((d) => ({
      date: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
      revenue: d.revenue,
      orders: d.orders,
    }));
  }, [analytics]);

  const operational = analytics?.operational;
  const financial = analytics?.financial;
  const avgPrepTime = operational?.avg_prep_time ?? 0;
  const avgDeliveryTime = operational?.avg_delivery_time ?? 0;
  const grossProfit = financial?.gross_profit ?? 0;

  const restaurantName = restaurant?.name ?? 'Restaurante';
  const periodLabel = period === '30' ? t('dashboard.filters.last30') : period === '365' ? t('dashboard.filters.lastYear') : t('dashboard.filters.allTime');
  const areaLabel = ((): string => {
    const map: Record<AreaValue, string> = {
      all:      t('dashboard.filters.all'),
      delivery: t('dashboard.filters.delivery'),
      table:    t('dashboard.filters.table'),
      pickup:   t('dashboard.filters.pickup'),
      buffet:   t('dashboard.filters.buffet'),
    };
    return map[areaFilter] ?? t('dashboard.filters.all');
  })();

  const handleExport = async (fmt: 'csv' | 'xlsx') => {
    if (!analytics) return;
    setExporting(true);
    try {
      const params = {
        analytics: analytics as DashboardAdvancedStatsResponse,
        restaurantName,
        currency,
        periodLabel,
        areaLabel,
      };
      if (fmt === 'csv') exportDashboardCSV(params);
      else exportDashboardXLSX(params);
    } finally {
      setExporting(false);
    }
  };

  const handlePrintReport = () => {
    setPrinting(true);

    // Dynamically inject the correct @page size so we override the receipt's 80mm rule.
    const existingOverride = document.getElementById('dashboard-report-page-style');
    if (existingOverride) existingOverride.remove();

    const paperW = restaurant?.print_paper_width as '58mm' | '80mm' | null | undefined;
    const pageSize = paperW === '58mm' ? '58mm auto'
                   : paperW === '80mm' ? '80mm auto'
                   : 'A4 portrait';
    const pageMargin = paperW ? '4mm 3mm' : '0';

    const styleEl = document.createElement('style');
    styleEl.id  = 'dashboard-report-page-style';
    styleEl.textContent = `@media print { @page { size: ${pageSize}; margin: ${pageMargin}; } }`;
    document.head.appendChild(styleEl);

    document.body.classList.add('print-dashboard-report');

    // Give the DOM a tick to apply styles before printing
    requestAnimationFrame(() => {
      window.print();
      document.body.classList.remove('print-dashboard-report');
      styleEl.remove();
      setPrinting(false);
    });
  };

  const movementByHour = useMemo(() => {
    const heatmap = operational?.idleness_heatmap ?? [];
    const counts = heatmap.map((h) => h.count).filter((c) => c > 0);
    const avgCount = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    return heatmap.map((h) => ({
      hour: `${String(h.hour).padStart(2, '0')}h`,
      count: h.count,
      isLowMovement: avgCount > 0 && h.count < avgCount * 0.5,
    }));
  }, [operational?.idleness_heatmap]);

  const paymentMethods = analytics?.payment_methods ?? [];
  const topZone = analytics?.top_zone ?? null;
  const peakHours = analytics?.peak_hours ?? [];
  const topProducts = analytics?.top_products ?? [];
  const bottomProducts = analytics?.bottom_products ?? [];

  // Métricas de Buffet
  const [buffetMetrics, setBuffetMetrics] = useState({
    totalComandas: 0,
    openComandas: 0,
    totalBuffetRevenue: 0,
    averageBuffetTicket: 0,
    realCMV: 0,
    profit: 0,
    profitMargin: 0,
  });
  const [idleComandas, setIdleComandas] = useState<{ number: number; minutesOpen: number }[]>([]);
  const [weightByInterval, setWeightByInterval] = useState<{ interval: string; count: number }[]>([]);

  useEffect(() => {
    if (restaurantId) {
      loadBuffetMetrics();
    }
  }, [restaurantId, period, areaFilter]);

  const loadBuffetMetrics = async () => {
    if (!restaurantId) return;
    let startDate: Date | null = null;
    if (period === '30') startDate = subDays(new Date(), 30);
    else if (period === '365') startDate = subDays(new Date(), 365);

    try {
      // Carregar comandas fechadas no período
      let comandasQuery = supabase
        .from('comandas')
        .select('*, comanda_items(*, product_id)')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'closed');
      
      if (startDate) {
        comandasQuery = comandasQuery.gte('closed_at', startDate.toISOString());
      }
      
      const { data: closedComandas } = await comandasQuery;
      const closedComandasList = closedComandas || [];

      // Carregar comandas abertas (para alertas de ociosidade)
      const { data: openComandas } = await supabase
        .from('comandas')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'open');
      
      const openComandasList = openComandas || [];
      const now = new Date();

      // Calcular alertas de ociosidade (abertas há mais de 1 hora)
      const idle = openComandasList
        .map((c: any) => {
          const openedAt = new Date(c.opened_at);
          const minutesOpen = (now.getTime() - openedAt.getTime()) / (1000 * 60);
          return { number: c.number, minutesOpen: Math.floor(minutesOpen) };
        })
        .filter((c: { minutesOpen: number }) => c.minutesOpen > 60)
        .sort((a: { minutesOpen: number }, b: { minutesOpen: number }) => b.minutesOpen - a.minutesOpen);
      
      setIdleComandas(idle);

      // Calcular receita total do buffet
      const totalBuffetRevenue = closedComandasList.reduce(
        (sum: number, c: any) => sum + (c.total_amount || 0),
        0
      );

      // Calcular CMV Real e Lucro
      let totalCost = 0;
      const itemIds = closedComandasList.flatMap((c: any) => 
        (c.comanda_items || []).map((item: any) => item.product_id).filter(Boolean)
      );
      
      if (itemIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, price_cost')
          .in('id', [...new Set(itemIds)]);
        
        const productsMap = new Map((products || []).map((p: any) => [p.id, p.price_cost || 0]));
        
        closedComandasList.forEach((c: any) => {
          (c.comanda_items || []).forEach((item: any) => {
            if (item.product_id) {
              const cost = productsMap.get(item.product_id) || 0;
              totalCost += cost * item.quantity;
            }
          });
        });
      }

      const profit = totalBuffetRevenue - totalCost;
      const profitMargin = totalBuffetRevenue > 0 ? (profit / totalBuffetRevenue) * 100 : 0;

      // Calcular ticket médio
      const averageBuffetTicket = closedComandasList.length > 0
        ? totalBuffetRevenue / closedComandasList.length
        : 0;

      // Calcular pesagens por intervalo de 30 minutos
      const intervalCounts: Record<string, number> = {};
      closedComandasList.forEach((c: any) => {
        const closedAt = new Date(c.closed_at);
        const hour = closedAt.getHours();
        const minute = closedAt.getMinutes();
        const interval = `${String(hour).padStart(2, '0')}:${Math.floor(minute / 30) * 30 === 0 ? '00' : '30'}`;
        intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
      });

      const intervals = Object.entries(intervalCounts)
        .map(([interval, count]) => ({ interval, count }))
        .sort((a, b) => a.interval.localeCompare(b.interval));

      setWeightByInterval(intervals);

      setBuffetMetrics({
        totalComandas: closedComandasList.length,
        openComandas: openComandasList.length,
        totalBuffetRevenue,
        averageBuffetTicket,
        realCMV: totalCost,
        profit,
        profitMargin,
      });
    } catch (error) {
      console.error('Erro ao carregar métricas de buffet:', error);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const handleResetData = async () => {
    if (!restaurantId || !user?.email) return;
    const password = resetPassword.trim();
    if (!password) {
      setResetError('Digite sua senha para confirmar.');
      return;
    }
    setResetting(true);
    setResetError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authError) {
        setResetError('Senha incorreta. Tente novamente.');
        setResetting(false);
        return;
      }
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('restaurant_id', restaurantId);
      if (deleteError) throw deleteError;
      toast({
        title: 'Dados resetados',
        description: 'Todos os pedidos deste restaurante foram removidos. A dashboard foi atualizada.',
      });
      setShowResetDialog(false);
      setResetPassword('');
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erro ao resetar',
        description: 'Não foi possível remover os dados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  const paymentMethodNames: Record<string, string> = {
    pix: 'PIX',
    card: 'Cartão',
    cash: 'Dinheiro',
    table: 'Mesa',
  };

  const pctChange = (curr: number, prev: number) =>
    prev > 0 ? (((curr - prev) / prev) * 100).toFixed(1) : curr > 0 ? '100' : '0';

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-slate-200" />
          <Skeleton className="h-4 w-64 bg-slate-200" />
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
              <Skeleton className="h-[300px] w-full mt-4 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const revPct = pctChange(metrics.totalRevenue, prevMetrics.totalRevenue);
  const ordPct = pctChange(metrics.totalOrders, prevMetrics.totalOrders);

  return (
    <div className="space-y-6 min-w-0">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {periodLabel}{areaFilter !== 'all' ? ` · ${areaLabel}` : ''}
              {restaurantName && <> · <span className="font-medium">{restaurantName}</span></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as AreaValue)}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 bg-white border-slate-200 text-sm">
                <SelectValue placeholder={t('common.all')} />
              </SelectTrigger>
              <SelectContent>
                {AREA_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>{t(`dashboard.filters.${v === 'all' ? 'all' : v === 'table' ? 'table' : v === 'pickup' ? 'pickup' : v}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodValue)}>
              <SelectTrigger className="w-full sm:w-[170px] h-9 bg-white border-slate-200 text-sm">
                <SelectValue placeholder={t('common.period')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t('dashboard.filters.last30')}</SelectItem>
                <SelectItem value="365">{t('dashboard.filters.lastYear')}</SelectItem>
                <SelectItem value="max">{t('dashboard.filters.allTime')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Print Report */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#F87116] hover:border-orange-200"
              disabled={!analytics || printing}
              onClick={handlePrintReport}
            >
              {printing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Printer className="h-4 w-4" />
              }
              <span className="hidden sm:inline">{t('print.printBtn')}</span>
            </Button>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  disabled={!analytics || exporting}
                >
                  {exporting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />
                  }
                  {t('common.export')}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport('csv')}
                >
                  <FileText className="h-4 w-4 text-slate-500" />
                  {t('dashboard.exportCSV')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport('xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {t('dashboard.exportXLSX')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ══ LINHA 1: KPIs Críticos — Faturamento, Lucro, Ticket Médio ══ */}
        <motion.div
          className="grid gap-4 grid-cols-1 sm:grid-cols-3 min-w-0"
          variants={metricContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Faturamento */}
          <motion.div className="admin-metric-card" variants={metricCardVariants}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.kpis.revenue')}</p>
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {formatCurrency(metrics.totalRevenue, currency)}
            </p>
            {prevMetrics.totalRevenue > 0 && (
              <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${Number(revPct) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {Number(revPct) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {revPct}% {t('common.vsPrevious')}
              </p>
            )}
          </motion.div>

          {/* Lucro Estimado (movido para a linha 1) */}
          <motion.div className="admin-metric-card" variants={metricCardVariants}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-500">{t('dashboard.kpis.profit')}</p>
                <span
                  title="O lucro depende do cadastro do preço de custo dos produtos. Verifique os itens do cardápio."
                  className="cursor-help text-slate-400 hover:text-slate-600"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className={`text-3xl font-bold mt-2 ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatCurrency(grossProfit, currency)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.kpis.profitDesc')}</p>
          </motion.div>

          {/* Ticket Médio */}
          <motion.div className="admin-metric-card" variants={metricCardVariants}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.kpis.avgTicket')}</p>
              <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-violet-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {formatCurrency(metrics.averageTicket, currency)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.kpis.avgOrderDesc')}</p>
          </motion.div>
        </motion.div>

        {/* ══ LINHA 1b: KPIs Secundários — Pedidos + Pendentes ══ */}
        <motion.div
          className="grid gap-4 grid-cols-2 min-w-0"
          variants={metricContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="admin-metric-card py-4" variants={metricCardVariants}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.kpis.orders')}</p>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalOrders}</p>
            {prevMetrics.totalOrders > 0 && (
              <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${Number(ordPct) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {Number(ordPct) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {ordPct}% {t('common.vsPrevious')}
              </p>
            )}
          </motion.div>
          <motion.div className="admin-metric-card py-4" variants={metricCardVariants}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.kpis.pending')}</p>
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.pendingOrders}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.kpis.awaitingPrep')}</p>
          </motion.div>
        </motion.div>

        {/* ══ LINHA 2: Operação — Tempos + Movimento por Hora ══ */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 min-w-0">
          {/* Tempos Operacionais + Horas Economizadas */}
          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              {t('dashboard.operational.title')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-orange-600">
                  <Flame className="h-4 w-4" />
                  <span className="text-xs font-medium">{t('dashboard.operational.kitchen')}</span>
                </div>
                {avgPrepTime > 0 ? (
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {Math.round(avgPrepTime)}<span className="text-sm font-normal text-slate-500"> min</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic mt-1">{t('dashboard.operational.noData')}</p>
                )}
                <p className="text-[11px] text-slate-400">{t('dashboard.operational.avgPrepTime')}</p>
              </div>
              <div className="rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-cyan-600">
                  <Bike className="h-4 w-4" />
                  <span className="text-xs font-medium">{t('dashboard.operational.delivery')}</span>
                </div>
                {avgDeliveryTime > 0 ? (
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {Math.round(avgDeliveryTime)}<span className="text-sm font-normal text-slate-500"> min</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic mt-1">{t('dashboard.operational.noData')}</p>
                )}
                <p className="text-[11px] text-slate-400">{t('dashboard.operational.avgDeliveryTime')}</p>
              </div>
            </div>

            {/* Horas Economizadas — Total pedidos × 4 min */}
            {metrics.totalOrders > 0 && (() => {
              const totalMin  = metrics.totalOrders * 4;
              const hours     = Math.floor(totalMin / 60);
              const mins      = totalMin % 60;
              const display   = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}min` : ''}` : `${mins}min`;
              return (
                <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-indigo-700">{t('dashboard.operational.hoursSaved')}</p>
                    <p className="text-[11px] text-indigo-500 mt-0.5">{t('dashboard.operational.hoursSavedDesc')}</p>
                  </div>
                  <p className="text-2xl font-black text-indigo-700 shrink-0">{display}</p>
                </div>
              );
            })()}

            <p className="text-[11px] text-slate-400 mt-3">
              {t('dashboard.operational.note')}
            </p>
          </div>

          {/* Movimento por Hora */}
          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                {t('dashboard.charts.hourlyMovement')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('dashboard.charts.hourlyMovementDesc')}
              </p>
            </div>
            <div className="min-w-0">
              <div className="w-full min-h-[200px] min-w-0">
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <BarChart data={movementByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" stroke="#888" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#888" style={{ fontSize: '11px' }} />
                    <Tooltip
                      formatter={(value: number) => [`${value} ${t('dashboard.pedidos')}`, t('dashboard.quantity')]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {movementByHour.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isLowMovement ? '#f59e0b' : '#3b82f6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos - Cards brancos estilo Shopeers */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 min-w-0">
          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUpIcon className="h-4 w-4 text-orange-500" />
                {t('dashboard.charts.dailyRevenue')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('dashboard.charts.dailyRevenueDesc')}
              </p>
            </div>
            <div className="min-w-0">
              <div className="w-full min-h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#888" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, currency)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {t('dashboard.charts.newVsRecurring')}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {t('dashboard.charts.newVsRecurringDesc')}
              </p>
            </div>
            <div className="min-w-0">
              {(analytics?.retention?.clientes_novos ?? 0) + (analytics?.retention?.clientes_recorrentes ?? 0) > 0 ? (
                <>
                  <div className="w-full min-h-[240px] min-w-0">
                    <ResponsiveContainer width="100%" height={240} minWidth={0}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Novos', value: analytics?.retention?.clientes_novos ?? 0 },
                            { name: 'Recorrentes', value: analytics?.retention?.clientes_recorrentes ?? 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#3b82f6" />
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v} clientes`, '']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                      <p className="text-xs text-emerald-700 font-medium">Novos</p>
                      <p className="text-xl font-bold text-emerald-800">{analytics?.retention?.clientes_novos ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-center">
                      <p className="text-xs text-blue-700 font-medium">Recorrentes</p>
                      <p className="text-xl font-bold text-blue-800">{analytics?.retention?.clientes_recorrentes ?? 0}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 gap-2">
                  <Users className="h-10 w-10 opacity-20" />
                  <p className="text-sm">{t('dashboard.noRetention')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.charts.paymentMethods')}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.charts.paymentMethodsDesc')}</p>
            </div>
            <div className="min-w-0">
              {paymentMethods.length > 0 ? (
                <>
                  <div className="w-full min-h-[240px] min-w-0">
                    <ResponsiveContainer width="100%" height={240} minWidth={0}>
                      <PieChart>
                        <Pie
                          data={paymentMethods}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {paymentMethods.map((_e, idx) => (
                            <Cell key={`pm-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [formatCurrency(v, currency), '']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend formatter={(v) => paymentMethodNames[v] || v} wrapperStyle={{ fontSize: '13px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-2">
                    {paymentMethods.map((pm, idx) => {
                      const total = paymentMethods.reduce((s, m) => s + m.value, 0);
                      const pct = total > 0 ? ((pm.value / total) * 100).toFixed(0) : '0';
                      return (
                        <div key={pm.name} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-xs text-slate-600 flex-1">{paymentMethodNames[pm.name] ?? pm.name}</span>
                          <span className="text-xs font-semibold text-slate-800">{formatCurrency(pm.value, currency)}</span>
                          <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 gap-2">
                  <DollarSign className="h-10 w-10 opacity-20" />
                  <p className="text-sm">{t('dashboard.noPayments')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BI: Região, Horários, Itens ── */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 min-w-0">
          {/* Região */}
          <div className="admin-card p-5 min-w-0 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-blue-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">{t('dashboard.bi.topRegion')}</h3>
            </div>
            {topZone ? (
              <div>
                <p className="text-lg font-bold text-slate-900 truncate" title={topZone.name}>
                  {topZone.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{topZone.count} pedidos</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Sem dados no período</p>
            )}
          </div>

          {/* Horários de Pico */}
          <div className="admin-card p-5 min-w-0 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">{t('dashboard.bi.peakHours')}</h3>
            </div>
            {peakHours.length > 0 ? (
              <ul className="space-y-1.5">
                {peakHours.map(({ hour, count }, i) => (
                  <li key={hour} className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold w-4 text-center ${i === 0 ? 'text-violet-600' : 'text-slate-400'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-400 rounded-full"
                        style={{ width: `${(count / peakHours[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{hour}h</span>
                    <span className="text-xs font-semibold text-slate-800 shrink-0 w-8 text-right">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 italic">Sem pedidos no período</p>
            )}
          </div>

          {/* Itens mais pedidos */}
          <div className="admin-card p-5 min-w-0 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">{t('dashboard.bi.topItems')}</h3>
            </div>
            {topProducts.length > 0 ? (
              <ul className="space-y-1.5">
                {topProducts.map(({ name, quantity }, i) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold w-4 text-center ${i === 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-700 truncate flex-1" title={name}>{name}</span>
                    <span className="text-xs font-bold text-slate-900 shrink-0">{quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 italic">Sem itens no período</p>
            )}
          </div>

          {/* Itens menos pedidos */}
          <div className="admin-card p-5 min-w-0 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <TrendingDown className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">{t('dashboard.bi.bottomItems')}</h3>
            </div>
            {bottomProducts.length > 0 ? (
              <ul className="space-y-1.5">
                {bottomProducts.map(({ name, quantity }, i) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-4 text-center text-slate-400">{i + 1}</span>
                    <span className="text-xs text-slate-700 truncate flex-1" title={name}>{name}</span>
                    <span className="text-xs font-bold text-slate-900 shrink-0">{quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 italic">Sem itens no período</p>
            )}
          </div>
        </div>

        {/* ── Inteligência de Vendas ── */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 min-w-0">
          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                {t('dashboard.bi.churnTitle')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('dashboard.bi.churnDesc')}
              </p>
            </div>
            <ChurnRecoveryList
              clients={analytics?.retention_risk ?? []}
              currency={currency}
            />
          </div>

          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-violet-500" />
                {t('dashboard.bi.bcgTitle')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('dashboard.bi.bcgDesc')}
              </p>
            </div>
            <MenuMatrixBCG
              menuMatrix={analytics?.menu_matrix}
              currency={currency}
            />
          </div>
        </div>

        {/* Métricas de Buffet - exibir quando filtro Buffet ou quando há comandas */}
        {(areaFilter === 'buffet' || buffetMetrics.totalComandas > 0) && (
          <>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 min-w-0">
              <div className="admin-card p-6">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Scale className="h-4 w-4 text-blue-500" />
                  Comandas Buffet
                </h3>
                <p className="text-2xl font-bold text-slate-900">{buffetMetrics.totalComandas}</p>
                <p className="text-sm text-slate-500">
                  {buffetMetrics.openComandas} aberta(s)
                </p>
              </div>

              <div className="admin-card p-6">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  Receita Buffet
                </h3>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(buffetMetrics.totalBuffetRevenue, currency)}
                </p>
                <p className="text-sm text-slate-500">
                  Ticket médio: {formatCurrency(buffetMetrics.averageBuffetTicket, currency)}
                </p>
              </div>

              <div className="admin-card p-6">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <TrendingUpIcon className="h-4 w-4 text-blue-500" />
                  CMV Real
                </h3>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(buffetMetrics.realCMV, currency)}
                </p>
                <p className="text-sm text-slate-500">
                  Margem: {buffetMetrics.profitMargin.toFixed(1)}%
                </p>
              </div>

              <div className="admin-card p-6">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Lucro Real
                </h3>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(buffetMetrics.profit, currency)}
                </p>
                <p className="text-sm text-slate-500">
                  {buffetMetrics.profitMargin.toFixed(1)}% de margem
                </p>
              </div>
            </div>

            {/* Alertas de Ociosidade */}
            {idleComandas.length > 0 && (
              <div className="admin-card p-6 border-amber-200 bg-amber-50/30">
                <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas de Ociosidade
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Comandas abertas há mais de 1 hora sem fechamento
                </p>
                <div className="space-y-2">
                  {idleComandas.map((c) => (
                    <div key={c.number} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200/80">
                      <span className="font-medium text-slate-900">Comanda #{c.number}</span>
                      <span className="text-sm text-slate-500">
                        {Math.floor(c.minutesOpen / 60)}h {c.minutesOpen % 60}min aberta
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Desempenho por Horário */}
            {weightByInterval.length > 0 && (
              <div className="admin-card p-6 min-w-0 overflow-hidden">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  Pesagens por Intervalo (30min)
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Volume de pesagens para planejamento de reposição
                </p>
                <div className="min-w-0">
                  <div className="w-full min-h-[300px] min-w-0">
                    <ResponsiveContainer width="100%" height={300} minWidth={0}>
                      <BarChart data={weightByInterval}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="interval" stroke="#888" style={{ fontSize: '12px' }} />
                        <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                        <Tooltip
                          formatter={(value: number) => `${value} pesagem(ns)`}
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                        />
                        <Bar dataKey="count" fill="url(#colorWeight)" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.9}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Resetar dados da dashboard */}
        <div className="admin-card p-6 border-dashed border-amber-200 bg-amber-50/30">
          <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2 mb-2">
            <RotateCcw className="h-5 w-5" />
            Resetar dados do painel
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Remove todos os pedidos deste restaurante e zera as métricas da dashboard. É necessário informar sua senha para confirmar.
          </p>
          <div>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
              onClick={() => {
                setShowResetDialog(true);
                setResetPassword('');
                setResetError('');
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar dados (exige senha)
            </Button>
          </div>
        </div>

        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar reset dos dados</DialogTitle>
              <DialogDescription>
                Todos os pedidos deste restaurante serão excluídos permanentemente. Digite sua senha para confirmar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">Sua senha</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="••••••••"
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    setResetError('');
                  }}
                  disabled={resetting}
                  autoComplete="current-password"
                />
                {resetError && (
                  <p className="text-sm text-destructive">{resetError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={resetting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetData}
                disabled={resetting}
              >
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetando...
                  </>
                ) : (
                  'Resetar dados'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Print Report (hidden; visible only during window.print()) ── */}
        <DashboardPrintReport
          restaurantName={restaurantName}
          restaurantLogo={restaurant?.logo ?? undefined}
          period={periodLabel}
          areaLabel={areaFilter !== 'all' ? areaLabel : t('dashboard.filters.all')}
          generatedAt={new Date()}
          currency={currency}
          totalRevenue={metrics.totalRevenue}
          totalOrders={metrics.totalOrders}
          avgTicket={metrics.averageTicket}
          grossProfit={grossProfit}
          avgPrepTime={avgPrepTime}
          avgDeliveryTime={avgDeliveryTime}
          paymentMethods={paymentMethods}
          topProducts={topProducts}
          dailyRevenue={dailyRevenue}
          printPaperWidth={restaurant?.print_paper_width as '58mm' | '80mm' | null}
          t={t}
        />
    </div>
  );
}
