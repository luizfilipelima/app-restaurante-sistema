import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getSubdomain } from '@/lib/subdomain';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge, MarmitaSize, MarmitaProtein, MarmitaSide, Category, Subcategory } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { ShoppingCart, Clock, Search, ChevronRight, Utensils, Coffee, IceCream, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
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
}

export default function PublicMenu({ tenantSlug: tenantSlugProp }: PublicMenuProps = {}) {
  const { t } = useTranslation();
  const params = useParams();
  const subdomain = getSubdomain();
  // Prioridade: prop (StoreLayout) > URL > subdomínio
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesFromDb, setCategoriesFromDb] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  
  // Estados para pizza
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaFlavors, setPizzaFlavors] = useState<PizzaFlavor[]>([]);
  const [pizzaDoughs, setPizzaDoughs] = useState<PizzaDough[]>([]);
  const [pizzaEdges, setPizzaEdges] = useState<PizzaEdge[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pizzaModalOpen, setPizzaModalOpen] = useState(false);
  
  // Estados para marmita
  const [marmitaSizes, setMarmitaSizes] = useState<MarmitaSize[]>([]);
  const [marmitaProteins, setMarmitaProteins] = useState<MarmitaProtein[]>([]);
  const [marmitaSides, setMarmitaSides] = useState<MarmitaSide[]>([]);
  const [marmitaModalOpen, setMarmitaModalOpen] = useState(false);

  const isSubdomain = subdomain && !['app', 'www', 'localhost'].includes(subdomain);

  const handleCheckoutNavigation = () => {
    if (isSubdomain) {
      navigate('/checkout');
    } else {
      navigate(`/${restaurantSlug}/checkout`);
    }
  };

  const { getItemsCount, getSubtotal, setRestaurant: setCartRestaurant } = useCartStore();
  const { setCurrentRestaurant } = useRestaurantStore();

  useEffect(() => {
    loadRestaurantData();
  }, [restaurantSlug]);

  // Atualizar título da página com o nome do restaurante
  useEffect(() => {
    if (restaurant?.name) document.title = restaurant.name;
    else document.title = t('menu.title');
  }, [restaurant?.name, t]);

  const loadRestaurantData = async () => {
    if (!restaurantSlug) return;

    try {
      setLoading(true);

      // Buscar restaurante
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', restaurantSlug)
        .eq('is_active', true)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);
        setCurrentRestaurant(restaurantData);
        setCartRestaurant(restaurantData.id);
        const lang: MenuLanguage = restaurantData.language === 'es' ? 'es' : 'pt';
        i18n.changeLanguage(lang);
        setStoredMenuLanguage(lang);

        // Buscar categorias ordenadas
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .order('order_index', { ascending: true });
        const categoriesList = categoriesData ?? [];
        setCategoriesFromDb(categoriesList);
        // Subcategorias (opcional; tabela pode não existir antes da migration)
        let subcategoriesData: Subcategory[] = [];
        try {
          const { data: subData } = await supabase.from('subcategories').select('*').eq('restaurant_id', restaurantData.id).order('order_index', { ascending: true });
          subcategoriesData = subData ?? [];
        } catch {
          // ignorar se tabela subcategories não existir
        }
        setSubcategories(subcategoriesData);

        // Criar mapa de ordem de categorias
        const categoryOrderMap = new Map<string, number>();
        categoriesList.forEach((cat) => {
          categoryOrderMap.set(cat.name, cat.order_index);
        });

        // Buscar produtos (ordem do admin via order_index)
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .eq('is_active', true)
          .order('order_index', { ascending: true });

        if (productsData && productsData.length > 0) {
          // Ordenar produtos: primeiro por categoria (order_index do banco), depois por order_index do produto
          const sortedProducts = [...productsData].sort((a, b) => {
            const orderA = categoryOrderMap.get(a.category) ?? CATEGORY_ORDER[a.category] ?? 999;
            const orderB = categoryOrderMap.get(b.category) ?? CATEGORY_ORDER[b.category] ?? 999;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return (a.order_index ?? 0) - (b.order_index ?? 0);
          });
          
          setProducts(sortedProducts);
          
          // Ordenar categorias usando order_index do banco
          const uniqueCategories = Array.from(new Set(productsData.map((p) => p.category)));
          const sortedCategories = uniqueCategories.sort((a, b) => {
            const orderA = categoryOrderMap.get(a) ?? CATEGORY_ORDER[a] ?? 999;
            const orderB = categoryOrderMap.get(b) ?? CATEGORY_ORDER[b] ?? 999;
            return orderA - orderB;
          });
          setCategories(sortedCategories);
        } else {
          // Fallback para Mock Data se não houver produtos no banco
          setProducts(MOCK_PRODUCTS);
          setCategories(sortCategories(['Pizza', 'Bebidas', 'Sobremesas']));
        }

        // Buscar dados de pizza
        const [sizesRes, flavorsRes, doughsRes, edgesRes] = await Promise.all([
          supabase.from('pizza_sizes').select('*').eq('restaurant_id', restaurantData.id).order('order_index'),
          supabase.from('pizza_flavors').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
          supabase.from('pizza_doughs').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
          supabase.from('pizza_edges').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
        ]);

        if (sizesRes.data) setPizzaSizes(sizesRes.data);
        if (flavorsRes.data) setPizzaFlavors(flavorsRes.data);
        if (doughsRes.data) setPizzaDoughs(doughsRes.data);
        if (edgesRes.data) setPizzaEdges(edgesRes.data);

        // Buscar dados de marmita
        const [marmitaSizesRes, marmitaProteinsRes, marmitaSidesRes] = await Promise.all([
          supabase.from('marmita_sizes').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('order_index'),
          supabase.from('marmita_proteins').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
          supabase.from('marmita_sides').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('category', { ascending: true }).order('name'),
        ]);

        if (marmitaSizesRes.data) setMarmitaSizes(marmitaSizesRes.data);
        if (marmitaProteinsRes.data) setMarmitaProteins(marmitaProteinsRes.data);
        if (marmitaSidesRes.data) setMarmitaSides(marmitaSidesRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.is_pizza) {
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
      });
      
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

  if (!restaurant) return <div>{t('menu.restaurantNotFound')}</div>;

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
              className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-95 text-white border-0 px-3 sm:px-5 py-3 sm:py-6 h-auto gap-1.5 sm:gap-2 font-semibold text-base sm:text-sm shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-200 min-w-[44px] sm:min-w-[130px] flex-shrink-0 touch-manipulation text-sm-mobile-inline"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('menu.viewCart')}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-4 sm:space-y-6">
        {/* Busca e categorias - Mobile First */}
        <div className="sticky top-[65px] sm:top-[73px] md:top-[81px] z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-slate-100/80 backdrop-blur-md rounded-xl sm:rounded-2xl">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                              {subProducts.map((product) => (
                                <ProductCard
                                  key={product.id}
                                  product={product}
                                  onClick={() => handleProductClick(product)}
                                  currency={currency}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {productsWithoutSub.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                          {productsWithoutSub.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              onClick={() => handleProductClick(product)}
                              currency={currency}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                      {categoryProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onClick={() => handleProductClick(product)}
                          currency={currency}
                        />
                      ))}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => handleProductClick(product)}
                    currency={currency}
                  />
                ))}
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
            <img src="/logo-quierofood.png" alt="Quiero.food" className="h-7 w-auto object-contain opacity-80 hover:opacity-100" />
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
      />

      {selectedProduct && selectedProduct.is_pizza && (
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