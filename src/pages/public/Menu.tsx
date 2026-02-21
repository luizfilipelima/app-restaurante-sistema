import { useEffect, useState, useMemo, lazy, Suspense, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getSubdomain } from '@/lib/subdomain';
import { Restaurant, Product, Category, Subcategory } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { useRestaurantMenuData, useActiveOffersByRestaurantId } from '@/hooks/queries';
import { ShoppingCart, Search, ChevronRight, Utensils, Coffee, IceCream, UtensilsCrossed, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useSharingMeta } from '@/hooks/useSharingMeta';
import { isWithinOpeningHours, formatCurrency, normalizePhoneWithCountryCode } from '@/lib/utils';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import ProductCard from '@/components/public/ProductCard';
import InitialSplashScreen from '@/components/public/InitialSplashScreen';

// Lazy: CartDrawer importa framer-motion — só carrega quando o carrinho for aberto
const CartDrawer = lazy(() => import('@/components/public/CartDrawer'));
// Lazy: modais só carregam quando o produto for clicado
const ProductAddonModal = lazy(() => import('@/components/public/ProductAddonModal'));
const SimpleProductModal = lazy(() => import('@/components/public/SimpleProductModal'));

// MOCK DATA PARA VISUALIZAÇÃO DE DESIGN (Caso banco vazio)
const MOCK_PRODUCTS: Product[] = [
  { id: 'm1', restaurant_id: '1', category: 'Pizza', name: 'Pizza Margherita Premium', description: 'Molho de tomate artesanal, mozzarella di bufala, manjericão fresco e azeite trufado.', price: 45.90, image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80', is_pizza: true, is_active: true, created_at: '', updated_at: '' },
  { id: 'm2', restaurant_id: '1', category: 'Pizza', name: 'Pepperoni Speciale', description: 'Pepperoni crocante, queijo mozzarella e orégano.', price: 49.90, image_url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80', is_pizza: true, is_active: true, created_at: '', updated_at: '' },
  { id: 'm3', restaurant_id: '1', category: 'Pizza', name: 'Quatro Queijos', description: 'Mozzarella, gorgonzola, parmesão e catupiry original.', price: 52.90, image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', is_pizza: true, is_active: true, created_at: '', updated_at: '' },
  { id: 'm4', restaurant_id: '1', category: 'Bebidas', name: 'Coca-Cola 2L', description: 'Refrigerante gelado.', price: 12.00, image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80', is_pizza: false, is_active: true, created_at: '', updated_at: '' },
  { id: 'm5', restaurant_id: '1', category: 'Sobremesas', name: 'Petit Gâteau', description: 'Bolo de chocolate com recheio cremoso e sorvete de creme.', price: 24.90, image_url: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=80', is_pizza: false, is_active: true, created_at: '', updated_at: '' },
];

const CATEGORY_ICONS: Record<string, any> = {
  'Marmitas': UtensilsCrossed,
  'Pizza': Utensils,
  'Bebidas': Coffee,
  'Sobremesas': IceCream,
  'default': Utensils
};

// Ordem de categorias: pratos principais primeiro, bebidas por último
const CATEGORY_ORDER: Record<string, number> = {
  'Marmitas': 0,
  'Pizza': 1,
  'Massas': 2,
  'Lanches': 3,
  'Aperitivos': 4,
  'Combos': 5,
  'Sobremesas': 6,
  'Bebidas': 7,
  'Outros': 8,
};

// Função para ordenar categorias
const sortCategories = (categories: string[]): string[] => {
  return [...categories].sort((a, b) => {
    const orderA = CATEGORY_ORDER[a] || 999; // Categorias não listadas vão para o final
    const orderB = CATEGORY_ORDER[b] || 999;
    return orderA - orderB;
  });
};

interface PublicMenuProps {
  /** Quando renderizado dentro de StoreLayout (subdomínio), o slug é passado por prop */
  tenantSlug?: string;
  /** Modo mesa: exibe indicador e associa pedidos à mesa */
  tableId?: string;
  tableNumber?: number;
  /** Callback ao clicar em "Chamar garçom" (modo mesa) */
  onCallWaiter?: () => void;
  /** Se true, exibe loading no botão Chamar garçom */
  callingWaiter?: boolean;
}

export default function PublicMenu({ tenantSlug: tenantSlugProp, tableId, tableNumber, onCallWaiter, callingWaiter }: PublicMenuProps = {}) {
  const { t } = useTranslation();
  const params = useParams();
  const subdomain = getSubdomain();
  // Prioridade: prop (StoreLayout) > URL > subdomínio
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [addonModalProduct, setAddonModalProduct] = useState<{ product: Product; basePrice: number } | null>(null);
  const [simpleModalProduct, setSimpleModalProduct] = useState<{ product: Product; basePrice: number } | null>(null);

  const { data: menuData, isLoading: loading, isError, isFetching, isPlaceholderData } = useRestaurantMenuData(restaurantSlug);
  // Usa restaurant_id diretamente do menuData para evitar requisição extra (slug→id)
  const { data: activeOffers = [] } = useActiveOffersByRestaurantId(menuData?.restaurant?.id);
  const productIdToOffer = useMemo(() => {
    const m = new Map<string, typeof activeOffers[0]>();
    activeOffers.forEach((o) => m.set(o.product_id, o));
    return m;
  }, [activeOffers]);

  const { restaurant, products, categories, categoriesFromDb, subcategories, productComboItemsMap, productAddonsMap } = useMemo(() => {
    if (!menuData) {
      return {
        restaurant: null as Restaurant | null,
        products: [] as Product[],
        categories: [] as string[],
        categoriesFromDb: [] as Category[],
        subcategories: [] as Subcategory[],
        productComboItemsMap: {} as Record<string, Array<{ product: Product; quantity: number }>>,
        productAddonsMap: {} as Record<string, Array<{ id: string; name: string; items: Array<{ id: string; name: string; price: number }> }>>,
      };
    }
    const p = menuData.products.length > 0 ? menuData.products : MOCK_PRODUCTS;
    const c = menuData.products.length > 0 ? menuData.categories : sortCategories(['Pizza', 'Bebidas', 'Sobremesas']);
    return {
      restaurant: menuData.restaurant,
      products: p,
      categories: c,
      categoriesFromDb: menuData.categoriesFromDb,
      subcategories: menuData.subcategories,
      productComboItemsMap: menuData.productComboItemsMap ?? {},
      productAddonsMap: menuData.productAddonsMap ?? {},
    };
  }, [menuData]);

  const isSubdomain = subdomain && !['app', 'www', 'localhost'].includes(subdomain);

  const handleCheckoutNavigation = () => {
    const params = new URLSearchParams();
    if (tableId && tableNumber) {
      params.set('tableId', tableId);
      params.set('tableNumber', String(tableNumber));
    }
    const query = params.toString();
    const base = isSubdomain ? '/checkout' : `/${restaurantSlug}/checkout`;
    navigate(query ? `${base}?${query}` : base);
  };

  const { getItemsCount, getSubtotal, setRestaurant: setCartRestaurant, restaurantId: cartRestaurantId, removeInactiveProducts } = useCartStore();
  const { setCurrentRestaurant } = useRestaurantStore();

  // Ler telefone salvo no localStorage para exibir progresso de fidelidade no carrinho
  const [savedPhone, setSavedPhone] = useState<string>('');
  useEffect(() => {
    try {
      const rid = cartRestaurantId;
      if (!rid) return;
      const saved = localStorage.getItem(`checkout_phone_${rid}`);
      if (saved) setSavedPhone(saved);
    } catch { /* ignore */ }
  }, [cartRestaurantId]);

  // Capturar telefone da URL (?phone=, ?wa=, ?tel=) quando usuário vem do WhatsApp — vincula fidelidade
  useEffect(() => {
    const rid = restaurant?.id;
    if (!rid) return;
    const raw = searchParams.get('phone') ?? searchParams.get('wa') ?? searchParams.get('tel') ?? '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8) return;
    const normalized = normalizePhoneWithCountryCode(raw, 'BR');
    try {
      localStorage.setItem(`checkout_phone_${rid}`, normalized);
      setSavedPhone(normalized);
    } catch { /* ignore */ }
  }, [restaurant?.id, searchParams]);

  useEffect(() => {
    if (!menuData?.restaurant) return;
    const r = menuData.restaurant;
    setCurrentRestaurant(r);
    setCartRestaurant(r.id);
    const userHasChosen = hasStoredMenuLanguage();
    const lang: MenuLanguage = userHasChosen ? getStoredMenuLanguage() : (r.language === 'es' ? 'es' : 'pt');
    if (!userHasChosen) setStoredMenuLanguage(lang);
    i18n.changeLanguage(lang);
  }, [menuData?.restaurant, setCurrentRestaurant, setCartRestaurant]);

  // Remove do carrinho itens de produtos desativados/excluídos pelo Admin
  useEffect(() => {
    if (!products.length || !restaurant?.id || cartRestaurantId !== restaurant.id) return;
    const activeIds = new Set(products.map((p) => p.id));
    removeInactiveProducts(activeIds);
  }, [products, restaurant?.id, cartRestaurantId, removeInactiveProducts]);

  // Atualizar título e meta tags de compartilhamento (logo do restaurante como imagem destacada)
  useEffect(() => {
    if (restaurant?.name) document.title = restaurant.name;
    else document.title = t('menu.title');
  }, [restaurant?.name, t]);
  useSharingMeta(restaurant ? { name: restaurant.name, logo: restaurant.logo } : null);

  const handleOfferProductClick = (offer: { product: Product; offer_price: number; original_price: number; label?: string | null }) => {
    const p = offer.product;
    const addons = productAddonsMap[p.id];
    if (addons && addons.length > 0) {
      setAddonModalProduct({ product: p, basePrice: offer.offer_price });
    } else {
      setSimpleModalProduct({ product: p, basePrice: offer.offer_price });
    }
  };

  const handleProductClick = (product: Product) => {
    const addons = productAddonsMap[product.id];
    if (addons && addons.length > 0) {
      setAddonModalProduct({ product, basePrice: Number(product.price_sale || product.price) });
    } else {
      setSimpleModalProduct({ product, basePrice: Number(product.price_sale || product.price) });
    }
  };

  // Agrupamento por categoria para o modo "Todos" — memoizado para não recalcular
  // em cada re-render (ex: abrir carrinho, modal, etc.)
  const groupedByCategory = useMemo(() => {
    return categories
      .map((categoryName) => {
        const categoryProducts = products.filter((p) => p.category === categoryName);
        if (categoryProducts.length === 0) return null;
        const catFromDb = categoriesFromDb.find((c) => c.name === categoryName);
        const subcatsForCategory = (
          catFromDb ? subcategories.filter((s) => s.category_id === catFromDb.id) : []
        ).sort((a, b) => a.order_index - b.order_index);
        const productsWithSub = categoryProducts.filter((p) => p.subcategory_id);
        const productsWithoutSub = categoryProducts.filter((p) => !p.subcategory_id);
        const hasSubs = subcatsForCategory.length > 0 && productsWithSub.length > 0;
        return { categoryName, categoryProducts, subcatsForCategory, productsWithSub, productsWithoutSub, hasSubs };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [categories, products, categoriesFromDb, subcategories]);

  // Filtrar e ordenar produtos — memoizado para não recalcular a cada render
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = selectedCategory === 'all'
      ? products
      : products.filter((p) => p.category === selectedCategory).sort((a, b) => a.name.localeCompare(b.name));
    if (query) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description ?? '').toLowerCase().includes(query),
      );
    }
    return result;
  }, [products, selectedCategory, searchQuery]);

  const isRefreshing = isFetching && isPlaceholderData;

  // Splash com tempo mínimo e transição fluida para o cardápio
  const [splashOverlay, setSplashOverlay] = useState(false);
  const [splashFadeOut, setSplashFadeOut] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const prevLoading = useRef(true);
  const splashMountTime = useRef<number | null>(null);
  const hasSetMountTime = useRef(false);

  useEffect(() => {
    if (!hasSetMountTime.current) {
      hasSetMountTime.current = true;
      splashMountTime.current = Date.now();
    }
  }, []);

  useEffect(() => {
    if (!prevLoading.current || loading) {
      if (loading) prevLoading.current = true;
      return;
    }
    prevLoading.current = false;

    const MIN_SPLASH_MS = 1400;   // Tempo mínimo para ver a animação da marca
    const FADE_OUT_MS = 550;      // Duração do fade-out do splash

    const elapsed = splashMountTime.current ? Date.now() - splashMountTime.current : 0;
    const remain = Math.max(0, MIN_SPLASH_MS - elapsed);

    setSplashOverlay(true);

    const t1 = setTimeout(() => {
      setSplashFadeOut(true);
      setMenuVisible(true); // Inicia fade-in do cardápio junto com fade-out do splash
      const t2 = setTimeout(() => {
        setSplashOverlay(false);
        setSplashFadeOut(false);
      }, FADE_OUT_MS);
      return () => clearTimeout(t2);
    }, remain);

    return () => clearTimeout(t1);
  }, [loading]);

  if (loading) {
    return <InitialSplashScreen />;
  }

  if (!loading && (!menuData || isError || !restaurant)) return <div className="min-h-screen flex items-center justify-center p-4">{t('menu.restaurantNotFound')}</div>;
  if (!restaurant) return null;

  const currency = restaurant.currency === 'PYG' ? 'PYG' : 'BRL';

  const hasHours = restaurant.opening_hours && Object.keys(restaurant.opening_hours).length > 0;
  const alwaysOpen = !!restaurant.always_open;
  const isOpen = restaurant.is_manually_closed
    ? false
    : alwaysOpen
      ? true
      : hasHours
        ? isWithinOpeningHours(restaurant.opening_hours as Record<string, { open: string; close: string } | null>)
        : restaurant.is_active;

  return (
    <>
      <div
        className={`min-h-screen bg-slate-100/80 font-sans antialiased transition-all duration-500 ease-out ${
          menuVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        } ${getItemsCount() > 0 ? 'pb-24 md:pb-28' : 'pb-8 md:pb-8'} safe-area-inset-bottom`}
      >
      {/* Barra sutil de refresh quando dados em background (keepPreviousData) */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-orange-200/80 z-[100] overflow-hidden">
          <div className="h-full w-1/3 bg-orange-500 rounded-r-full animate-[progress-slide_1.5s_ease-in-out_infinite]" />
        </div>
      )}
      {/* Header - Layout referência: logo + nome/status à esquerda, carrinho à direita */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-20 safe-area-inset-top">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden ring-1 ring-slate-200/80 flex-shrink-0 bg-white shadow-sm">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt={restaurant.name} width={56} height={56} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-lg">
                    {restaurant.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight leading-tight">{restaurant.name}</h1>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium mt-0.5 ${isOpen ? 'text-emerald-600' : 'text-red-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-red-500'} ${isOpen ? 'animate-pulse' : ''}`} />
                  {isOpen ? t('menu.open') : t('menu.closed')}
                </span>
              </div>
            </div>
            {/* Ícone de carrinho — quadrado escuro com badge laranja */}
            <button
              type="button"
              data-testid="menu-view-cart"
              onClick={() => setCartOpen(true)}
              className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 flex items-center justify-center text-white transition-all touch-manipulation flex-shrink-0"
              aria-label={t('menu.viewCart')}
            >
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              {getItemsCount() > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                  {getItemsCount()}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* Barra Mesa + Chamar Garçom - modo mesa */}
        {tableNumber != null && onCallWaiter && (
          <div className="border-t border-amber-200/60 bg-amber-50/90">
            <div className="container mx-auto max-w-6xl flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5">
              <span className="text-sm font-semibold text-amber-900">
                {t('menu.tableLabel')} {tableNumber}
              </span>
              <Button
                onClick={onCallWaiter}
                disabled={callingWaiter}
                size="sm"
                className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm"
              >
                {callingWaiter ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {t('menu.callWaiter')}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-4 sm:space-y-6">
        {/* Busca e categorias — layout referência: busca em destaque + pills horizontais */}
        <div className={`sticky z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-white/95 backdrop-blur-sm rounded-b-xl ${tableNumber != null && onCallWaiter ? 'top-[115px] sm:top-[125px] md:top-[135px]' : 'top-[65px] sm:top-[73px] md:top-[81px]'}`}>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
              <Input
                placeholder={t('menu.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-3 sm:pr-4 bg-white border border-slate-200 rounded-xl border-slate-200/80 focus-visible:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-200/50 text-base text-slate-900 placeholder:text-slate-400 transition-colors touch-manipulation"
              />
            </div>

            {/* Categorias em formato pill — ícone + texto inline */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory scroll-smooth">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 snap-start touch-manipulation active:scale-95 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Utensils className="h-4 w-4 flex-shrink-0" />
                <span>{t('menu.all')}</span>
              </button>
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default'];
                return (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 snap-start touch-manipulation active:scale-95 ${
                      selectedCategory === category
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Seção Ofertas no topo (mesmo padrão de grid e ProductCard das categorias) ── */}
        {activeOffers.length > 0 && selectedCategory === 'all' && (
          <section className="space-y-3 sm:space-y-5">
            <h2 className="text-sm-mobile-block sm:text-base font-semibold text-orange-700 uppercase tracking-wider px-1 flex items-center gap-2">
              {t('menu.offers')}
              <span className="text-xs font-semibold text-orange-600 bg-orange-200/60 px-2 py-0.5 rounded-full">
                {activeOffers.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeOffers.map((offer) => (
                <ProductCard
                  key={offer.id}
                  product={offer.product}
                  onClick={() => handleOfferProductClick(offer)}
                  currency={currency}
                  comboItems={productComboItemsMap?.[offer.product.id]}
                  offer={{ price: offer.offer_price, originalPrice: offer.original_price, label: offer.label }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Lista de produtos - Mobile First */}
        <section className="space-y-6 sm:space-y-8">
          {selectedCategory === 'all' ? (
            // Estrutura pré-computada via useMemo — sem filtros inline a cada render
            groupedByCategory.map(({ categoryName, categoryProducts, subcatsForCategory, productsWithSub, productsWithoutSub, hasSubs }) => (
              <div key={categoryName} className="space-y-3 sm:space-y-5">
                <h2 className="text-sm-mobile-block sm:text-base font-semibold text-slate-500 uppercase tracking-wider px-1">
                  {categoryName}
                </h2>
                {hasSubs ? (
                  <>
                    {subcatsForCategory.map((sub) => {
                      const subProducts = productsWithSub.filter((p) => p.subcategory_id === sub.id);
                      if (subProducts.length === 0) return null;
                      return (
                        <div key={sub.id} className="space-y-2">
                          <h3 className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider px-1">{sub.name}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {subProducts.map((product) => {
                              const offer = productIdToOffer.get(product.id);
                              return (
                                <ProductCard
                                  key={product.id}
                                  product={product}
                                  onClick={() => (offer ? handleOfferProductClick(offer) : handleProductClick(product))}
                                  currency={currency}
                                  comboItems={productComboItemsMap?.[product.id]}
                                  offer={offer ? { price: offer.offer_price, originalPrice: offer.original_price, label: offer.label } : undefined}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {productsWithoutSub.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {productsWithoutSub.map((product) => {
                          const offer = productIdToOffer.get(product.id);
                          return (
                            <ProductCard
                              key={product.id}
                              product={product}
                              onClick={() => (offer ? handleOfferProductClick(offer) : handleProductClick(product))}
                              currency={currency}
                              comboItems={productComboItemsMap?.[product.id]}
                              offer={offer ? { price: offer.offer_price, originalPrice: offer.original_price, label: offer.label } : undefined}
                            />
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoryProducts.map((product) => {
                      const offer = productIdToOffer.get(product.id);
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onClick={() => (offer ? handleOfferProductClick(offer) : handleProductClick(product))}
                          currency={currency}
                          comboItems={productComboItemsMap?.[product.id]}
                          offer={offer ? { price: offer.offer_price, originalPrice: offer.original_price, label: offer.label } : undefined}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          ) : (
            // Exibir apenas produtos da categoria selecionada
            <>
              <h2 className="text-sm-mobile-block sm:text-base font-semibold text-slate-500 uppercase tracking-wider px-1">
                {selectedCategory}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProducts.map((product) => {
                  const offer = productIdToOffer.get(product.id);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClick={() => (offer ? handleOfferProductClick(offer) : handleProductClick(product))}
                      currency={currency}
                      comboItems={productComboItemsMap?.[product.id]}
                      offer={offer ? { price: offer.offer_price, originalPrice: offer.original_price, label: offer.label } : undefined}
                    />
                  );
                })}
              </div>
            </>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 sm:py-16 bg-white/60 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 mx-1">
              <p className="text-slate-500 text-base sm:text-sm text-sm-mobile-block">{t('menu.noProductsInCategory')}</p>
            </div>
          )}
        </section>

        {/* Rodapé */}
        <footer className="pt-8 pb-6 text-center border-t border-slate-200/60">
          <a
            href="https://quiero.food"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <img src="/quierofood-logo-f.svg" alt="Quiero.food" width={80} height={28} loading="lazy" className="h-7 w-auto object-contain opacity-80 hover:opacity-100" />
            <span className="text-xs">{t('menu.developedBy')}</span>
          </a>
        </footer>
      </main>
    </div>

      {/* Cart FAB (Mobile) — só aparece após o splash inicial terminar */}
      {getItemsCount() > 0 && !splashOverlay && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
          style={{ 
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))'
          }}
        >
          <div className="px-3 pb-3">
            <Button
              className="w-full h-16 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/30 hover:bg-slate-800 active:scale-[0.98] transition-all p-0 overflow-hidden flex items-stretch"
              onClick={() => setCartOpen(true)}
            >
              {/* Left Side: Info */}
              <div className="flex-1 flex items-center justify-start px-4 gap-3.5">
                <div className="relative">
                   <div className="bg-orange-500 h-9 w-9 rounded-full flex items-center justify-center border border-orange-400/50 shadow-md shadow-orange-500/30">
                      <span className="text-sm font-bold text-white">{getItemsCount()}</span>
                   </div>
                </div>
                <div className="flex flex-col items-start justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-tight">{t('menu.total')}</span>
                  <span className="text-base font-bold text-white leading-tight">{formatCurrency(getSubtotal(), currency)}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-[1px] bg-white/10 my-3"></div>

              {/* Right Side: CTA — cor sólida alinhada ao botão Finalizar Pedido */}
              <div className="px-6 flex items-center justify-center gap-2 h-full min-w-[120px] bg-[#F26812] hover:bg-[#E05D10] text-white shadow-lg shadow-orange-500/25 transition-all duration-200">
                <span className="text-sm font-bold drop-shadow-sm">{t('menu.viewBag')}</span>
                <ChevronRight className="h-4 w-4 drop-shadow-sm" aria-hidden />
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Modais (lazy — só carregam quando necessários) */}
      <Suspense fallback={null}>
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={handleCheckoutNavigation}
          currency={currency}
          restaurantId={cartRestaurantId}
          customerPhone={savedPhone}
        />

        {simpleModalProduct && (
          <SimpleProductModal
            open={!!simpleModalProduct}
            onClose={() => setSimpleModalProduct(null)}
            product={simpleModalProduct.product}
            basePrice={simpleModalProduct.basePrice}
            currency={currency}
          />
        )}

        {addonModalProduct && (
          <ProductAddonModal
            open={!!addonModalProduct}
            onClose={() => setAddonModalProduct(null)}
            product={addonModalProduct.product}
            addonGroups={productAddonsMap[addonModalProduct.product.id] ?? []}
            currency={currency}
            basePrice={addonModalProduct.basePrice}
            onAddToCart={({ quantity: qty, unitPrice, addons, observations }) => {
              useCartStore.getState().addItem({
                productId: addonModalProduct.product.id,
                productName: addonModalProduct.product.name,
                quantity: qty,
                unitPrice,
                addons: addons.length > 0 ? addons : undefined,
                observations: observations?.trim() || undefined,
              });
              toast({ title: '✅ Adicionado ao carrinho!', description: `${addonModalProduct.product.name} foi adicionado`, className: 'bg-green-50 border-green-200' });
            }}
          />
        )}
      </Suspense>
      {splashOverlay && <InitialSplashScreen exiting={splashFadeOut} />}
    </>
  );
}