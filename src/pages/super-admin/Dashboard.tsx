import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import {
  Store,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  LogOut,
  ChefHat,
  Layout,
  BookOpen,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Restaurant } from '@/types';

export default function SuperAdminDashboard() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalRevenue: 0,
    totalOrders: 0,
  });
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [ordersByRestaurant, setOrdersByRestaurant] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [restaurantsRes, ordersRes] = await Promise.all([
        supabase.from('restaurants').select('*').order('name'),
        supabase.from('orders').select('restaurant_id'),
      ]);

      if (restaurantsRes.error) throw restaurantsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const list = restaurantsRes.data || [];
      setRestaurants(list);

      const countByRestaurant: Record<string, number> = {};
      (ordersRes.data || []).forEach((o: { restaurant_id: string }) => {
        countByRestaurant[o.restaurant_id] = (countByRestaurant[o.restaurant_id] || 0) + 1;
      });
      setOrdersByRestaurant(countByRestaurant);

      const totalRestaurants = list.length;
      const activeRestaurants = list.filter((r) => r.is_active).length;

      const { data: ordersWithTotal } = await supabase.from('orders').select('total');
      const totalRevenue = ordersWithTotal?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const totalOrders = ordersWithTotal?.length || 0;

      setMetrics({
        totalRestaurants,
        activeRestaurants,
        totalRevenue,
        totalOrders,
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRestaurantStatus = async (restaurantId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !isActive })
        .eq('id', restaurantId);
      if (error) throw error;
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurantId ? { ...r, is_active: !isActive } : r))
      );
      setMetrics((m) => ({
        ...m,
        activeRestaurants: m.activeRestaurants + (isActive ? -1 : 1),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-9 w-48 mb-1" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Painel Geral</h1>
              <p className="text-muted-foreground mt-0.5">
                Visão geral do sistema e todos os restaurantes
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="default"
                onClick={() => navigate('/super-admin/restaurants')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo restaurante
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Métricas */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Métricas globais</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 gradient-primary opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Restaurantes
                </CardTitle>
                <Store className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">
                  {metrics.totalRestaurants}
                </div>
                <p className="text-xs text-white/80">{metrics.activeRestaurants} ativos</p>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 gradient-secondary opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Faturamento total
                </CardTitle>
                <DollarSign className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(metrics.totalRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Total de pedidos
                </CardTitle>
                <ShoppingCart className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">{metrics.totalOrders}</div>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Ticket médio
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(
                    metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lista de restaurantes */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Restaurantes ({restaurants.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/super-admin/restaurants')}
            >
              Gerenciar todos
            </Button>
          </div>

          {restaurants.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Store className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">Nenhum restaurante cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Crie o primeiro restaurante para começar
                </p>
                <Button onClick={() => navigate('/super-admin/restaurants')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar restaurante
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {restaurants.map((restaurant) => (
                <Card key={restaurant.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {restaurant.logo ? (
                          <img
                            src={restaurant.logo}
                            alt={restaurant.name}
                            className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Store className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {restaurant.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {restaurant.phone || restaurant.slug}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ordersByRestaurant[restaurant.id] ?? 0} pedidos
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={restaurant.is_active ? 'default' : 'secondary'}
                        className="flex-shrink-0"
                      >
                        {restaurant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1 min-w-[100px]"
                        onClick={() => navigate(`/super-admin/restaurants/${restaurant.id}`)}
                      >
                        <Layout className="h-3.5 w-3.5 mr-1.5" />
                        Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(`${window.location.origin}/kitchen?restaurant_id=${restaurant.id}`, '_blank')
                        }
                      >
                        <ChefHat className="h-3.5 w-3.5 mr-1.5" />
                        Cozinha
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/${restaurant.slug}`, '_blank')}
                      >
                        <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                        Cardápio
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleRestaurantStatus(restaurant.id, restaurant.is_active)
                        }
                      >
                        {restaurant.is_active ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
