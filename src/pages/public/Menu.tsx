import { useEffect, useState, useMemo, lazy, Suspense, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getSubdomain } from '@/lib/subdomain';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge, MarmitaSize, MarmitaProtein, MarmitaSide, Category, Subcategory } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { useRestaurantMenuData, useActiveOffersByRestaurantId } from '@/hooks/queries';
import { ShoppingCart, Clock, Search, ChevronRight, Utensils, Coffee, IceCream, UtensilsCrossed, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
const PizzaModal = lazy(() => import('@/components/public/PizzaModal'));
const MarmitaModal = lazy(() => import('@/components/public/MarmitaModal'));

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pizzaModalOpen, setPizzaModalOpen] = useState(false);
  const [marmitaModalOpen, setMarmitaModalOpen] = useState(false);
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

  const { restaurant, products, categories, categoriesFromDb, subcategories, pizzaSizes, pizzaFlavors, pizzaDoughs, pizzaEdges, marmitaSizes, marmitaProteins, marmitaSides, productComboItemsMap, productAddonsMap } = useMemo(() => {
    if (!menuData) {
      return {
        restaurant: null as Restaurant | null,
        products: [] as Product[],
        categories: [] as string[],
        categoriesFromDb: [] as Category[],
        subcategories: [] as Subcategory[],
        pizzaSizes: [] as PizzaSize[],
        pizzaFlavors: [] as PizzaFlavor[],
        pizzaDoughs: [] as PizzaDough[],
        pizzaEdges: [] as PizzaEdge[],
        marmitaSizes: [] as MarmitaSize[],
        marmitaProteins: [] as MarmitaProtein[],
        marmitaSides: [] as MarmitaSide[],
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
      pizzaSizes: menuData.pizzaSizes,
      pizzaFlavors: menuData.pizzaFlavors,
      pizzaDoughs: menuData.pizzaDoughs,
      pizzaEdges: menuData.pizzaEdges,
      marmitaSizes: menuData.marmitaSizes,
      marmitaProteins: menuData.marmitaProteins,
      marmitaSides: menuData.marmitaSides,
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
    const isPizza = p.is_pizza || p.category?.toLowerCase() === 'pizza';
    const isMarmita = p.is_marmita;
    if (isPizza) {
      setSelectedProduct({ ...p, price: offer.offer_price });
      setPizzaModalOpen(true);
    } else if (isMarmita) {
      setSelectedProduct({ ...p, price: offer.offer_price });
      setMarmitaModalOpen(true);
    } else if (addons && addons.length > 0) {
      setAddonModalProduct({ product: p, basePrice: offer.offer_price });
    } else {
      setSimpleModalProduct({ product: p, basePrice: offer.offer_price });
    }
  };

  const handleProductClick = (product: Product) => {
    const addons = productAddonsMap[product.id];
    const isPizzaProduct = product.is_pizza || product.category?.toLowerCase() === 'pizza';
    const isMarmitaProduct = product.is_marmita;
    if (isPizzaProduct) {
      setSelectedProduct(product);
      setPizzaModalOpen(true);
    } else if (isMarmitaProduct) {
      setSelectedProduct(product);
      setMarmitaModalOpen(true);
    } else if (addons && addons.length > 0) {
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
        className={`min-h-screen min-h-[100dvh] bg-slate-50 font-sans antialiased transition-all duration-500 ease-out ${
          menuVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        } ${getItemsCount() > 0 ? 'pb-28 md:pb-32' : 'pb-6 md:pb-8'}`}
        style={{ paddingBottom: getItemsCount() > 0 ? `max(5rem, calc(5rem + env(safe-area-inset-bottom)))` : undefined }}
      >
      {/* Barra sutil de refresh quando dados em background */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-orange-200/80 z-[100] overflow-hidden">
          <div className="h-full w-1/3 bg-orange-500 rounded-r-full animate-[progress-slide_1.5s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Header compacto — mobile-first */}
      <header
        className="sticky top-0 z-30 bg-white/98 backdrop-blur-md border-b border-slate-200/60"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-h-[44px]">
            {/* Logo + Nome */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 ring-1 ring-slate-200/60">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-orange-500 text-white font-bold text-sm">
                    {restaurant.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-[15px] sm:text-base font-bold text-slate-900 truncate leading-tight">
                  {restaurant.name}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${isOpen ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {isOpen ? t('menu.open') : t('menu.closed')}
                  </span>
                  <span className="text-slate-400 text-[11px] hidden sm:inline flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {t('menu.estimateTime')}
                  </span>
                </div>
              </div>
            </div>

            {/* Carrinho — sempre visível, badge quando há itens */}
            <button
              type="button"
              data-testid="menu-view-cart"
              onClick={() => setCartOpen(true)}
              className="relative flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-slate-900 text-white active:scale-95 transition-transform touch-manipulation flex-shrink-0"
              aria-label={t('menu.viewCart')}
            >
              <ShoppingCart className="h-5 w-5 sm:h-5 sm:w-5" />
              {getItemsCount() > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-orange-500 text-[11px] font-bold flex items-center justify-center text-white shadow-sm">
                  {getItemsCount()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modo mesa */}
        {tableNumber != null && onCallWaiter && (
          <div className="border-t border-amber-200/60 bg-amber-50/80">
            <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between max-w-4xl mx-auto">
              <span className="text-sm font-semibold text-amber-900">{t('menu.tableLabel')} {tableNumber}</span>
              <Button
                onClick={onCallWaiter}
                disabled={callingWaiter}
                size="sm"
                className="h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2"
              >
                {callingWaiter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {t('menu.callWaiter')}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 sm:px-5 sm:py-5 space-y-5">
        {/* Busca + Categorias em pills — sticky abaixo do header */}
        <div
          className={`sticky z-20 -mx-4 sm:-mx-5 px-4 sm:px-5 py-4 bg-slate-50/98 backdrop-blur-md ${tableNumber != null && onCallWaiter ? 'top-[7rem]' : 'top-[4.25rem]'}`}
        >
          <div className="space-y-3">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder={t('menu.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-400 transition-shadow"
                autoComplete="off"
              />
            </div>

            {/* Categorias — pills horizontais, scroll suave */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 scroll-smooth">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-2 h-10 px-4 rounded-full font-medium text-sm whitespace-nowrap flex-shrink-0 transition-all touch-manipulation active:scale-[0.98] ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <Utensils className="h-4 w-4" />
                {t('menu.all')}
              </button>
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default'];
                return (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex items-center gap-2 h-10 px-4 rounded-full font-medium text-sm whitespace-nowrap flex-shrink-0 transition-all touch-manipulation active:scale-[0.98] ${
                      selectedCategory === category
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ofertas — destaque visual */}
        {activeOffers.length > 0 && selectedCategory === 'all' && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-orange-700 flex items-center gap-2">
              {t('menu.offers')}
              <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                {activeOffers.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              <h2 className="text-sm font-semibold text-slate-600">
                {categoryName}
              </h2>
                {hasSubs ? (
                  <>
                    {subcatsForCategory.map((sub) => {
                      const subProducts = productsWithSub.filter((p) => p.subcategory_id === sub.id);
                      if (subProducts.length === 0) return null;
                      return (
                        <div key={sub.id} className="space-y-2">
                          <h3 className="text-xs font-medium text-slate-400">{sub.name}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              <h2 className="text-sm font-semibold text-slate-600">
                {selectedCategory}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500 text-base">{t('menu.noProductsInCategory')}</p>
            </div>
          )}
        </section>

        {/* Rodapé mínimo */}
        <footer className="pt-6 pb-4 text-center">
          <a
            href="https://quiero.food"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-500 text-xs transition-colors"
          >
            <img src="/quierofood-logo-f.svg" alt="" width={64} height={22} loading="lazy" className="h-5 w-auto opacity-70" />
            <span>{t('menu.developedBy')}</span>
          </a>
        </footer>
      </main>

      {/* Cart FAB — mobile, sempre visível quando há itens */}
      {getItemsCount() > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-4 pb-4"
          style={{ paddingBottom: 'max(1rem, calc(1rem + env(safe-area-inset-bottom)))' }}
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full h-14 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/25 active:scale-[0.98] transition-transform flex items-center justify-between px-5 touch-manipulation"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold">
                {getItemsCount()}
              </span>
              <div className="text-left">
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium">{t('menu.total')}</span>
                <span className="block text-base font-bold leading-tight">{formatCurrency(getSubtotal(), currency)}</span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-400">
              {t('menu.viewBag')}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
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

        {selectedProduct && (selectedProduct.is_pizza || selectedProduct.category?.toLowerCase() === 'pizza') && (
          <PizzaModal
            open={pizzaModalOpen}
            onClose={() => {
              setPizzaModalOpen(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            sizes={pizzaSizes}
            flavors={pizzaFlavors}
            doughs={pizzaDoughs}
            edges={pizzaEdges}
            currency={currency}
          />
        )}

        {selectedProduct && selectedProduct.is_marmita && (
          <MarmitaModal
            open={marmitaModalOpen}
            onClose={() => {
              setMarmitaModalOpen(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            sizes={marmitaSizes}
            proteins={marmitaProteins}
            sides={marmitaSides}
            currency={currency}
          />
        )}

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
    </div>
      {splashOverlay && <InitialSplashScreen exiting={splashFadeOut} />}
    </>
  );
}