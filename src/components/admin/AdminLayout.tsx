import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AdminRestaurantContext, useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { useCanAccess } from '@/hooks/useUserRole';
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
  ChevronDown,
  ChevronRight,
  Truck,
  ExternalLink,
  Lock,
  Sparkles,
  CreditCard,
  ScanBarcode,
  type LucideIcon,
} from 'lucide-react';

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

const buildNavSections = (base: string, restaurantId: string | null, restaurantSlug?: string | null): NavSection[] => [
  {
    kind: 'group',
    label: 'Visão Geral',
    items: [
      { kind: 'leaf', name: 'Dashboard',  href: base,                icon: LayoutDashboard },
      { kind: 'leaf', name: 'Pedidos',    href: `${base}/orders`,    icon: ClipboardList   },
    ],
  },
  {
    kind: 'group',
    label: 'Operação',
    items: [
      {
        kind: 'leaf',
        name: 'Cozinha (KDS)',
        // URL do KDS no subdomínio dedicado: kds.quiero.food/{slug}
        // Fallback para o caminho local com restaurant_id quando o slug ainda
        // não estiver configurado (evita quebrar o acesso à cozinha).
        href: restaurantSlug
          ? `https://kds.quiero.food/${restaurantSlug}`
          : restaurantId
            ? `${window.location.origin}/kitchen?restaurant_id=${restaurantId}`
            : 'https://kds.quiero.food',
        icon: ChefHat,
        external: true, // abre em nova aba
      },
      {
        kind: 'leaf',
        name: 'Buffet / Comandas',
        href: `${base}/buffet`,
        icon: Scale,
        featureFlag: 'feature_buffet_module',
        featureLabel: 'Plano Enterprise',
      },
      {
        kind: 'leaf',
        name: 'Caixa (Comanda Digital)',
        href: `${base}/cashier`,
        icon: ScanBarcode,
        featureFlag: 'feature_virtual_comanda',
        featureLabel: 'Plano Enterprise',
      },
    ],
  },
  {
    kind: 'collapsible',
    key: 'catalogo',
    label: 'Catálogo & Cardápio',
    icon: UtensilsCrossed,
    items: [
      {
        kind: 'leaf',
        name: 'Gestão de Produtos',
        href: `${base}/products`,
        icon: Package,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
      {
        kind: 'leaf',
        name: 'Organizar Cardápio',
        href: `${base}/menu`,
        icon: UtensilsCrossed,
        roleRequired: ['manager', 'restaurant_admin', 'super_admin'],
      },
    ],
  },
  {
    kind: 'collapsible',
    key: 'logistica',
    label: 'Logística & Salão',
    icon: Truck,
    items: [
      {
        kind: 'leaf',
        name: 'Mesas & QR Codes',
        href: `${base}/tables`,
        icon: LayoutGrid,
        featureFlag: 'feature_tables',
        featureLabel: 'Plano Standard',
      },
      {
        kind: 'submenu',
        key: 'delivery',
        name: 'Delivery',
        icon: Truck,
        items: [
          {
            kind: 'leaf',
            name: 'Entregadores',
            href: `${base}/couriers`,
            icon: Bike,
            featureFlag: 'feature_couriers',
            featureLabel: 'Plano Standard',
          },
          {
            kind: 'leaf',
            name: 'Zonas de Entrega',
            href: `${base}/delivery-zones`,
            icon: MapPin,
            featureFlag: 'feature_delivery_zones',
            featureLabel: 'Plano Standard',
          },
        ],
      },
    ],
  },
  // "Dados do Restaurante" e "Meu Plano" foram removidos da sidebar.
  // O acesso é feito exclusivamente pelos ícones na top bar direita (Settings + CreditCard).
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

  // Links externos (ex: KDS) abrem em nova aba sem usar o React Router
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="truncate">{item.name}</span>
        <ExternalLink className="h-3 w-3 ml-auto opacity-40 group-hover:opacity-70" />
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

// ─── Componente: item bloqueado (sem plano) ──────────────────────────────────
// Clicável: leva para a página de planos com contexto da feature bloqueada.

function LockedNavItem({ item }: { item: NavLeaf }) {
  return (
    <Link
      to="/admin/upgrade"
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

  // ── Verificação de cargo (RBAC) ──────────────────────────────────────────
  // Se o item exige um cargo e o usuário não o tem → ocultar completamente.
  // Nota: useCanAccess retorna `true` otimisticamente durante o carregamento.
  const hasRoleAccess = useCanAccess(item.roleRequired ?? ['kitchen']); // sem roleRequired = acesso livre
  const isRoleRestricted = !!item.roleRequired;
  if (isRoleRestricted && !hasRoleAccess) return null;

  // ── Verificação de feature flag (Planos) ─────────────────────────────────
  const { data: hasFeatureAccess, isLoading } = useFeatureAccess(
    item.featureFlag ?? '',
    item.featureFlag ? restaurantId : null,
  );

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

  const restaurantId = managedRestaurantId || user?.restaurant_id || null;
  const { data: restaurant, isLoading: loadingRestaurant } = useRestaurant(restaurantId);
  const isSuperAdminView = !!managedRestaurantId;

  const base = basePath || '/admin';
  const navSections = buildNavSections(base, restaurantId, restaurant?.slug);

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

            {/* Logo + Voltar */}
            <div className="flex flex-col flex-shrink-0 px-5 pt-6 pb-4 border-b border-slate-100">
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
              {/*
               * Logo do restaurante em formato 1:1, ocupando toda a largura da sidebar.
               * O aspect-square garante proporção quadrada independente do tamanho.
               * Quando não há logo, exibe avatar com a inicial do restaurante.
               */}
              <Link to={base} className="flex justify-center">
                {restaurant?.logo ? (
                  <img
                    src={restaurant.logo}
                    alt={restaurant?.name ?? 'Restaurante'}
                    className="w-4/5 aspect-square rounded-2xl object-cover border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-4/5 aspect-square rounded-2xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center shadow-sm border border-orange-200">
                    <span className="text-4xl font-bold text-white select-none">
                      {restaurant?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
              </Link>
            </div>

            {/* Navegação principal */}
            <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
              {navSections.map((section) => {
                if (section.kind === 'group') {
                  return (
                    <div key={section.label}>
                      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
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
                    </div>
                  );
                }

                // Collapsible section
                return (
                  <CollapsibleSection
                    key={section.key}
                    section={section}
                    currentPath={location.pathname}
                  />
                );
              })}
            </nav>

            {/* Footer da sidebar */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-slate-100">
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

        {/* ── Top Bar Desktop ─────────────────────────────────────────────── */}
        <div className="hidden md:block fixed top-0 left-64 right-0 z-30 h-16 bg-white border-b border-slate-200/80">
          <div className="h-full px-6 flex items-center justify-between gap-4">
            {/* Campo de busca */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  placeholder="Buscar..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50/50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F87116]/20 focus:border-[#F87116]"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hidden sm:inline">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Ações rápidas do header */}
            <div className="flex items-center gap-2">
              {/* Botão "Ver Cardápio" — ação utilitária no header */}
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
                    <span>Ver Cardápio</span>
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

              {/* Dados do Restaurante — atalho rápido para configurações */}
              <Link
                to={`${base}/settings`}
                title="Dados do Restaurante"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-orange-50 hover:text-[#F87116] hover:border-orange-200 transition-colors"
              >
                <Settings className="h-4 w-4" />
              </Link>

              {/* Meu Plano — atalho para upgrade/assinatura */}
              <Link
                to={`${base}/upgrade`}
                title="Meu Plano"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-orange-50 hover:text-[#F87116] hover:border-orange-200 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Mobile Header ───────────────────────────────────────────────── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-3 px-4 py-3 min-w-0">
            {/* Logo do restaurante 1:1 no mobile */}
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

            {/* Botão "Ver Cardápio" no mobile header */}
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

          {/* Nav mobile: scroll horizontal com itens planos */}
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

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <div className="md:pl-64 min-w-0 flex-1 w-full">
          <main className="pt-[108px] md:pt-20 min-h-screen bg-slate-50">
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto min-w-0">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>

      </div>
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
