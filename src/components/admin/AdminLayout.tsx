import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/PageTransition';
import { useAuthStore } from '@/store/authStore';
import { AdminRestaurantContext, useAdminRestaurantId, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { useCanAccess } from '@/hooks/useUserRole';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { getCardapioPublicUrl } from '@/lib/utils';
import RestaurantUsersPanel from '@/components/admin/RestaurantUsersPanel';
import { supabase } from '@/lib/supabase';
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
  LayoutGrid,
  Search,
  ChevronDown,
  ChevronRight,
  Truck,
  ExternalLink,
  Lock,
  Sparkles,
  CreditCard,
  ScanBarcode,
  QrCode,
  Users,
  Boxes,
  ConciergeBell,
  type LucideIcon,
} from 'lucide-react';

// ─── Variantes de animação ─────────────────────────────────────────────────

const sidebarNavVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const sidebarSectionVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

// ─────────────────────────────────────────────────────────────────────────────

interface AdminLayoutProps {
  children?: ReactNode;
  managedRestaurantId?: string | null;
  basePath?: string;
}

// ─── Tipos da estrutura de navegação ─────────────────────────────────────────

interface NavLeaf {
  kind: 'leaf';
  name: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
  featureFlag?: string;
  featureLabel?: string;
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

// ─── Configuração da navegação ────────────────────────────────────────────────

type TFn = (key: string) => string;

const buildNavSections = (
  base: string,
  restaurantId: string | null,
  t: TFn,
  restaurantSlug?: string | null,
): NavSection[] => [
  {
    kind: 'group',
    label: t('nav.groups.overview'),
    items: [
      { kind: 'leaf', name: t('nav.items.dashboard'), href: base,             icon: LayoutDashboard },
      { kind: 'leaf', name: t('nav.items.orders'),    href: `${base}/orders`, icon: ClipboardList   },
    ],
  },
  {
    kind: 'group',
    label: t('nav.groups.operation'),
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.kitchen'),
        href: restaurantSlug
          ? `/${restaurantSlug}/kds`
          : restaurantId
            ? `/kitchen?restaurant_id=${restaurantId}`
            : '/kitchen',
        icon: ChefHat,
      },
      {
        kind: 'leaf',
        name: t('nav.items.buffet'),
        href: `${base}/buffet`,
        icon: Scale,
        featureFlag: 'feature_buffet_module',
        featureLabel: 'Plano Enterprise',
      },
      {
        kind: 'leaf',
        name: t('nav.items.cashier'),
        href: `${base}/cashier`,
        icon: ScanBarcode,
        featureFlag: 'feature_virtual_comanda',
        featureLabel: 'Plano Enterprise',
      },
      {
        kind: 'leaf',
        name: t('nav.items.expo'),
        href: restaurantSlug
          ? `/${restaurantSlug}/garcom`
          : restaurantId
            ? `/expo?restaurant_id=${restaurantId}`
            : '/expo',
        icon: ConciergeBell,
      },
    ],
  },
  {
    kind: 'group',
    label: t('nav.groups.menu'),
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
  {
    kind: 'collapsible',
    key: 'logistica',
    label: t('nav.groups.logistics'),
    icon: Truck,
    items: [
      {
        kind: 'leaf',
        name: t('nav.items.tables'),
        href: `${base}/tables`,
        icon: LayoutGrid,
        featureFlag: 'feature_tables',
        featureLabel: 'Plano Standard',
      },
      {
        kind: 'leaf',
        name: t('nav.items.comandaQr'),
        href: `${base}/comanda-qr`,
        icon: QrCode,
        featureFlag: 'feature_virtual_comanda',
        featureLabel: 'Plano Enterprise',
      },
      {
        kind: 'submenu',
        key: 'delivery',
        name: t('nav.items.delivery'),
        icon: Truck,
        items: [
          {
            kind: 'leaf',
            name: t('nav.items.couriers'),
            href: `${base}/couriers`,
            icon: Bike,
            featureFlag: 'feature_couriers',
            featureLabel: 'Plano Standard',
          },
          {
            kind: 'leaf',
            name: t('nav.items.deliveryZones'),
            href: `${base}/delivery-zones`,
            icon: MapPin,
            featureFlag: 'feature_delivery_zones',
            featureLabel: 'Plano Standard',
          },
        ],
      },
    ],
  },
];

const collectHrefs = (section: NavSection): string[] => {
  const hrefs: string[] = [];
  section.items.forEach((item) => {
    if (item.kind === 'leaf')    hrefs.push(item.href);
    if (item.kind === 'submenu') item.items.forEach((i) => hrefs.push(i.href));
  });
  return hrefs;
};

const submenuHrefs = (sub: NavSubMenu): string[] => sub.items.map((i) => i.href);

