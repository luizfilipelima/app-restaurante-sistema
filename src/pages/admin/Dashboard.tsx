import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DollarSign, ShoppingCart, TrendingUp, Clock, ArrowUpRight, RotateCcw, Loader2 } from 'lucide-react';
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

export default function AdminDashboard() {
  const restaurantId = useAdminRestaurantId();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
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
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  useEffect(() => {
    if (restaurantId) {
      loadMetrics();
    }
  }, [restaurantId]);

  const loadMetrics = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      // Buscar pedidos dos últimos 30 dias
      const thirtyDaysAgo = subDays(new Date(), 30);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Calcular métricas
      const totalRevenue = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const pendingOrders = orders?.filter((o) => o.status === 'pending').length || 0;

      setMetrics({
        totalRevenue,
        totalOrders,
        averageTicket,
        pendingOrders,
      });

      // Agrupar por dia (últimos 7 dias)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return {
          date: format(date, 'dd/MM', { locale: ptBR }),
          fullDate: date,
          revenue: 0,
          orders: 0,
        };
      });

      orders?.forEach((order) => {
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

      // Agrupar por forma de pagamento
      const paymentData = orders?.reduce((acc: any, order) => {
        const method = order.payment_method;
        if (!acc[method]) {
          acc[method] = { name: method, value: 0 };
        }
        acc[method].value += order.total;
        return acc;
      }, {});

      setPaymentMethods(Object.values(paymentData || {}));

    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-96" />
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 min-w-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Visão geral do seu negócio (últimos 30 dias)
          </p>
        </div>

        {/* Cards de Métricas */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
          <Card className="border-0 shadow-premium hover:shadow-premium-lg transition-shadow overflow-hidden group">
            <div className="absolute inset-0 gradient-primary opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white/90">
                Faturamento Total
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white mb-1">
                {formatCurrency(metrics.totalRevenue)}
              </div>
              <div className="flex items-center text-white/80 text-xs">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>Últimos 30 dias</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-premium hover:shadow-premium-lg transition-shadow overflow-hidden group">
            <div className="absolute inset-0 gradient-secondary opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white/90">
                Total de Pedidos
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white mb-1">
                {metrics.totalOrders}
              </div>
              <div className="flex items-center text-white/80 text-xs">
                <span>Pedidos realizados</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-premium hover:shadow-premium-lg transition-shadow overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white/90">
                Ticket Médio
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white mb-1">
                {formatCurrency(metrics.averageTicket)}
              </div>
              <div className="flex items-center text-white/80 text-xs">
                <span>Valor médio por pedido</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-premium hover:shadow-premium-lg transition-shadow overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white/90">
                Pedidos Pendentes
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white mb-1">
                {metrics.pendingOrders}
              </div>
              <div className="flex items-center text-white/80 text-xs">
                <span>Aguardando preparo</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 min-w-0">
          <Card className="border-0 shadow-premium hover:shadow-premium-lg transition-shadow min-w-0 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-foreground">
                Faturamento Diário (Últimos 7 dias)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Acompanhe o desempenho diário das vendas
              </p>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="w-full min-h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#888" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
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
            </CardContent>
          </Card>

          <Card className="border-0 shadow-premium hover:shadow-premium-lg transition-shadow min-w-0 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-foreground">
                Formas de Pagamento
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Distribuição dos métodos de pagamento
              </p>
            </CardHeader>
            <CardContent className="min-w-0">
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
                      formatter={(value: number) => formatCurrency(value)}
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
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Sem dados de pagamento</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resetar dados da dashboard */}
        <Card className="border-dashed border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <RotateCcw className="h-5 w-5" />
              Resetar dados do painel
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Remove todos os pedidos deste restaurante e zera as métricas da dashboard. É necessário informar sua senha para confirmar.
            </p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

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
