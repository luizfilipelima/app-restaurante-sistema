import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Restaurant } from '@/types';
import { AdminRestaurantContext } from '@/contexts/AdminRestaurantContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  MapPin,
  Settings,
  LogOut,
  ArrowLeft,
  ExternalLink,
  ChefHat,
  BookOpen,
  Layout,
  Users,
} from 'lucide-react';

interface AdminLayoutProps {
  children?: ReactNode;
  /** Quando preenchido, super-admin está gerenciando este restaurante */
  managedRestaurantId?: string | null;
  /** Base path para links (ex: /super-admin/restaurants/xxx) */
  basePath?: string;
}

const getNavItems = (basePath: string, isSuperAdminView?: boolean) => {
  const base = basePath || '/admin';
  const items = [
    { name: 'Dashboard', href: base, icon: LayoutDashboard },
    { name: 'Pedidos', href: `${base}/orders`, icon: ClipboardList },
    { name: 'Cardápio', href: `${base}/menu`, icon: UtensilsCrossed },
    { name: 'Zonas de Entrega', href: `${base}/delivery-zones`, icon: MapPin },
    { name: 'Configurações', href: `${base}/settings`, icon: Settings },
  ];
  if (isSuperAdminView) {
    items.push({ name: 'Usuários', href: `${base}/users`, icon: Users });
  }
  return items;
};

export default function AdminLayout({
  children,
  managedRestaurantId = null,
  basePath = '',
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(!!managedRestaurantId);

  const restaurantId = managedRestaurantId || user?.restaurant_id || null;
  const isSuperAdminView = !!managedRestaurantId;
  const navItems = getNavItems(basePath || '/admin', isSuperAdminView);

  useEffect(() => {
    if (!restaurantId) {
      setLoadingRestaurant(false);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();
      setRestaurant(data || null);
      setLoadingRestaurant(false);
    };
    load();
  }, [restaurantId]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleBackToRestaurants = () => {
    navigate('/super-admin/restaurants');
  };

  if (!restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Nenhum restaurante selecionado.</p>
      </div>
    );
  }

  if (loadingRestaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const contextValue = {
    restaurantId,
    restaurant,
    isSuperAdminView,
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cardapioUrl = restaurant?.slug ? `${baseUrl}/${restaurant.slug}` : '';
  const kitchenUrl = `${baseUrl}/kitchen`;
  const adminPanelUrl = basePath ? `${baseUrl}${basePath}` : `${baseUrl}/admin`;

  return (
    <AdminRestaurantContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background overflow-x-hidden">
        {/* Sidebar Desktop */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:flex-shrink-0">
          <div className="flex flex-col flex-grow border-r bg-card overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 py-6">
              {isSuperAdminView && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2 w-full justify-start"
                  onClick={handleBackToRestaurants}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              )}
              <h1 className="text-2xl font-bold text-primary">Painel Admin</h1>
              {restaurant && (
                <p className="text-sm text-muted-foreground mt-1 truncate" title={restaurant.name}>
                  {restaurant.name}
                </p>
              )}
            </div>
            {/* Acesso Rápido */}
            {restaurant?.slug && (
              <div className="px-2 pb-3 border-b border-border/50">
                <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acesso rápido</p>
                <div className="space-y-1">
                  <a
                    href={cardapioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    Cardápio digital
                    <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
                  </a>
                  <a
                    href={kitchenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <ChefHat className="h-4 w-4 shrink-0" />
                    Painel da cozinha
                    <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
                  </a>
                  <a
                    href={adminPanelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Layout className="h-4 w-4 shrink-0" />
                    Painel admin
                    <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
                  </a>
                </div>
              </div>
            )}
            <div className="flex-1 flex flex-col">
              <nav className="flex-1 px-2 space-y-1 pt-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-2 pb-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-xl font-bold text-primary">Painel Admin</h1>
              {restaurant && (
                <p className="text-xs text-muted-foreground truncate">{restaurant.name}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          {isSuperAdminView && (
            <div className="px-4 pb-2">
              <Button variant="outline" size="sm" onClick={handleBackToRestaurants}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar aos restaurantes
              </Button>
            </div>
          )}
          {restaurant?.slug && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              <a href={cardapioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <BookOpen className="h-3 w-3" /> Cardápio
              </a>
              <a href={kitchenUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChefHat className="h-3 w-3" /> Cozinha
              </a>
              <a href={adminPanelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Layout className="h-3 w-3" /> Admin
              </a>
            </div>
          )}
          <div className="overflow-x-auto px-4 pb-3">
            <div className="flex gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:pl-64 min-w-0 flex-1 w-full">
          <main className="pt-24 md:pt-8 min-h-screen bg-muted/30">
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto min-w-0">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </AdminRestaurantContext.Provider>
  );
}
