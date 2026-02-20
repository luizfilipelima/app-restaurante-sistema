import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getSubdomain } from '@/lib/subdomain';
import { useRestaurantMenuData } from '@/hooks/queries';
import { Clock, Search, Utensils, Coffee, IceCream, UtensilsCrossed } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSharingMeta } from '@/hooks/useSharingMeta';
import { isWithinOpeningHours } from '@/lib/utils';
import i18n, { setStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import ProductCardViewOnly from '@/components/public/ProductCardViewOnly';

const CATEGORY_ICONS: Record<string, any> = {
  Marmitas: UtensilsCrossed,
  Pizza: Utensils,
  Bebidas: Coffee,
  Sobremesas: IceCream,
  default: Utensils,
};

interface MenuViewOnlyProps {
  /** Quando renderizado dentro de StoreLayout (subdomínio), o slug é passado por prop */
  tenantSlug?: string;
}

export default function MenuViewOnly({ tenantSlug: tenantSlugProp }: MenuViewOnlyProps = {}) {
  const { t } = useTranslation();
  const params = useParams();
  const subdomain = getSubdomain();
  // Prioridade: prop (StoreLayout) > URL > subdomínio
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: menuData, isLoading: loading, isError } = useRestaurantMenuData(restaurantSlug);

  const { restaurant, products, categories, categoriesFromDb, subcategories, productComboItemsMap } = useMemo(() => {
    if (!menuData)
      return { restaurant: null, products: [], categories: [], categoriesFromDb: [], subcategories: [], productComboItemsMap: {} as Record<string, Array<{ product: { name: string }; quantity: number }>> };
    return {
      restaurant: menuData.restaurant,
      products: menuData.products,
      categories: menuData.categories,
      categoriesFromDb: menuData.categoriesFromDb,
      subcategories: menuData.subcategories,
      productComboItemsMap: menuData.productComboItemsMap ?? {},
    };
  }, [menuData]);

  // Atualizar título e meta tags de compartilhamento (logo do restaurante como imagem destacada)
  useEffect(() => {
    if (restaurant?.name) {
      document.title = `${restaurant.name} - ${t('menu.title')}`;
    } else {
      document.title = t('menu.title');
    }
  }, [restaurant?.name, t]);
  useSharingMeta(restaurant ? { name: restaurant.name, logo: restaurant.logo } : null);

  useEffect(() => {
    if (!menuData?.restaurant) return;
    const lang: MenuLanguage = menuData.restaurant.language === 'es' ? 'es' : 'pt';
    i18n.changeLanguage(lang);
    setStoredMenuLanguage(lang);
  }, [menuData?.restaurant]);

  // Filtrar produtos por categoria e busca
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = searchQuery.trim() === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
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
    <div className="min-h-screen bg-slate-100/80 font-sans antialiased pb-8 md:pb-8 safe-area-inset-bottom">
      {/* Header - Mobile First */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-20 safe-area-inset-top">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
            // Exibir agrupado por categoria (e subcategoria quando houver)
            categories.map((categoryName) => {
              const categoryProducts = filteredProducts.filter((p) => p.category === categoryName);
              if (categoryProducts.length === 0) return null;
              const catFromDb = categoriesFromDb.find((c) => c.name === categoryName);
              const subcatsForCategory = (catFromDb ? subcategories.filter((s) => s.category_id === catFromDb.id) : []).sort((a, b) => a.order_index - b.order_index);
              const hasSubs = subcatsForCategory.length > 0 && categoryProducts.some((p) => p.subcategory_id);
              const productsWithoutSub = categoryProducts.filter((p) => !p.subcategory_id);

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
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              {subProducts.map((product) => (
                                <ProductCardViewOnly key={product.id} product={product} currency={currency} comboItems={productComboItemsMap?.[product.id]} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {productsWithoutSub.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {productsWithoutSub.map((product) => (
                            <ProductCardViewOnly key={product.id} product={product} currency={currency} comboItems={productComboItemsMap?.[product.id]} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {categoryProducts.map((product) => (
                        <ProductCardViewOnly key={product.id} product={product} currency={currency} comboItems={productComboItemsMap?.[product.id]} />
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCardViewOnly
                    key={product.id}
                    product={product}
                    currency={currency}
                    comboItems={productComboItemsMap?.[product.id]}
                  />
                ))}
              </div>
            </>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 sm:py-16 bg-white/60 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 mx-1">
              <p className="text-slate-500 text-base sm:text-sm text-sm-mobile-block">
                {searchQuery ? t('menuViewOnly.noSearchResults') : t('menuViewOnly.noProductsInCategory')}
              </p>
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
    </div>
  );
}
