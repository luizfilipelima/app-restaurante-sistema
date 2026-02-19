import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
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
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, ShoppingCart, TrendingUp, TrendingDown, Clock, RotateCcw, Loader2, MapPin, Scale, AlertTriangle, TrendingUp as TrendingUpIcon } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const PERIOD_OPTIONS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '365', label: 'Último ano' },
  { value: 'max', label: 'Máximo (todos)' },
] as const;
type PeriodValue = '30' | '365' | 'max';

const AREA_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'table', label: 'Mesas' },
  { value: 'pickup', label: 'Retirada' },
  { value: 'buffet', label: 'Buffet' },
] as const;
type AreaValue = 'all' | 'delivery' | 'table' | 'pickup' | 'buffet';

export default function AdminDashboard() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodValue>('30');
  const [areaFilter, setAreaFilter] = useState<AreaValue>('all');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageTicket: 0,
    pendingOrders: 0,
  });
  const [prevMetrics, setPrevMetrics] = useState({ totalRevenue: 0, totalOrders: 0 });
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [topZone, setTopZone] = useState<{ name: string; count: number } | null>(null);
  const [peakHours, setPeakHours] = useState<{ hour: number; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [bottomProducts, setBottomProducts] = useState<{ name: string; quantity: number }[]>([]);
  
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
      loadMetrics();
    }
  }, [restaurantId, period, areaFilter]);

  const loadMetrics = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      let startDate: Date | null = null;
      if (period === '30') startDate = subDays(new Date(), 30);
      else if (period === '365') startDate = subDays(new Date(), 365);

      let query = supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId);
      if (startDate) query = query.gte('created_at', startDate.toISOString());
      const { data: orders, error } = await query;

      if (error) throw error;
      let orderList = orders || [];

      // Filtrar por área (order_source / delivery_type)
      if (areaFilter === 'delivery') {
        orderList = orderList.filter((o: any) =>
          o.order_source === 'delivery' || (!o.order_source && o.delivery_type === 'delivery')
        );
      } else if (areaFilter === 'table') {
        orderList = orderList.filter((o: any) => o.order_source === 'table');
      } else if (areaFilter === 'pickup') {
        orderList = orderList.filter((o: any) =>
          o.order_source === 'pickup' || (!o.order_source && o.delivery_type === 'pickup')
        );
      } else if (areaFilter === 'buffet') {
        // Buffet usa comandas; cards de pedidos mostram 0
        orderList = [];
      }

      const orderIds = orderList.map((o: { id: string }) => o.id);
      const { data: zonesData } = await supabase
        .from('delivery_zones')
        .select('id, location_name')
        .eq('restaurant_id', restaurantId);
      const zonesMap: Record<string, string> = {};
      (zonesData || []).forEach((z: { id: string; location_name: string }) => {
        zonesMap[z.id] = z.location_name || 'Sem nome';
      });

      let orderItems: { order_id: string; product_name: string; quantity: number }[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product_name, quantity')
          .in('order_id', orderIds);
        orderItems = items || [];
      }

      const totalRevenue = orderList.reduce((sum: number, o: { total?: number }) => sum + (o.total || 0), 0);
      const totalOrders = orderList.length;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const pendingOrders = orderList.filter((o: { status: string }) => o.status === 'pending').length;

      setMetrics({ totalRevenue, totalOrders, averageTicket, pendingOrders });

      // Período anterior para comparação "vs last period"
      let prevRevenue = 0;
      let prevOrders = 0;
      if (startDate && period !== 'max' && areaFilter !== 'buffet') {
        const prevStart = subDays(startDate, period === '30' ? 30 : 365);
        let prevQuery = supabase
          .from('orders')
          .select('id, total, order_source, delivery_type, delivery_zone_id')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', prevStart.toISOString())
          .lt('created_at', startDate.toISOString());
        const { data: prevOrdersData } = await prevQuery;
        let prevList = prevOrdersData || [];
        if (areaFilter === 'delivery') prevList = prevList.filter((o: any) => o.order_source === 'delivery' || (!o.order_source && o.delivery_type === 'delivery'));
        else if (areaFilter === 'table') prevList = prevList.filter((o: any) => o.order_source === 'table');
        else if (areaFilter === 'pickup') prevList = prevList.filter((o: any) => o.order_source === 'pickup' || (!o.order_source && o.delivery_type === 'pickup'));
        prevOrders = prevList.length;
        prevRevenue = prevList.reduce((s: number, o: { total?: number }) => s + (o.total || 0), 0);
      }
      setPrevMetrics({ totalRevenue: prevRevenue, totalOrders: prevOrders });

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return {
          date: format(date, 'dd/MM', { locale: ptBR }),
          fullDate: date,
          revenue: 0,
          orders: 0,
        };
      });
      orderList.forEach((order: { created_at: string; total: number }) => {
        const orderDate = new Date(order.created_at);
        const dayData = last7Days.find(
          (d) =>
            orderDate >= startOfDay(d.fullDate) &&
            orderDate <= endOfDay(d.fullDate)
        );
        if (dayData) {
          dayData.revenue += order.total;
          dayData.orders += 1;
        }
      });
      setDailyRevenue(last7Days.map(({ fullDate, ...rest }) => rest));

      const paymentData = orderList.reduce((acc: Record<string, { name: string; value: number }>, order: { payment_method: string; total: number }) => {
        const method = order.payment_method;
        if (!acc[method]) acc[method] = { name: method, value: 0 };
        acc[method].value += order.total;
        return acc;
      }, {});
      setPaymentMethods(Object.values(paymentData));

      const zoneCounts: Record<string, number> = {};
      orderList.forEach((o: { delivery_zone_id?: string }) => {
        const zid = o.delivery_zone_id || 'sem_zona';
        zoneCounts[zid] = (zoneCounts[zid] || 0) + 1;
      });
      const topZoneEntry = Object.entries(zoneCounts)
        .filter(([k]) => k !== 'sem_zona')
        .sort((a, b) => b[1] - a[1])[0];
      setTopZone(
        topZoneEntry
          ? { name: zonesMap[topZoneEntry[0]] || topZoneEntry[0], count: topZoneEntry[1] }
          : null
      );

      const hourCounts: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourCounts[h] = 0;
      orderList.forEach((o: { created_at: string }) => {
        const h = new Date(o.created_at).getHours();
        hourCounts[h]++;
      });
      setPeakHours(
        Object.entries(hourCounts)
          .map(([hour, count]) => ({ hour: Number(hour), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      const productCounts: Record<string, number> = {};
      orderItems.forEach((item: { product_name: string; quantity: number }) => {
        const name = item.product_name || 'Sem nome';
        productCounts[name] = (productCounts[name] || 0) + item.quantity;
      });
      const sorted = Object.entries(productCounts)
        .map(([name, qty]) => ({ name, quantity: qty }))
        .sort((a, b) => b.quantity - a.quantity);
      setTopProducts(sorted.slice(0, 5));
      setBottomProducts(sorted.slice(-5).reverse());

      // Carregar métricas de Buffet (sempre, para mostrar seção quando aplicável)
      await loadBuffetMetrics(startDate);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuffetMetrics = async (startDate: Date | null) => {
    if (!restaurantId) return;

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
      loadMetrics();
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

  const periodLabel = period === '30' ? 'últimos 30 dias' : period === '365' ? 'último ano' : 'todo o período';
  const areaLabel = AREA_OPTIONS.find((o) => o.value === areaFilter)?.label ?? 'Todos';

  const revPct = pctChange(metrics.totalRevenue, prevMetrics.totalRevenue);
  const ordPct = pctChange(metrics.totalOrders, prevMetrics.totalOrders);

  return (
    <div className="space-y-6 min-w-0">
        {/* Header + Filtros - Estilo Shopeers */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {periodLabel}{areaFilter !== 'all' ? ` · ${areaLabel}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as AreaValue)}>
              <SelectTrigger className="w-full sm:w-[160px] h-10 bg-white border-slate-200">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                {AREA_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodValue)}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white border-slate-200">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cards de Métricas - Estilo Shopeers (brancos, limpos, trend) */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
          <div className="admin-metric-card">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Faturamento</p>
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(metrics.totalRevenue, currency)}
            </p>
            {prevMetrics.totalRevenue > 0 && (
              <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${Number(revPct) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {Number(revPct) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {revPct}% vs. período anterior
              </p>
            )}
          </div>

          <div className="admin-metric-card">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Pedidos</p>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.totalOrders}</p>
            {prevMetrics.totalOrders > 0 && (
              <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${Number(ordPct) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {Number(ordPct) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {ordPct}% vs. período anterior
              </p>
            )}
          </div>

          <div className="admin-metric-card">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Ticket Médio</p>
              <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-violet-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(metrics.averageTicket, currency)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Valor médio por pedido</p>
          </div>

          <div className="admin-metric-card">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Pendentes</p>
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.pendingOrders}</p>
            <p className="text-xs text-slate-400 mt-1">Aguardando preparo</p>
          </div>
        </div>

        {/* Gráficos - Cards brancos estilo Shopeers */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 min-w-0">
          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Faturamento Diário (Últimos 7 dias)
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Acompanhe o desempenho diário das vendas
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
                Formas de Pagamento
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Distribuição dos métodos de pagamento
              </p>
            </div>
            <div className="min-w-0">
              {paymentMethods.length > 0 ? (
                <div className="w-full min-h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => paymentMethodNames[entry.name] || entry.name}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethods.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, currency)}
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend
                      formatter={(value) => paymentMethodNames[value] || value}
                      wrapperStyle={{ fontSize: '14px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-400">
                  <div className="text-center">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Sem dados de pagamento</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BI: Região, horário pico, itens mais/menos pedidos */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 min-w-0">
          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-blue-500" />
              Região mais pedida
            </h3>
            {topZone ? (
              <div>
                <p className="text-xl font-bold text-slate-900 truncate" title={topZone.name}>
                  {topZone.name}
                </p>
                <p className="text-sm text-slate-500">{topZone.count} pedidos</p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Sem dados de região no período</p>
            )}
          </div>

          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-500" />
              Horários de pico
            </h3>
            {peakHours.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {peakHours.map(({ hour, count }) => (
                  <li key={hour} className="flex justify-between">
                    <span className="text-slate-500">{hour}h – {hour + 1}h</span>
                    <span className="font-medium text-slate-900">{count} pedidos</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Sem pedidos no período</p>
            )}
          </div>

          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Itens mais pedidos
            </h3>
            {topProducts.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {topProducts.map(({ name, quantity }) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="text-slate-700 truncate" title={name}>{name}</span>
                    <span className="font-medium text-slate-900 shrink-0">{quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Sem itens no período</p>
            )}
          </div>

          <div className="admin-card p-6 min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Itens menos pedidos
            </h3>
            {bottomProducts.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {bottomProducts.map(({ name, quantity }) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="text-slate-700 truncate" title={name}>{name}</span>
                    <span className="font-medium text-slate-900 shrink-0">{quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Sem itens no período</p>
            )}
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
    </div>
  );
}
