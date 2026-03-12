import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubdomain } from '@/lib/core/subdomain';
import { useRestaurantMenuData } from '@/hooks/queries';
import { Clock, Search, Utensils, ArrowLeft, ChevronRight, Info } from 'lucide-react';
import { getCategoryIconComponent } from '@/lib/menu/categoryIcons';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSharingMeta } from '@/hooks/shared/useSharingMeta';
import { isWithinOpeningHours } from '@/lib/core/utils';
import { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import RestaurantInfoModal from '@/components/public/_shared/RestaurantInfoModal';
import ProductCardViewOnly from '@/components/public/menu/ProductCardViewOnly';

interface MenuViewOnlyProps {
  /** Quando renderizado dentro de StoreLayout (subdomínio), o slug é passado por prop */
  tenantSlug?: string;
}

export default function MenuViewOnly({ tenantSlug: tenantSlugProp }: MenuViewOnlyProps = {}) {
  const { t, i18n } = useTranslation();
  const params = useParams<{ restaurantSlug?: string; categoryId?: string }>();
  const navigate = useNavigate();
  const subdomain = getSubdomain();
  // Prioridade: prop (StoreLayout) > URL > subdomínio
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const [viewingCategoryId, setViewingCategoryId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);

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
    document.title = restaurant?.name ? restaurant.name : t('menu.title');
  }, [restaurant?.name, t]);
  useSharingMeta(restaurant ? { name: restaurant.name, logo: restaurant.logo } : null);

  useEffect(() => {
    if (!menuData?.restaurant) return;
    const r = menuData.restaurant;
    const userHasChosen = hasStoredMenuLanguage();
    const lang: MenuLanguage = userHasChosen ? getStoredMenuLanguage() : (r.language === 'es' ? 'es' : 'pt');
    if (!userHasChosen) setStoredMenuLanguage(lang);
    i18n.changeLanguage(lang);
  }, [menuData?.restaurant]);

  const categoryIdFromRoute = params.categoryId ?? null;
  const menuDisplayMode = (restaurant?.menu_display_mode ?? 'default') as 'default' | 'categories_first';
  const categoriesFirst = menuDisplayMode === 'categories_first';
  const effectiveViewingCategoryId = categoryIdFromRoute ?? viewingCategoryId;
  const viewingSingleCategory = !!effectiveViewingCategoryId;

  const currentCategoryFromRoute = useMemo(
    () => (effectiveViewingCategoryId ? categoriesFromDb.find((c) => c.id === effectiveViewingCategoryId) : null),
    [effectiveViewingCategoryId, categoriesFromDb]
  );

  // Filtrar produtos por categoria e busca
  const filteredProducts = useMemo(() => {
    let base = viewingSingleCategory && currentCategoryFromRoute
      ? products.filter((p) => p.category === currentCategoryFromRoute.name)
      : products.filter((product) => {
          const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
          const matchesSearch = searchQuery.trim() === '' ||
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchesCategory && matchesSearch;
        });
    if (searchQuery.trim() && viewingSingleCategory) {
      base = base.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return base;
  }, [products, selectedCategory, searchQuery, viewingSingleCategory, currentCategoryFromRoute]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card/95 border-b border-border">
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
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
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

  if (!loading && (!menuData || isError || !restaurant)) return <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">{t('menu.restaurantNotFound')}</div>;
  if (!restaurant) return null;

  const validCurrencies = ['BRL', 'PYG', 'ARS', 'USD'] as const;
  const currency = validCurrencies.includes(restaurant.currency as typeof validCurrencies[number])
    ? (restaurant.currency as typeof validCurrencies[number])
    : 'BRL';

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
    <div className="min-h-screen bg-background font-sans antialiased pb-8 md:pb-8 safe-area-inset-bottom">
      {/* Header - Mobile First */}
      <header className="sticky top-0 left-0 right-0 bg-background/80 backdrop-blur-md border-b border-border z-20 safe-area-inset-top">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {viewingSingleCategory && (
              <button
                type="button"
                onClick={() => (viewingCategoryId ? setViewingCategoryId(null) : navigate('/menu'))}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Categorias</span>
              </button>
            )}
            <div className="h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl sm:rounded-2xl overflow-hidden ring-2 ring-border flex-shrink-0 bg-card shadow-sm">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt={restaurant.name} width={56} height={56} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground font-bold text-base sm:text-lg">
                  {restaurant.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate tracking-tight leading-tight">{restaurant.name}</h1>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${isOpen ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isOpen ? 'bg-success' : 'bg-destructive'} ${isOpen ? 'animate-pulse' : ''}`} />
                  {isOpen ? t('menu.open') : t('menu.closed')}
                </span>
                <span className="text-muted-foreground text-[10px] sm:text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t('menu.estimateTime')}
                </span>
              </div>
            </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                aria-label="Informações do restaurante"
                title="Informações do restaurante"
                onClick={() => setInfoModalOpen(true)}
                className="flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border active:scale-95 transition-all touch-manipulation flex-shrink-0 shadow-sm hover:shadow-md"
              >
                <Info className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <RestaurantInfoModal open={infoModalOpen} onOpenChange={setInfoModalOpen} restaurant={restaurant} />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-4 sm:space-y-6">
        {/* Modo categorias primeiro: cards com imagem no topo (16:9), bordas arredondadas */}
        {categoriesFirst && !viewingSingleCategory && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">{t('menu.all')}</h2>
            <div className="flex flex-col gap-3 sm:gap-4">
              {categoriesFromDb
                .filter((cat) => categories.includes(cat.name))
                .map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setViewingCategoryId(cat.id)}
                    className="group w-full text-left flex flex-col rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg hover:border-border hover:ring-2 hover:ring-border transition-all duration-200 active:scale-[0.99] cursor-pointer"
                  >
                    {cat.image_url ? (
                      <>
                        <div className="relative w-full aspect-video bg-muted overflow-hidden rounded-2xl">
                          <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                          <span className="font-semibold text-card-foreground text-base sm:text-lg truncate flex-1">{cat.name}</span>
                          <span className="flex items-center gap-1 shrink-0 rounded-full bg-muted group-hover:bg-primary/10 px-3 py-2 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            {t('menu.viewProducts')}
                            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-4 w-full p-4 sm:p-5">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-2xl bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center ring-1 ring-border group-hover:from-primary/10 group-hover:to-primary/20 group-hover:ring-primary/30 transition-all duration-200">
                          {(() => {
                            const IconComp = getCategoryIconComponent(cat.icon);
                            return <IconComp className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground group-hover:text-primary transition-colors" />;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                          <span className="font-semibold text-card-foreground text-base sm:text-lg truncate">{cat.name}</span>
                          <span className="flex items-center gap-1 shrink-0 rounded-full bg-muted group-hover:bg-primary/10 px-3 py-2 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors duration-200">
                            {t('menu.viewProducts')}
                            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Busca e categorias — quando não no modo categorias-first inicial */}
        {(!categoriesFirst || viewingSingleCategory) && (
        <div className="sticky top-[65px] sm:top-[73px] md:top-[81px] z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-background/80 backdrop-blur-md rounded-xl sm:rounded-2xl">
          <div className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                placeholder={t('menu.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-3 sm:pr-4 bg-card border-border rounded-xl sm:rounded-2xl border shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 text-base sm:text-base text-foreground placeholder:text-muted-foreground transition-shadow touch-manipulation"
              />
            </div>

            {/* Categorias em formato pill — sempre visível (modo padrão e quando visualizando categoria no modo categorias-first) */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory scroll-smooth -mx-1 px-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  if (categoriesFirst) setViewingCategoryId(null);
                }}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] sm:min-w-[70px] h-[68px] sm:h-[74px] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex-shrink-0 snap-start touch-manipulation active:scale-95 ${
                  !viewingSingleCategory && selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-card text-muted-foreground border border-border active:border-border active:bg-muted'
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${!viewingSingleCategory && selectedCategory === 'all' ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold leading-tight">{t('menu.all')}</span>
              </button>
              {categories.map((categoryName) => {
                const catFromDb = categoriesFromDb.find((c) => c.name === categoryName);
                const IconComp = getCategoryIconComponent(catFromDb?.icon);
                const isSelected =
                  viewingSingleCategory && currentCategoryFromRoute?.name === categoryName
                    ? true
                    : !viewingSingleCategory && selectedCategory === categoryName;
                return (
                  <button
                    type="button"
                    key={categoryName}
                    onClick={() => {
                      setSelectedCategory(categoryName);
                      if (categoriesFirst && catFromDb) setViewingCategoryId(catFromDb.id);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 min-w-[64px] sm:min-w-[70px] h-[68px] sm:h-[74px] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex-shrink-0 snap-start touch-manipulation active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-card text-muted-foreground border border-border active:border-border active:bg-muted'
                    }`}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${isSelected ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                      <IconComp className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap leading-tight">{categoryName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Lista de produtos - Mobile First (oculta no modo categorias-first inicial) */}
        {(!categoriesFirst || viewingSingleCategory) && (
        <section className="space-y-6 sm:space-y-8">
          {selectedCategory === 'all' && !viewingSingleCategory ? (
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
                  <h2 className="text-sm-mobile-block sm:text-base font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {categoryName}
                  </h2>
                  {hasSubs ? (
                    <>
                      {subcatsForCategory.map((sub) => {
                        const subProducts = categoryProducts.filter((p) => p.subcategory_id === sub.id);
                        if (subProducts.length === 0) return null;
                        return (
                          <div key={sub.id} className="space-y-2">
                            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">{sub.name}</h3>
                            <div className="flex flex-col gap-3 sm:gap-4">
                              {subProducts.map((product) => (
                                <ProductCardViewOnly key={product.id} product={product} currency={currency} comboItems={productComboItemsMap?.[product.id]} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {productsWithoutSub.length > 0 && (
                          <div className="flex flex-col gap-3 sm:gap-4">
                            {productsWithoutSub.map((product) => (
                              <ProductCardViewOnly key={product.id} product={product} currency={currency} comboItems={productComboItemsMap?.[product.id]} />
                            ))}
                          </div>
                      )}
                    </>
                  ) : (
                        <div className="flex flex-col gap-3 sm:gap-4">
                          {categoryProducts.map((product) => (
                            <ProductCardViewOnly key={product.id} product={product} currency={currency} comboItems={productComboItemsMap?.[product.id]} />
                          ))}
                        </div>
                  )}
                </div>
              );
            })
          ) : (
                <>
                  <h2 className="text-sm-mobile-block sm:text-base font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {viewingSingleCategory && currentCategoryFromRoute ? currentCategoryFromRoute.name : selectedCategory}
                  </h2>
                  <div className="flex flex-col gap-3 sm:gap-4">
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
            <div className="text-center py-12 sm:py-16 bg-card/60 rounded-xl sm:rounded-2xl border border-dashed border-border mx-1">
              <p className="text-muted-foreground text-base sm:text-sm text-sm-mobile-block">
                {searchQuery ? t('menuViewOnly.noSearchResults') : t('menuViewOnly.noProductsInCategory')}
              </p>
            </div>
          )}
        </section>
        )}

        {/* Rodapé */}
        <footer className="pt-[25px] pb-[29px] text-center">
          <a
            href="https://quiero.food"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span
              className="inline-block h-7 w-[100px] bg-primary opacity-90 hover:opacity-100 transition-opacity shrink-0"
              style={{
                maskImage: 'url(/quierofood-logo-f.svg)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: 'url(/quierofood-logo-f.svg)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
              }}
              aria-hidden
            />
            <img src="/quierofood-logo-f.svg" alt="Quiero.food" className="sr-only" width={100} height={28} />
          </a>
        </footer>
      </main>
    </div>
  );
}
