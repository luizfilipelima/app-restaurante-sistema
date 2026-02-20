import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubdomain } from '@/lib/subdomain';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge, MarmitaSize, MarmitaProtein, MarmitaSide, Category, Subcategory } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { useRestaurantMenuData, useActiveOffers } from '@/hooks/queries';
import { ShoppingCart, Clock, Search, ChevronRight, Utensils, Coffee, IceCream, UtensilsCrossed, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useSharingMeta } from '@/hooks/useSharingMeta';
import { isWithinOpeningHours, formatCurrency } from '@/lib/utils';
import i18n, { setStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import ProductCard from '@/components/public/ProductCard';
import CartDrawer from '@/components/public/CartDrawer';
import PizzaModal from '@/components/public/PizzaModal';
import MarmitaModal from '@/components/public/MarmitaModal';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pizzaModalOpen, setPizzaModalOpen] = useState(false);
  const [marmitaModalOpen, setMarmitaModalOpen] = useState(false);

  const { data: menuData, isLoading: loading, isError } = useRestaurantMenuData(restaurantSlug);
  const { data: activeOffers = [] } = useActiveOffers(restaurantSlug);
  const productIdToOffer = useMemo(() => {
    const m = new Map<string, typeof activeOffers[0]>();
    activeOffers.forEach((o) => m.set(o.product_id, o));
    return m;
  }, [activeOffers]);

  const { restaurant, products, categories, categoriesFromDb, subcategories, pizzaSizes, pizzaFlavors, pizzaDoughs, pizzaEdges, marmitaSizes, marmitaProteins, marmitaSides, productComboItemsMap } = useMemo(() => {
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
        productComboItemsMap: {} as Record<string, Array<{ product: Product }>>,
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

  const { getItemsCount, getSubtotal, setRestaurant: setCartRestaurant, restaurantId: cartRestaurantId } = useCartStore();
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

  useEffect(() => {
    if (!menuData?.restaurant) return;
    const r = menuData.restaurant;
    setCurrentRestaurant(r);
    setCartRestaurant(r.id);
    const lang: MenuLanguage = r.language === 'es' ? 'es' : 'pt';
    i18n.changeLanguage(lang);
    setStoredMenuLanguage(lang);
  }, [menuData?.restaurant, setCurrentRestaurant, setCartRestaurant]);

  // Atualizar título e meta tags de compartilhamento (logo do restaurante como imagem destacada)
  useEffect(() => {
    if (restaurant?.name) document.title = restaurant.name;
    else document.title = t('menu.title');
  }, [restaurant?.name, t]);
  useSharingMeta(restaurant ? { name: restaurant.name, logo: restaurant.logo } : null);

  const handleOfferProductClick = (offer: { product: Product; offer_price: number; original_price: number; label?: string | null }) => {
    const p = offer.product;
    const isPizza = p.is_pizza || p.category?.toLowerCase() === 'pizza';
    if (isPizza) {
      setSelectedProduct({ ...p, price: offer.offer_price });
      setPizzaModalOpen(true);
    } else if (p.is_marmita) {
      setSelectedProduct({ ...p, price: offer.offer_price });
      setMarmitaModalOpen(true);
    } else {
      useCartStore.getState().addItem({
        productId: p.id,
        productName: p.name,
        quantity: 1,
        unitPrice: offer.offer_price,
      });
      toast({ title: '✅ Adicionado ao carrinho!', description: `${p.name} foi adicionado`, className: 'bg-green-50 border-green-200' });
    }
  };

  const handleProductClick = (product: Product) => {
    const isPizzaProduct = product.is_pizza || product.category?.toLowerCase() === 'pizza';
    if (isPizzaProduct) {
      setSelectedProduct(product);
      setPizzaModalOpen(true);
    } else if (product.is_marmita) {
      setSelectedProduct(product);
      setMarmitaModalOpen(true);
    } else {
      useCartStore.getState().addItem({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      
      toast({
        title: "✅ Adicionado ao carrinho!",
        description: `${product.name} foi adicionado`,
        className: "bg-green-50 border-green-200",
      });
    }
  };

  // Filtrar e ordenar produtos
  const filteredProducts = selectedCategory === 'all'
    ? products // Já estão ordenados
    : products
        .filter((p) => p.category === selectedCategory)
        .sort((a, b) => a.name.localeCompare(b.name)); // Ordenar por nome dentro da categoria

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100/80">
        <div className="bg-white/95 border-b border-slate-200/80">
          <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center gap-4">
            <Skeleton className="h-12 w-12 md:h-14 md:w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[74px] w-[70px] rounded-2xl flex-shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-9 w-full rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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
    <div className={`min-h-screen bg-slate-100/80 font-sans antialiased ${getItemsCount() > 0 ? 'pb-24 md:pb-28' : 'pb-8 md:pb-8'} safe-area-inset-bottom`}>
      {/* Header - Mobile First */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-20 safe-area-inset-top">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl sm:rounded-2xl overflow-hidden ring-2 ring-slate-100 flex-shrink-0 bg-white shadow-sm">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-base sm:text-lg">
                    {restaurant.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 truncate tracking-tight leading-tight">{restaurant.name}</h1>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-red-500'} ${isOpen ? 'animate-pulse' : ''}`} />
                    {isOpen ? t('menu.open') : t('menu.closed')}
                  </span>
                  <span className="text-slate-400 text-[10px] sm:text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t('menu.estimateTime')}
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-95 !text-white border-0 px-3 sm:px-5 py-3 sm:py-6 h-auto gap-1.5 sm:gap-2 font-semibold text-base sm:text-sm shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-200 min-w-[44px] sm:min-w-[130px] flex-shrink-0 touch-manipulation text-sm-mobile-inline [&_svg]:text-white"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('menu.viewCart')}</span>
            </Button>
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
        {/* Busca e categorias - Mobile First */}
        <div className={`sticky z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-slate-100/80 backdrop-blur-md rounded-xl sm:rounded-2xl ${tableNumber != null && onCallWaiter ? 'top-[115px] sm:top-[125px] md:top-[135px]' : 'top-[65px] sm:top-[73px] md:top-[81px]'}`}>
          <div className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
              <Input
                placeholder={t('menu.searchPlaceholder')}
                className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-3 sm:pr-4 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl border shadow-sm focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/20 text-base sm:text-base text-slate-900 placeholder:text-slate-400 transition-shadow touch-manipulation"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory scroll-smooth -mx-1 px-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] sm:min-w-[70px] h-[68px] sm:h-[74px] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex-shrink-0 snap-start touch-manipulation active:scale-95 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200/80 active:border-slate-300 active:bg-slate-50'
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${selectedCategory === 'all' ? 'bg-white/15' : 'bg-slate-100'}`}>
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold leading-tight">{t('menu.all')}</span>
              </button>
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default'];
                return (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex flex-col items-center justify-center gap-1 min-w-[64px] sm:min-w-[70px] h-[68px] sm:h-[74px] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex-shrink-0 snap-start touch-manipulation active:scale-95 ${
                      selectedCategory === category
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white text-slate-600 border border-slate-200/80 active:border-slate-300 active:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${selectedCategory === category ? 'bg-white/15' : 'bg-slate-100'}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap leading-tight">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Seção Ofertas (chamativa) ── */}
        {activeOffers.length > 0 && (
          <section className="rounded-2xl overflow-hidden border-2 border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 shadow-lg">
            <div className="px-4 py-3 border-b border-orange-200/80 bg-orange-500/10 flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h2 className="text-base sm:text-lg font-bold text-orange-800 uppercase tracking-wider">Ofertas</h2>
              <span className="text-xs font-semibold text-orange-600 bg-orange-200/60 px-2 py-0.5 rounded-full">{activeOffers.length}</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-4 pb-2 -mx-1 min-w-0">
                {activeOffers.map((offer) => (
                  <div key={offer.id} className="flex-shrink-0 w-[min(280px,85vw)]">
                    <ProductCard
                      product={offer.product}
                      onClick={() => handleOfferProductClick(offer)}
                      currency={currency}
                      comboItems={productComboItemsMap?.[offer.product.id]}
                      offer={{ price: offer.offer_price, originalPrice: offer.original_price, label: offer.label }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Lista de produtos - Mobile First */}
        <section className="space-y-6 sm:space-y-8">
          {selectedCategory === 'all' ? (
            // Exibir agrupado por categoria (e subcategoria quando houver) quando "Todos" está selecionado
            categories.map((categoryName) => {
              const categoryProducts = products.filter((p) => p.category === categoryName);
              if (categoryProducts.length === 0) return null;
              const catFromDb = categoriesFromDb.find((c) => c.name === categoryName);
              const subcatsForCategory = (catFromDb ? subcategories.filter((s) => s.category_id === catFromDb.id) : []).sort((a, b) => a.order_index - b.order_index);
              const productsWithSub = categoryProducts.filter((p) => p.subcategory_id);
              const productsWithoutSub = categoryProducts.filter((p) => !p.subcategory_id);
              const hasSubs = subcatsForCategory.length > 0 && productsWithSub.length > 0;

              return (
                <div key={categoryName} className="space-y-3 sm:space-y-5">
                  <h2 className="text-sm-mobile-block sm:text-base font-semibold text-slate-500 uppercase tracking-wider px-1">
                    {categoryName}
                  </h2>
                  {hasSubs ? (
                    <>
                      {subcatsForCategory.map((sub) => {
                        const subProducts = categoryProducts.filter((p) => p.subcategory_id === sub.id);
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
              );
            })
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
            <img src="/quierofood-logo-f.svg" alt="Quiero.food" className="h-7 w-auto object-contain opacity-80 hover:opacity-100" />
            <span className="text-xs">{t('menu.developedBy')}</span>
          </a>
        </footer>
      </main>

      {/* Cart FAB (Mobile) - Mobile First */}
      {getItemsCount() > 0 && (
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
              className="w-full h-16 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/30 hover:bg-slate-800 active:scale-[0.98] transition-all p-0 overflow-hidden flex items-stretch"
              onClick={() => setCartOpen(true)}
            >
              {/* Left Side: Info */}
              <div className="flex-1 flex items-center justify-start px-4 gap-3.5">
                <div className="relative">
                   <div className="bg-white/20 h-9 w-9 rounded-full flex items-center justify-center border border-white/10 shadow-inner">
                      <span className="text-sm font-bold">{getItemsCount()}</span>
                   </div>
                </div>
                <div className="flex flex-col items-start justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-tight">{t('menu.total')}</span>
                  <span className="text-base font-bold text-white leading-tight">{formatCurrency(getSubtotal(), currency)}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-[1px] bg-white/10 my-3"></div>

              {/* Right Side: Action */}
              <div className="px-5 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors h-full">
                <span className="text-sm font-bold">{t('menu.viewBag')}</span>
                <ChevronRight className="h-4 w-4 opacity-70" />
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Modais */}
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
    </div>
  );
}