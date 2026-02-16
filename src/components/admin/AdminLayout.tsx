import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  MapPin,
  Settings,
  LogOut,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Pedidos', href: '/admin/orders', icon: ClipboardList },
  { name: 'Cardápio', href: '/admin/menu', icon: UtensilsCrossed },
  { name: 'Zonas de Entrega', href: '/admin/delivery-zones', icon: MapPin },
  { name: 'Configurações', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar Desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow border-r bg-card overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 py-6">
            <h1 className="text-2xl font-bold text-primary">Painel Admin</h1>
          </div>
          <div className="flex-1 flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
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
          <h1 className="text-xl font-bold text-primary">Painel Admin</h1>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-x-auto px-4 pb-3">
          <div className="flex gap-2">
            {navigation.map((item) => {
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
      <div className="md:pl-64">
        <main className="pt-24 md:pt-0">
          <div className="px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
