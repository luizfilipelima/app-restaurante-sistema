import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/PageTransition';
import { useAuthStore } from '@/store/authStore';
import { AdminRestaurantContext, useAdminRestaurantId, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { useCanAccess } from '@/hooks/auth/useUserRole';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/shared/use-toast';
import { useSessionManager } from '@/hooks/auth/useSessionManager';
import { getCardapioPublicUrl } from '@/lib/core/utils';
import { prefetchRoute } from '@/lib/routePrefetch';
import { supabase } from '@/lib/core/supabase';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  MapPin,
  Clock,
  CalendarClock,
  Settings,
  LogOut,
  ArrowLeft,
  ChefHat,
  Copy,
  Bike,
  Scale,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Sparkles,
  ScanBarcode,
  Boxes,
  Smartphone,
  Instagram,
  Tag,
  Ticket,
  Gift,
  MoreHorizontal,
  Link2,
  Eye,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

// ─── Variantes de animação (definidas fora do componente para evitar recriação) ─

const sidebarNavVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};

const sidebarSectionVariants = {
  hidden:  { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

// ─────────────────────────────────────────────────────────────────────────────

interface AdminLayoutProps {
  children?: ReactNode;
  /** Quando preenchido, super-admin está gerenciando este restaurante */
  managedRestaurantId?: string | null;
  /** Base path para links (ex: /super-admin/restaurants/xxx) */
  basePath?: string;
}

// ─── Tipos da estrutura de navegação ────────────────────────────────────────

interface NavLeaf {
  kind: 'leaf';
  name: string;
  href: string;
  icon: LucideIcon;
  /**
   * Se true, o item abre em nova aba via <a target="_blank"> em vez de
   * usar o React Router <Link> (útil para links que saem do SPA, ex: KDS).
   */
  external?: boolean;
  /**
   * Se preenchido, o item é protegido por plano de assinatura.
   * Quando o restaurante não tem a feature, o item é exibido como bloqueado
   * (tom cinza + ícone de cadeado) em vez de ser ocultado.
   */
  featureFlag?: string;
  /** Descrição curta exibida no tooltip do item bloqueado */
  featureLabel?: string;
  /**
   * Se preenchido, o item só é visível para usuários com esses cargos
   * (hierarquia respeitada: roles superiores também têm acesso).
   * Quando o usuário não tem o cargo, o item é ocultado completamente
   * (sem cadeado — diferente do featureFlag que exibe bloqueado).
   */
  roleRequired?: string[];
}

interface NavSubMenu {
  kind: 'submenu';
  key: string;
  name: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

interface NavGroup {
  kind: 'group';
  label: string;
  items: NavLeaf[];
}

interface NavCollapsible {
  kind: 'collapsible';
  key: string;
  label: string;
  icon: LucideIcon;
  items: (NavLeaf | NavSubMenu)[];
}

type NavSection = NavGroup | NavCollapsible;

// ─── Configuração da navegação ───────────────────────────────────────────────

type TFn = (key: string) => string;

const buildNavSections = (base: string, t: TFn): NavSection[] => [
  // 1. VISÃO GERAL — Dashboard BI Global
  {
    kind: 'group',
    label: t('nav.groups.overview'),
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.dashboard'),
        href: base,
        icon: LayoutDashboard,
        roleRequired: ['owner', 'restaurant_admin', 'super_admin'],
      },
    ],
  },
  // 2. SALÃO & PDV (Frente de Loja)
  {
    kind: 'group',
    label: t('nav.groups.hallAndPDV'),
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.cashier'),
        href: `${base}/cashier`,
        icon: ScanBarcode,
        featureFlag: 'feature_virtual_comanda',
        featureLabel: 'Plano Enterprise',
        roleRequired: ['cashier'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.buffet'),
        href: `${base}/buffet`,
        icon: Scale,
        featureFlag: 'feature_buffet_module',
        featureLabel: 'Plano Enterprise',
        roleRequired: ['cashier'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.tablesCentral'),
        href: `${base}/tables`,
        icon: LayoutGrid,
        featureFlag: 'feature_tables',
        featureLabel: 'Plano Standard',
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.reservations'),
        href: `${base}/reservations`,
        icon: CalendarClock,
        featureFlag: 'feature_reservations',
        featureLabel: 'Plano Enterprise',
        roleRequired: ['manager', 'restaurant_admin', 'super_admin', 'cashier'],
      },
    ],
  },
  // 3. DELIVERY & LOGÍSTICA (Hub exclusivo)
  {
    kind: 'group',
    label: t('nav.groups.deliveryLogistics'),
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.ordersDelivery'),
        href: `${base}/orders`,
        icon: ClipboardList,
        roleRequired: ['waiter'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.couriers'),
        href: `${base}/couriers`,
        icon: Bike,
        featureFlag: 'feature_couriers',
        featureLabel: 'Plano Standard',
        roleRequired: ['manager'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.deliveryAreas'),
        href: `${base}/delivery-zones`,
        icon: MapPin,
        featureFlag: 'feature_delivery_zones',
        featureLabel: 'Plano Standard',
        roleRequired: ['manager'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.horarios'),
        href: `${base}/horarios`,
        icon: Clock,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
    ],
  },
  // 4. CARDÁPIO & ESTOQUE
  {
    kind: 'group',
    label: t('nav.groups.menuStock'),
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.menuCentral'),
        href: `${base}/menu`,
        icon: UtensilsCrossed,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.inventory'),
        href: `${base}/inventory`,
        icon: Boxes,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
    ],
  },
  // 5. MARKETING & VENDAS
  {
    kind: 'group',
    label: t('nav.groups.marketingSales'),
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.offers'),
        href: `${base}/offers`,
        icon: Tag,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.coupons'),
        href: `${base}/coupons`,
        icon: Ticket,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
      {
        kind: 'leaf',
        name: t('nav.items.loyalty'),
        href: `${base}/loyalty`,
        icon: Gift,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
    ],
  },
];

/** Retorna todos os hrefs de uma seção (para checar se algum está ativo) */
const collectHrefs = (section: NavSection): string[] => {
  const hrefs: string[] = [];
  section.items.forEach((item) => {
    if (item.kind === 'leaf')    hrefs.push(item.href);
    if (item.kind === 'submenu') item.items.forEach((i) => hrefs.push(i.href));
  });
  return hrefs;
};

/** Retorna todos os hrefs de um submenu */
const submenuHrefs = (sub: NavSubMenu): string[] => sub.items.map((i) => i.href);

// ─── Componente: item de navegação folha (link direto) ───────────────────────

function NavLinkItem({ item, isActive }: { item: NavLeaf; isActive: boolean }) {
  const className = `group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors border-l-[3px] ${
    isActive
      ? 'bg-orange-50 text-[#F87116] border-l-[#F87116]'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-transparent'
  }`;

  // Links externos (ex: KDS) abrem em nova aba.
  // Injetamos o token da sessão atual no hash da URL para que o KDS
  // (subdomínio diferente, localStorage separado) não exija login novamente.
  if (item.external) {
    const handleExternalClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      let url = item.href;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          url += `#access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=${session.expires_in}&token_type=bearer&type=recovery`;
        }
      } catch {
        // Se falhar, abre sem token (o KDS pedirá login normalmente)
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
      <a
        href={item.href}
        onClick={handleExternalClick}
        rel="noopener noreferrer"
        className={className}
      >
        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="truncate">{item.name}</span>
        <ExternalLink className="h-3 w-3 ml-auto opacity-40 group-hover:opacity-70" />
      </a>
    );
  }

  return (
    <Link to={item.href} className={className} onMouseEnter={() => prefetchRoute(item.href)}>
      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

// ─── Componente: item bloqueado (sem plano) ──────────────────────────────────
// Clicável: leva para a página de planos com contexto da feature bloqueada.

function LockedNavItem({ item }: { item: NavLeaf }) {
  const basePath = useAdminBasePath();
  return (
    <Link
      to={`${basePath}/upgrade`}
      state={item.featureFlag ? { feature: item.featureFlag } : undefined}
      title={`${item.featureLabel ?? 'Plano superior'} — clique para ver os planos disponíveis`}
      className="group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg
                 border-l-[3px] border-l-transparent text-slate-400 hover:bg-amber-50
                 hover:text-amber-700 hover:border-l-amber-400 transition-colors select-none"
    >
      <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-50 group-hover:opacity-70" />
      <span className="flex-1 truncate opacity-70 group-hover:opacity-90">{item.name}</span>
      <span className="flex items-center gap-1 shrink-0">
        {item.featureLabel && (
          <span className="hidden group-hover:inline-flex items-center gap-0.5 text-[9px] font-semibold
                           bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
            <Sparkles className="h-2.5 w-2.5" />
            {item.featureLabel}
          </span>
        )}
        <Lock className="h-3 w-3 opacity-40 group-hover:opacity-70" />
      </span>
    </Link>
  );
}

// ─── Componente: wrapper que escolhe NavLinkItem, LockedNavItem ou null ───────

function GuardedNavItem({ item, isActive }: { item: NavLeaf; isActive: boolean }) {
  const restaurantId = useAdminRestaurantId();

  // IMPORTANTE: Todos os hooks devem ser chamados incondicionalmente, antes de qualquer return,
  // para respeitar as regras dos Hooks do React. Caso contrário ocorre Error #300.
  const hasRoleAccess = useCanAccess(item.roleRequired ?? ['kitchen']);
  const { data: hasFeatureAccess, isLoading } = useFeatureAccess(
    item.featureFlag ?? '',
    item.featureFlag ? restaurantId : null,
  );

  const isRoleRestricted = !!item.roleRequired;
  if (isRoleRestricted && !hasRoleAccess) return null;

  // Sem flag de feature → sempre acessível (do ponto de vista de plano).
  if (!item.featureFlag) {
    return <NavLinkItem item={item} isActive={isActive} />;
  }

  // Durante o carregamento, renderiza normalmente (otimista) para evitar saltos.
  if (isLoading) {
    return <NavLinkItem item={item} isActive={isActive} />;
  }

  // Plano não inclui esta feature → exibe item bloqueado com cadeado.
  return hasFeatureAccess
    ? <NavLinkItem item={item} isActive={isActive} />
    : <LockedNavItem item={item} />;
}

// ─── Componente: sub-menu colapsável de segundo nível (ex: Delivery) ─────────

function SubMenuSection({
  sub,
  currentPath,
}: {
  sub: NavSubMenu;
  currentPath: string;
}) {
  const hasActiveChild = submenuHrefs(sub).some((h) => currentPath === h);
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors border-l-[3px] ${
          hasActiveChild
            ? 'text-[#F87116] border-l-[#F87116] bg-orange-50/60'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-transparent'
        }`}
      >
        <sub.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="flex-1 truncate text-left">{sub.name}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
        }
      </button>

      {open && (
        <div className="mt-0.5 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
          {sub.items.map((leaf) => (
            <GuardedNavItem key={leaf.href} item={leaf} isActive={currentPath === leaf.href} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Link de Configurações (usa useCanAccess dentro do Provider) ──────────────

const SETTINGS_ROLES = ['manager', 'owner', 'restaurant_admin', 'super_admin'] as const;

function SettingsLink({ base }: { base: string }) {
  const canAccess = useCanAccess([...SETTINGS_ROLES]);
  if (!canAccess) return null;
  return (
    <Link
      to={`${base}/settings`}
      title="Configurações"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
    >
      <Settings className="h-4 w-4" />
    </Link>
  );
}

function SettingsDropdownItem({ base }: { base: string }) {
  const canAccess = useCanAccess([...SETTINGS_ROLES]);
  if (!canAccess) return null;
  return (
    <DropdownMenuItem asChild>
      <Link to={`${base}/settings`} className="gap-2 cursor-pointer">
        <Settings className="h-4 w-4" />
        Configurações
      </Link>
    </DropdownMenuItem>
  );
}

// ─── Componente principal: AdminLayout ───────────────────────────────────────

export default function AdminLayout({
  children,
  managedRestaurantId = null,
  basePath = '',
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { toast } = useToast();
  const { t } = useAdminTranslation();

  const restaurantId = managedRestaurantId || user?.restaurant_id || null;
  const { data: restaurant } = useRestaurant(restaurantId);

  useEffect(() => {
    document.title = restaurant?.name ?? 'Painel · Quiero.food';
    return () => {
      document.title = 'Sistema de Gestão de Restaurantes';
    };
  }, [restaurant?.name]);

  // isSuperAdminView = true SOMENTE quando um super_admin está gerenciando outro restaurante.
  // Antes esse flag era !!managedRestaurantId, o que fazia com que todos os usuários acessando
  // rotas com slug (/:slug/painel/*) vissem o painel como "super-admin", expondo a Gestão de
  // Usuários e outros controles exclusivos. Agora verificamos o papel do usuário logado.
  const isSuperAdminView = user?.role === 'super_admin' && !!managedRestaurantId;

  // O link de Configurações usa SettingsLink/SettingsDropdownItem (useCanAccess)
  // para permitir manager/owner (roles granulares) verem o link.
  const base = basePath || '/admin';
  const navSections = buildNavSections(base, t);

  // Gerenciar sessões simultâneas (máximo 3 por restaurante)
  useSessionManager(user?.id || null, restaurantId);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleBackToRestaurants = () => {
    navigate('/super-admin/restaurants');
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cardapioUrl = restaurant?.slug ? getCardapioPublicUrl(restaurant.slug) : '';
  const cardapioViewOnlyUrl = cardapioUrl ? cardapioUrl.replace(/\/$/, '') + '/menu' : '';
  const bioUrl = restaurant?.slug
    ? (typeof window !== 'undefined' && window.location.hostname.includes('localhost')
        ? `http://localhost:5173/${restaurant.slug}/bio`
        : `https://${restaurant.slug}.quiero.food/bio`)
    : '';
  const kdsUrl = restaurant?.slug
    ? `${origin}/${restaurant.slug}/kds`
    : restaurantId
      ? `${origin}/kitchen?restaurant_id=${restaurantId}`
      : '';
  const terminalUrl = restaurant?.slug
    ? `${origin}/${restaurant.slug}/terminal-garcom`
    : restaurantId
      ? `${origin}/terminal-garcom?restaurant_id=${restaurantId}`
      : '';

  const copyToClipboard = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: 'Link copiado com sucesso!' }),
      () => toast({ title: 'Erro ao copiar', variant: 'destructive' })
    );
  };

  if (!restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Nenhum restaurante selecionado.</p>
      </div>
    );
  }

  // Não bloqueamos o layout enquanto `loadingRestaurant` é true.
  // O React Query serve do cache instantaneamente em navegações subsequentes
  // (staleTime 5 min). Na primeira visita, o layout renderiza normalmente
  // com placeholders; o nome/slug do restaurante aparece em seguida.
  // Isso evita que a sidebar e o header "sumam" durante a transição de rota.

  const contextValue = {
    restaurantId,
    restaurant: restaurant ?? null,
    isSuperAdminView,
    basePath: base,
  };

  // Itens planos para o nav mobile (scroll horizontal)
  const mobileItems: NavLeaf[] = navSections.flatMap((section) =>
    section.items.flatMap((item) =>
      item.kind === 'leaf'
        ? [item]
        : item.kind === 'submenu'
        ? item.items
        : []
    )
  );

  return (
    <AdminRestaurantContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50 overflow-x-hidden">

        {/* ── Sidebar Desktop ─────────────────────────────────────────────── */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:flex-shrink-0 admin-sidebar">
          <div className="flex flex-col h-full overflow-y-auto">

            {/* Logo + Nome do restaurante — layout compacto */}
            <div className="flex flex-col flex-shrink-0 px-4 pt-5 pb-4 border-b border-slate-100">
              {isSuperAdminView && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-3 w-full justify-start text-slate-500 hover:bg-slate-100"
                  onClick={handleBackToRestaurants}
                >
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                  Voltar
                </Button>
              )}
              <Link to={base} className="flex items-center gap-3 min-w-0 group" onMouseEnter={() => prefetchRoute(base)}>
                {restaurant?.logo ? (
                  <img
                    src={restaurant.logo}
                    alt={restaurant?.name ?? 'Restaurante'}
                    className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-cover border border-slate-200 shadow-sm flex-shrink-0 group-hover:ring-2 group-hover:ring-orange-200 transition-all"
                  />
                ) : (
                  <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-orange-200">
                    <span className="text-lg font-bold text-white select-none">
                      {restaurant?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                    {restaurant?.name ?? 'Painel Admin'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {t('common.panelAdmin')}
                  </p>
                </div>
              </Link>
            </div>

            {/* Navegação principal */}
            <motion.nav
              className="flex-1 px-3 py-4 space-y-5 overflow-y-auto"
              variants={sidebarNavVariants}
              initial="hidden"
              animate="visible"
            >
              {navSections.map((section) => {
                if (section.kind === 'group') {
                  return (
                    <motion.div key={section.label} variants={sidebarSectionVariants}>
                      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
                        {section.label}
                      </p>
                      <div className="space-y-0.5">
                        {section.items.map((item) => {
                          const currentFullPath = location.pathname + (location.hash || '');
                          return (
                            <GuardedNavItem
                              key={item.href}
                              item={item}
                              isActive={currentFullPath === item.href}
                            />
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                }

                // Collapsible section
                return (
                  <motion.div key={section.key} variants={sidebarSectionVariants}>
                    <CollapsibleSection
                      section={section}
                      currentPath={location.pathname + (location.hash || '')}
                    />
                  </motion.div>
                );
              })}
            </motion.nav>

            {/* Footer da sidebar */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-slate-100">
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-[18px] w-[18px]" />
                {t('nav.items.logout')}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Top Bar Desktop ─────────────────────────────────────────────── */}
        <div className="hidden md:flex fixed top-0 left-64 right-0 z-30 h-16 items-center bg-white border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex-1 h-full px-6 flex items-center justify-end gap-3">
            {/* Grupo: Terminais Operacionais */}
            <div className="flex items-center gap-2 border-r border-slate-100 pr-3">
              {kdsUrl && (
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
                  <a
                    href={kdsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
                    title="Abrir Central da Cozinha"
                  >
                    <ChefHat className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium hidden xl:inline">Central da Cozinha</span>
                    <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(kdsUrl)}
                    title="Copiar link da Central da Cozinha"
                    className="flex h-8 w-8 shrink-0 items-center justify-center border-l border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {terminalUrl && (
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
                  <a
                    href={terminalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
                    title="Abrir Central do Garçom"
                  >
                    <Smartphone className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium hidden xl:inline">Central do Garçom</span>
                    <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(terminalUrl)}
                    title="Copiar link da Central do Garçom"
                    className="flex h-8 w-8 shrink-0 items-center justify-center border-l border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Grupo: Links do Cliente */}
            {(bioUrl || cardapioUrl || cardapioViewOnlyUrl) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                    <Link2 className="h-4 w-4" />
                    <span className="hidden lg:inline">Links do Cliente</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[240px]">
                  <DropdownMenuLabel className="text-xs text-slate-500">Links públicos do restaurante</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {bioUrl && (
                    <DropdownMenuItem
                      onSelect={() => window.open(bioUrl, '_blank')}
                      className="flex items-center justify-between gap-2 cursor-pointer py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Instagram className="h-4 w-4 shrink-0 text-pink-500" />
                        <span>Link da Bio</span>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(bioUrl); }}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  )}
                  {cardapioUrl && (
                    <DropdownMenuItem
                      onSelect={() => window.open(cardapioUrl, '_blank')}
                      className="flex items-center justify-between gap-2 cursor-pointer py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingCart className="h-4 w-4 shrink-0 text-[#F87116]" />
                        <span>Cardápio Delivery</span>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(cardapioUrl); }}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  )}
                  {cardapioViewOnlyUrl && (
                    <DropdownMenuItem
                      onSelect={() => window.open(cardapioViewOnlyUrl, '_blank')}
                      className="flex items-center justify-between gap-2 cursor-pointer py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Eye className="h-4 w-4 shrink-0 text-slate-500" />
                        <span>Cardápio Vitrine</span>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(cardapioViewOnlyUrl); }}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Utilitários: Configurações (gerente, proprietário e acima) */}
            <div className="flex items-center gap-1">
              <SettingsLink base={base} />
            </div>
          </div>
        </div>

        {/* ── Mobile Header ───────────────────────────────────────────────── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 min-w-0">
            {/* Logo do restaurante */}
            <div className="min-w-0 flex-1 flex items-center gap-2.5">
              {restaurant?.logo ? (
                <img
                  src={restaurant.logo}
                  alt={restaurant.name}
                  className="h-8 w-8 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white select-none">
                    {restaurant?.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <span className="text-sm font-semibold text-foreground truncate">
                {restaurant?.name ?? 'Painel Admin'}
              </span>
            </div>

            {/* Ações: KDS + Terminal (mais frequentes) + Menu overflow */}
            <div className="flex items-center gap-1">
              {kdsUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  asChild
                >
                  <a href={kdsUrl} target="_blank" rel="noopener noreferrer" title="Abrir Central da Cozinha">
                    <ChefHat className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {terminalUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  asChild
                >
                  <a href={terminalUrl} target="_blank" rel="noopener noreferrer" title="Abrir Central do Garçom">
                    <Smartphone className="h-4 w-4" />
                  </a>
                </Button>
              )}

              {/* Menu overflow: Links do Cliente + Câmbio + Config + Plano + Usuários */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-slate-200">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Mais opções</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  <DropdownMenuLabel className="text-xs text-slate-500">Links do Cliente</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {bioUrl && (
                    <DropdownMenuItem
                      onSelect={() => window.open(bioUrl, '_blank')}
                      className="flex items-center justify-between gap-2 cursor-pointer py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Instagram className="h-4 w-4 shrink-0 text-pink-500" />
                        <span>Link da Bio</span>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(bioUrl); }}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  )}
                  {cardapioUrl && (
                    <DropdownMenuItem
                      onSelect={() => window.open(cardapioUrl, '_blank')}
                      className="flex items-center justify-between gap-2 cursor-pointer py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingCart className="h-4 w-4 shrink-0 text-[#F87116]" />
                        <span>Cardápio Delivery</span>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(cardapioUrl); }}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  )}
                  {cardapioViewOnlyUrl && (
                    <DropdownMenuItem
                      onSelect={() => window.open(cardapioViewOnlyUrl, '_blank')}
                      className="flex items-center justify-between gap-2 cursor-pointer py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Eye className="h-4 w-4 shrink-0 text-slate-500" />
                        <span>Cardápio Vitrine</span>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(cardapioViewOnlyUrl); }}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-slate-500">Configurações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <SettingsDropdownItem base={base} />
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isSuperAdminView && (
            <div className="px-4 pb-2">
              <Button variant="outline" size="sm" onClick={handleBackToRestaurants}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar aos restaurantes
              </Button>
            </div>
          )}

          {/* Nav mobile: scroll horizontal com itens planos */}
          <div className="overflow-x-auto px-4 pb-3 scrollbar-hide">
            <div className="flex gap-1.5 w-max">
              {mobileItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-[#F87116]'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <div className="md:pl-64 min-w-0 flex-1 w-full">
          <main className="pt-[108px] md:pt-20 min-h-screen bg-slate-50">
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto min-w-0">
              <AnimatePresence mode="wait">
                <PageTransition key={location.pathname}>
                  {children ?? <Outlet />}
                </PageTransition>
              </AnimatePresence>
            </div>
          </main>
        </div>

      </div>{/* fecha min-h-screen */}

    </AdminRestaurantContext.Provider>
  );
}

// ─── Componente: seção colapsável de primeiro nível ──────────────────────────
// Declarado fora do AdminLayout para evitar recriação a cada render.

function CollapsibleSection({
  section,
  currentPath,
}: {
  section: NavCollapsible;
  currentPath: string;
}) {
  const hasActiveChild = collectHrefs(section).some((h) => currentPath === h);
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors border-l-[3px] ${
          hasActiveChild && !open
            ? 'text-[#F87116] border-l-[#F87116] bg-orange-50/60'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-l-transparent'
        }`}
      >
        <section.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {section.label}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
        }
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {section.items.map((item) => {
            if (item.kind === 'leaf') {
              return (
                <GuardedNavItem
                  key={item.href}
                  item={item}
                  isActive={currentPath === item.href}
                />
              );
            }
            if (item.kind === 'submenu') {
              return (
                <SubMenuSection
                  key={item.key}
                  sub={item}
                  currentPath={currentPath}
                />
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
