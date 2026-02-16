import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Store, DollarSign, ShoppingCart, TrendingUp, LogOut } from 'lucide-react';

export default function SuperAdminDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalRevenue: 0,
    totalOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);

      // Total de restaurantes
      const { count: totalRestaurants } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true });

      // Restaurantes ativos
      const { count: activeRestaurants } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Total de pedidos e faturamento
      const { data: orders } = await supabase
        .from('orders')
        .select('total');

      const totalRevenue = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const totalOrders = orders?.length || 0;

      setMetrics({
        totalRestaurants: totalRestaurants || 0,
        activeRestaurants: activeRestaurants || 0,
        totalRevenue,
        totalOrders,
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Super Admin</h1>
              <p className="text-primary-foreground/80">
                Painel de controle do sistema
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate('/super-admin/restaurants')}
              >
                <Store className="h-4 w-4 mr-2" />
                Restaurantes
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Métricas Globais</h2>
          </div>

          {/* Cards de Métricas */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Restaurantes
                </CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.totalRestaurants}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.activeRestaurants} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Faturamento Total
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics.totalRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Pedidos
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Ticket Médio
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    metrics.totalOrders > 0
                      ? metrics.totalRevenue / metrics.totalOrders
                      : 0
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => navigate('/super-admin/restaurants')}>
                <Store className="h-4 w-4 mr-2" />
                Gerenciar Restaurantes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