// ─── NavLinkItem ──────────────────────────────────────────────────────────────

function NavLinkItem({ item, isActive }: { item: NavLeaf; isActive: boolean }) {
  const className = `group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 border-l-[3px] ${
    isActive
      ? 'bg-orange-500/10 text-orange-300 border-l-orange-400'
      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border-l-transparent'
  }`;

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
        // abre sem token se falhar
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
        <ExternalLink className="h-3 w-3 ml-auto opacity-30 group-hover:opacity-60" />
      </a>
    );
  }

  return (
    <Link to={item.href} className={className}>
      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

// ─── LockedNavItem ────────────────────────────────────────────────────────────

function LockedNavItem({ item }: { item: NavLeaf }) {
  const basePath = useAdminBasePath();
  return (
    <Link
      to={`${basePath}/upgrade`}
      state={item.featureFlag ? { feature: item.featureFlag } : undefined}
      title={`${item.featureLabel ?? 'Plano superior'} — clique para ver os planos disponíveis`}
      className="group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg
                 border-l-[3px] border-l-transparent text-slate-500 hover:bg-amber-500/10
                 hover:text-amber-300 hover:border-l-amber-500 transition-all duration-150 select-none"
    >
      <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-40 group-hover:opacity-70" />
      <span className="flex-1 truncate opacity-60 group-hover:opacity-90">{item.name}</span>
      <span className="flex items-center gap-1 shrink-0">
        {item.featureLabel && (
          <span className="hidden group-hover:inline-flex items-center gap-0.5 text-[9px] font-semibold
                           bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded-full leading-none">
            <Sparkles className="h-2.5 w-2.5" />
            {item.featureLabel}
          </span>
        )}
        <Lock className="h-3 w-3 opacity-30 group-hover:opacity-60" />
      </span>
    </Link>
  );
}

// ─── GuardedNavItem ───────────────────────────────────────────────────────────

function GuardedNavItem({ item, isActive }: { item: NavLeaf; isActive: boolean }) {
  const restaurantId = useAdminRestaurantId();

  const hasRoleAccess = useCanAccess(item.roleRequired ?? ['kitchen']);
  const isRoleRestricted = !!item.roleRequired;
  if (isRoleRestricted && !hasRoleAccess) return null;

  const { data: hasFeatureAccess, isLoading } = useFeatureAccess(
    item.featureFlag ?? '',
    item.featureFlag ? restaurantId : null,
  );

  if (!item.featureFlag) {
    return <NavLinkItem item={item} isActive={isActive} />;
  }

  if (isLoading) {
    return <NavLinkItem item={item} isActive={isActive} />;
  }

  return hasFeatureAccess
    ? <NavLinkItem item={item} isActive={isActive} />
    : <LockedNavItem item={item} />;
}

// ─── SubMenuSection ───────────────────────────────────────────────────────────

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
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 border-l-[3px] ${
          hasActiveChild
            ? 'text-orange-300 border-l-orange-400 bg-orange-500/10'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border-l-transparent'
        }`}
      >
        <sub.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="flex-1 truncate text-left">{sub.name}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
        }
      </button>

      {open && (
        <div className="mt-0.5 ml-4 pl-3 border-l border-white/[0.08] space-y-0.5">
          {sub.items.map((leaf) => (
            <GuardedNavItem key={leaf.href} item={leaf} isActive={currentPath === leaf.href} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────

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
  const isSuperAdminView = !!managedRestaurantId;

  const [usersPanelOpen, setUsersPanelOpen] = useState(false);

  const base = basePath || '/admin';
  const navSections = buildNavSections(base, restaurantId, t, restaurant?.slug);

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
      <div className="min-h-screen flex items-center justify-center bg-[#0d1a10]">
        <p className="text-slate-400">Nenhum restaurante selecionado.</p>
      </div>
    );
  }

  const contextValue = {
    restaurantId,
    restaurant: restaurant ?? null,
    isSuperAdminView,
    basePath: base,
  };

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
      {/* Fundo escuro global — mesma cor da sidebar */}
      <div className="min-h-screen bg-[#0d1a10] overflow-x-hidden">

        {/* ── Sidebar Desktop ──────────────────────────────────────────────── */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:flex-shrink-0">
          <div className="flex flex-col h-full overflow-y-auto bg-[#0d1a10]">

            {/* Logo + Nome do restaurante */}
            <div className="flex flex-col flex-shrink-0 px-4 pt-5 pb-4 border-b border-white/[0.06]">
              {isSuperAdminView && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-3 w-full justify-start text-slate-400 hover:bg-white/10 hover:text-white"
                  onClick={handleBackToRestaurants}
                >
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                  Voltar
                </Button>
              )}
              <Link to={base} className="flex items-center gap-3 min-w-0 group">
                {restaurant?.logo ? (
                  <img
                    src={restaurant.logo}
                    alt={restaurant?.name ?? 'Restaurante'}
                    className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-cover border border-white/10 shadow-sm flex-shrink-0 group-hover:ring-2 group-hover:ring-orange-400/30 transition-all"
                  />
                ) : (
                  <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-orange-500/20">
                    <span className="text-lg font-bold text-white select-none">
                      {restaurant?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate leading-tight">
                    {restaurant?.name ?? 'Painel Admin'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
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
                      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
                        {section.label}
                      </p>
                      <div className="space-y-0.5">
                        {section.items.map((item) => (
                          <GuardedNavItem
                            key={item.href}
                            item={item}
                            isActive={location.pathname === item.href}
                          />
                        ))}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div key={section.key} variants={sidebarSectionVariants}>
                    <CollapsibleSection
                      section={section}
                      currentPath={location.pathname}
                    />
                  </motion.div>
                );
              })}
            </motion.nav>

            {/* Footer da sidebar */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-400 hover:bg-white/[0.06] hover:text-white"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-[18px] w-[18px]" />
                {t('nav.items.logout')}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Top Bar Desktop ───────────────────────────────────────────────── */}
        {/* Posicionada com gap de 12px do topo e 8px do sidebar — efeito painel flutuante */}
        <div className="hidden md:flex fixed top-3 left-[264px] right-3 z-30 h-16
                        bg-white/95 backdrop-blur-sm border-b border-slate-200/60
                        rounded-tl-2xl items-center px-6 gap-4 shadow-sm">
          {/* Campo de busca */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                placeholder={`${t('common.search')}...`}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50/50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F87116]/20 focus:border-[#F87116]"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hidden sm:inline">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center gap-2">
            {cardapioUrl && (
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
                <a
                  href={cardapioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-[#F87116] hover:bg-orange-50 transition-colors"
                  title="Abrir cardápio público"
                >
                  <BookOpen className="h-4 w-4 flex-shrink-0" />
                  <span>{t('common.viewMenu')}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  onClick={copyCardapioLink}
                  className="flex items-center justify-center w-9 h-9 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}

            <Link
              to={`${base}/settings`}
              title="Dados do Restaurante"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-orange-50 hover:text-[#F87116] hover:border-orange-200 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <Link
              to={`${base}/upgrade`}
              title="Meu Plano"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-orange-50 hover:text-[#F87116] hover:border-orange-200 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
            </Link>

            {isSuperAdminView && (
              <button
                onClick={() => setUsersPanelOpen(true)}
                title="Gerenciar usuários do restaurante"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 hover:border-indigo-300 transition-colors"
              >
                <Users className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile Header ─────────────────────────────────────────────────── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-3 px-4 py-3 min-w-0">
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

            <div className="flex items-center gap-1">
              {cardapioUrl && (
                <a
                  href={cardapioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-medium text-[#F87116] border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Cardápio</span>
                </a>
              )}
              {isSuperAdminView && (
                <button
                  onClick={() => setUsersPanelOpen(true)}
                  title="Gerenciar usuários"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
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

          {/* Nav mobile: scroll horizontal */}
          <div className="overflow-x-auto px-4 pb-3 scrollbar-hide">
            <div className="flex gap-1.5 w-max">
              {mobileItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
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

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="md:pl-64 min-w-0 flex-1 w-full">
          {/* Painel flutuante: margem que expõe o fundo escuro */}
          <div className="md:ml-2 md:mr-3 md:mt-3 bg-slate-50 md:rounded-tl-2xl overflow-x-hidden min-h-screen">
            <main className="pt-[108px] md:pt-[72px] min-h-screen">
              <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto min-w-0">
                <AnimatePresence mode="wait">
                  <PageTransition key={location.pathname}>
                    {children ?? <Outlet />}
                  </PageTransition>
                </AnimatePresence>
              </div>
            </main>
          </div>
        </div>

      </div>

      {/* ── Painel de Gestão de Usuários (super-admin) ─────────────────────── */}
      {isSuperAdminView && restaurantId && (
        <RestaurantUsersPanel
          open={usersPanelOpen}
          onClose={() => setUsersPanelOpen(false)}
          restaurantId={restaurantId}
          restaurantName={restaurant?.name}
        />
      )}

    </AdminRestaurantContext.Provider>
  );
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

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
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 border-l-[3px] ${
          hasActiveChild && !open
            ? 'text-orange-300 border-l-orange-400 bg-orange-500/10'
            : 'text-slate-400 hover:bg-white/[0.06] hover:text-white border-l-transparent'
        }`}
      >
        <section.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {section.label}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
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
