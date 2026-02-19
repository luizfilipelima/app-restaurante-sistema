/**
 * Layout do painel Super Admin.
 *
 * Design deliberadamente espelhado do AdminLayout (restaurante):
 *   — Mesma sidebar branca com logo quiero.food
 *   — Mesmo esquema de cores laranja para itens ativos
 *   — Badge "Super Admin" abaixo do logo para distinguir da visão de restaurante
 *
 * Isso garante consistência visual entre os dois painéis,
 * enquanto o badge e as rotas diferentes deixam claro ao usuário em qual contexto está.
 */

import { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

// ─── Itens de navegação ───────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard (BI)',  href: '/super-admin',             icon: LayoutDashboard, exact: true },
  { label: 'Restaurantes',    href: '/super-admin/restaurants', icon: Store },
  { label: 'Planos & Preços', href: '/super-admin/plans',       icon: CreditCard },
];

// ─── Componente ───────────────────────────────────────────────────────────────

interface SuperAdminLayoutProps {
  children?: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.href
      : location.pathname.startsWith(item.href);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20">
        <div className="flex flex-col flex-grow bg-white border-r border-slate-100 overflow-y-auto">

          {/* Logo + Badge "Super Admin" */}
          <div className="flex flex-col flex-shrink-0 px-5 pt-6 pb-4 border-b border-slate-100">
            <Link to="/super-admin" className="flex items-center gap-2 min-w-0">
              <img
                src="/quierofood-logo-f.svg"
                alt="Quiero.food"
                className="h-9 w-auto object-contain flex-shrink-0"
              />
            </Link>
            {/* Badge: identifica a visão de "Dono do SaaS" */}
            <div className="mt-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-[#F87116] flex-shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F87116]">
                Super Admin
              </span>
            </div>
          </div>

          {/* Navegação principal */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
              Gestão
            </p>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors border-l-[3px] ${
                    active
                      ? 'bg-orange-50 text-[#F87116] border-l-[#F87116]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-transparent'
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && (
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[#F87116]/60" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer: e-mail do usuário + Sair */}
          <div className="flex-shrink-0 px-3 py-4 border-t border-slate-100 space-y-1">
            {/* Info do usuário */}
            <div className="px-3 py-2 rounded-lg bg-slate-50">
              <p className="text-xs font-medium text-slate-700 truncate">
                {user?.login || user?.email}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Acesso total ao SaaS</p>
            </div>
            {/* Sair */}
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-[18px] w-[18px]" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* ── Conteúdo principal ────────────────────────────────────────────── */}
      <div className="md:pl-64 flex-1 overflow-y-auto">
        {children ?? <Outlet />}
      </div>
    </div>
  );
}
