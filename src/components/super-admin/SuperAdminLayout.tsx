/**
 * Layout exclusivo do painel Super Admin.
 *
 * Design proposital diferente do AdminLayout (restaurante):
 *   — Sidebar com fundo muito escuro (slate-950) e acento violet/indigo
 *   — Sinaliza ao usuário que está na visão de "Dono do SaaS"
 *   — Sem a identidade visual do restaurante (sem logo de cliente)
 */

import { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  LogOut,
  Zap,
  ChevronRight,
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
  /** Para uso direto em testes/Storybook; normalmente usa <Outlet /> */
  children?: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();
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
      <aside className="w-60 flex-shrink-0 flex flex-col bg-slate-950 text-slate-300 overflow-y-auto">

        {/* Logo / Branding */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-lg shadow-violet-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white tracking-wider uppercase leading-none">
                SaaS Admin
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-none">
                Painel de controle
              </p>
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Gestão
          </p>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: info do usuário + sign out */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-1">
          <div className="px-3 py-2 rounded-lg bg-slate-900">
            <p className="text-xs font-semibold text-slate-300 truncate">
              {user?.login || user?.email || 'Super Admin'}
            </p>
            <p className="text-[10px] text-violet-400 font-medium mt-0.5">
              Acesso total ao SaaS
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
