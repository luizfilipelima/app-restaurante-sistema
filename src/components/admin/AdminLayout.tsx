import { ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AdminRestaurantContext } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { getCardapioPublicUrl } from '@/lib/utils';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  MapPin,
  Settings,
  LogOut,
  ArrowLeft,
  ChefHat,
  BookOpen,
  Copy,
  Bike,
  Scale,
  Package,
  LayoutGrid,
  Search,
  Bell,
} from 'lucide-react';

interface AdminLayoutProps {
  children?: ReactNode;
  /** Quando preenchido, super-admin está gerenciando este restaurante */
  managedRestaurantId?: string | null;
  /** Base path para links (ex: /super-admin/restaurants/xxx) */
  basePath?: string;
}

const getNavItems = (basePath: string) => {
  const base = basePath || '/admin';
  return [
    { name: 'Dashboard', href: base, icon: LayoutDashboard },
    { name: 'Pedidos', href: `${base}/orders`, icon: ClipboardList },
    { name: 'Cardápio', href: `${base}/menu`, icon: UtensilsCrossed },
    { name: 'Buffet', href: `${base}/buffet`, icon: Scale },
    { name: 'Mesas', href: `${base}/tables`, icon: LayoutGrid },
    { name: 'Produtos', href: `${base}/products`, icon: Package },
    { name: 'Zonas de Entrega', href: `${base}/delivery-zones`, icon: MapPin },
    { name: 'Entregadores', href: `${base}/couriers`, icon: Bike },
    { name: 'Configurações', href: `${base}/settings`, icon: Settings },
  ];
};

export default function AdminLayout({
  children,
  managedRestaurantId = null,
  basePath = '',
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { toast } = useToast();

  const restaurantId = managedRestaurantId || user?.restaurant_id || null;
  const { data: restaurant, isLoading: loadingRestaurant } = useRestaurant(restaurantId);
  const isSuperAdminView = !!managedRestaurantId;
  const navItems = getNavItems(basePath || '/admin');

  // Gerenciar sessões simultâneas (máximo 3 por restaurante)
  useSessionManager(user?.id || null, restaurantId);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleBackToRestaurants = () => {
    navigate('/super-admin/restaurants');
  };

  const cardapioUrl = restaurant?.slug ? getCardapioPublicUrl(restaurant.slug) : '';
  const copyCardapioLink = () => {
    if (!cardapioUrl) return;
    navigator.clipboard.writeText(cardapioUrl).then(
      () => toast({ title: 'Link copiado', description: 'Link do cardápio copiado para a área de transferência.' }),
      () => toast({ title: 'Erro', description: 'Não foi possível copiar o link.', variant: 'destructive' })
    );
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
    restaurant: restaurant ?? null,
    isSuperAdminView,
  };

  return (
    <AdminRestaurantContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50 overflow-x-hidden">
        {/* Sidebar Desktop - Estilo Shopeers */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:flex-shrink-0 admin-sidebar">
          <div className="flex flex-col flex-grow overflow-y-auto">
            <div className="flex flex-col flex-shrink-0 px-5 py-6 w-full min-w-0">
              {isSuperAdminView && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4 w-full justify-start text-slate-600 hover:bg-slate-100"
                  onClick={handleBackToRestaurants}
                >
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                  Voltar
                </Button>
              )}
              <Link to={basePath || '/admin'} className="flex items-center gap-2 min-w-0">
                <img src="/quierofood-logo-f.svg" alt="Quiero.food" className="h-9 w-auto object-contain flex-shrink-0" />
              </Link>
            </div>
            <div className="flex-1 flex flex-col px-3">
              {/* Acesso rápido */}
              {(user?.role === 'restaurant_admin' || (isSuperAdminView && restaurantId)) && (
                <div className="px-2 pb-3 space-y-2">
                  <Link
                    to={isSuperAdminView ? `/kitchen?restaurant_id=${restaurantId}` : '/kitchen'}
                    className="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <ChefHat className="mr-3 h-5 w-5 text-slate-500" />
                    Modo cozinha
                  </Link>
                  {cardapioUrl && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80">
                      <a
                        href={cardapioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 flex items-center gap-2 text-sm font-medium text-[#F87116] hover:text-[#ea580c] truncate transition-colors"
                      >
                        <BookOpen className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Cardápio</span>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-slate-500 hover:text-slate-700"
                        onClick={copyCardapioLink}
                        title="Copiar link do cardápio"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <nav className="flex-1 space-y-0.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-r-lg transition-colors border-l-4 ml-2 ${
                        isActive ? 'nav-item-active' : 'nav-item'
                      }`}
                    >
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-2 pb-5 pt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-slate-600 hover:bg-slate-100"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Top Bar - Desktop (estilo Shopeers) */}
        <div className="hidden md:block fixed top-0 left-64 right-0 z-30 h-16 bg-white border-b border-slate-200/80">
          <div className="h-full px-6 flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  placeholder="Buscar..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50/50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F87116]/20 focus:border-[#F87116]"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hidden sm:inline">⌘K</kbd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-600">
                  {restaurant?.name?.charAt(0) || 'A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-3 px-4 py-3 min-w-0">
            <div className="min-w-0 flex-1 flex items-center gap-2">
              <img src="/quierofood-logo-f.svg" alt="Quiero.food" className="h-7 w-auto object-contain flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-semibold text-foreground block">Painel Admin</span>
                {restaurant && (
                  <p className="text-xs text-muted-foreground truncate" title={restaurant.name}>{restaurant.name}</p>
                )}
              </div>
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
          {(user?.role === 'restaurant_admin' || (isSuperAdminView && restaurantId)) && (
            <div className="px-4 pb-2 space-y-2">
              <Link
                to={isSuperAdminView ? `/kitchen?restaurant_id=${restaurantId}` : '/kitchen'}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-dashed border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ChefHat className="h-4 w-4" />
                Modo cozinha
              </Link>
              {cardapioUrl && (
                <div className="flex items-center gap-2">
                  <a
                    href={cardapioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-dashed border-border/60 text-primary hover:bg-accent flex-1 min-w-0 truncate"
                  >
                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Cardápio</span>
                  </a>
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={copyCardapioLink} title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-[#F87116]'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
          <main className="pt-20 md:pt-20 min-h-screen bg-slate-50">
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto min-w-0">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </AdminRestaurantContext.Provider>
  );
}
