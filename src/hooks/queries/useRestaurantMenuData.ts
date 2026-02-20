import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Restaurant,
  Product,
  Category,
  Subcategory,
  PizzaSize,
  PizzaFlavor,
  PizzaDough,
  PizzaEdge,
  MarmitaSize,
  MarmitaProtein,
  MarmitaSide,
  ProductAddonGroup,
  ProductAddonItem,
} from '@/types';

const CATEGORY_ORDER: Record<string, number> = {
  Marmitas: 0,
  Pizza: 1,
  Massas: 2,
  Lanches: 3,
  Aperitivos: 4,
  Combos: 5,
  Sobremesas: 6,
  Bebidas: 7,
  Outros: 8,
};

export interface ProductComboItemWithProduct {
  id: string;
  combo_product_id: string;
  product_id: string;
  quantity: number;
  sort_order: number;
  product: Product;
}

export interface RestaurantMenuData {
  restaurant: Restaurant;
  products: Product[];
  categories: string[];
  categoriesFromDb: Category[];
  subcategories: Subcategory[];
  pizzaSizes: PizzaSize[];
  pizzaFlavors: PizzaFlavor[];
  pizzaDoughs: PizzaDough[];
  pizzaEdges: PizzaEdge[];
  marmitaSizes: MarmitaSize[];
  marmitaProteins: MarmitaProtein[];
  marmitaSides: MarmitaSide[];
  /** Mapa combo_product_id -> itens do combo (para exibir no cardápio) */
  productComboItemsMap: Record<string, ProductComboItemWithProduct[]>;
  /** Mapa product_id -> grupos de adicionais com itens */
  productAddonsMap: Record<string, Array<ProductAddonGroup & { items: ProductAddonItem[] }>>;
}

async function fetchRestaurantMenuData(restaurantSlug: string): Promise<RestaurantMenuData | null> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_restaurant_menu', { p_slug: restaurantSlug });

  if (rpcErr || !rpcData) {
    return fetchRestaurantMenuDataFallback(restaurantSlug);
  }

  const d = rpcData as {
    restaurant: Restaurant;
    products: Product[];
    categories: string[];
    categoriesFromDb: Category[];
    subcategories: Subcategory[];
    pizzaSizes: PizzaSize[];
    pizzaFlavors: PizzaFlavor[];
    pizzaDoughs: PizzaDough[];
    pizzaEdges: PizzaEdge[];
    marmitaSizes: MarmitaSize[];
    marmitaProteins: MarmitaProtein[];
    marmitaSides: MarmitaSide[];
    productComboItemsMap: Record<string, ProductComboItemWithProduct[]>;
    productAddonsMap: Record<string, Array<ProductAddonGroup & { items: ProductAddonItem[] }>>;
  };

  return {
    restaurant: d.restaurant,
    products: d.products ?? [],
    categories: d.categories ?? [],
    categoriesFromDb: d.categoriesFromDb ?? [],
    subcategories: d.subcategories ?? [],
    pizzaSizes: d.pizzaSizes ?? [],
    pizzaFlavors: d.pizzaFlavors ?? [],
    pizzaDoughs: d.pizzaDoughs ?? [],
    pizzaEdges: d.pizzaEdges ?? [],
    marmitaSizes: d.marmitaSizes ?? [],
    marmitaProteins: d.marmitaProteins ?? [],
    marmitaSides: d.marmitaSides ?? [],
    productComboItemsMap: d.productComboItemsMap ?? {},
    productAddonsMap: d.productAddonsMap ?? {},
  };
}

async function fetchRestaurantMenuDataFallback(restaurantSlug: string): Promise<RestaurantMenuData | null> {
  const { data: restaurantData, error: restErr } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', restaurantSlug)
    .eq('is_active', true)
    .single();

  if (restErr || !restaurantData) return null;

  const rid = restaurantData.id;

  const [
    categoriesRes,
    subcategoriesRes,
    productsRes,
    pizzaSizesRes,
    pizzaFlavorsRes,
    pizzaDoughsRes,
    pizzaEdgesRes,
    marmitaSizesRes,
    marmitaProteinsRes,
    marmitaSidesRes,
  ] = await Promise.all([
    supabase.from('categories').select('*').eq('restaurant_id', rid).order('order_index', { ascending: true }),
    supabase.from('subcategories').select('*').eq('restaurant_id', rid).order('order_index', { ascending: true }),
    supabase.from('products').select('*').eq('restaurant_id', rid).eq('is_active', true).order('order_index', { ascending: true }),
    supabase.from('pizza_sizes').select('*').eq('restaurant_id', rid).order('order_index'),
    supabase.from('pizza_flavors').select('*').eq('restaurant_id', rid).eq('is_active', true).order('name'),
    supabase.from('pizza_doughs').select('*').eq('restaurant_id', rid).eq('is_active', true).order('name'),
    supabase.from('pizza_edges').select('*').eq('restaurant_id', rid).eq('is_active', true).order('name'),
    supabase.from('marmita_sizes').select('*').eq('restaurant_id', rid).eq('is_active', true).order('order_index'),
    supabase.from('marmita_proteins').select('*').eq('restaurant_id', rid).eq('is_active', true).order('name'),
    supabase.from('marmita_sides').select('*').eq('restaurant_id', rid).eq('is_active', true).order('category').order('name'),
  ]);

  const categoriesList = categoriesRes.data ?? [];
  const subcategoriesList = subcategoriesRes.data ?? [];
  const productsData = productsRes.data ?? [];

  const categoryOrderMap = new Map<string, number>();
  categoriesList.forEach((cat: Category) => {
    categoryOrderMap.set(cat.name, cat.order_index);
  });

  let products: Product[] = [];
  let categories: string[] = [];
  let productComboItemsMap: Record<string, ProductComboItemWithProduct[]> = {};
  let productAddonsMap: Record<string, Array<ProductAddonGroup & { items: ProductAddonItem[] }>> = {};

  if (productsData.length > 0) {
    const sorted = [...productsData].sort((a: Product, b: Product) => {
      const orderA = categoryOrderMap.get(a.category) ?? CATEGORY_ORDER[a.category] ?? 999;
      const orderB = categoryOrderMap.get(b.category) ?? CATEGORY_ORDER[b.category] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.order_index ?? 0) - (b.order_index ?? 0);
    });
    products = sorted;
    const unique = Array.from(new Set(productsData.map((p: Product) => p.category)));
    categories = unique.sort((a, b) => {
      const orderA = categoryOrderMap.get(a) ?? CATEGORY_ORDER[a] ?? 999;
      const orderB = categoryOrderMap.get(b) ?? CATEGORY_ORDER[b] ?? 999;
      return orderA - orderB;
    });

    const comboIds = productsData.filter((p: Product) => p.is_combo).map((p: Product) => p.id);
    if (comboIds.length > 0) {
      try {
        const { data: comboData } = await supabase
          .from('product_combo_items')
          .select('id, combo_product_id, product_id, quantity, sort_order, product:products(id, name, price, price_sale)')
          .in('combo_product_id', comboIds)
          .order('sort_order', { ascending: true });
        (comboData ?? []).forEach((row: any) => {
          const key = row.combo_product_id;
          if (!productComboItemsMap[key]) productComboItemsMap[key] = [];
          productComboItemsMap[key].push({ ...row, product: row.product });
        });
      } catch {
        productComboItemsMap = {};
      }
    }

    try {
      const { data: addonGroups } = await supabase
        .from('product_addon_groups')
        .select('*')
        .in('product_id', productsData.map((p: Product) => p.id))
        .order('order_index', { ascending: true });
      if (addonGroups?.length) {
        const groupIds = addonGroups.map((g: any) => g.id);
        const { data: addonItems } = await supabase
          .from('product_addon_items')
          .select('*')
          .in('addon_group_id', groupIds)
          .order('order_index', { ascending: true });
        const itemsByGroup: Record<string, ProductAddonItem[]> = {};
        (addonItems ?? []).forEach((i: any) => {
          const gid = i.addon_group_id;
          if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
          itemsByGroup[gid].push(i as ProductAddonItem);
        });
        addonGroups.forEach((g: any) => {
          const pid = g.product_id;
          if (!productAddonsMap[pid]) productAddonsMap[pid] = [];
          productAddonsMap[pid].push({ ...g, items: itemsByGroup[g.id] ?? [] });
        });
      }
    } catch {
      productAddonsMap = {};
    }
  }

  return {
    restaurant: restaurantData as Restaurant,
    products,
    categories,
    categoriesFromDb: categoriesList as Category[],
    subcategories: subcategoriesList as Subcategory[],
    pizzaSizes: (pizzaSizesRes.data ?? []) as PizzaSize[],
    pizzaFlavors: (pizzaFlavorsRes.data ?? []) as PizzaFlavor[],
    pizzaDoughs: (pizzaDoughsRes.data ?? []) as PizzaDough[],
    pizzaEdges: (pizzaEdgesRes.data ?? []) as PizzaEdge[],
    marmitaSizes: (marmitaSizesRes.data ?? []) as MarmitaSize[],
    marmitaProteins: (marmitaProteinsRes.data ?? []) as MarmitaProtein[],
    marmitaSides: (marmitaSidesRes.data ?? []) as MarmitaSide[],
    productComboItemsMap,
    productAddonsMap,
  };
}

const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export function useRestaurantMenuData(restaurantSlug: string | null) {
  return useQuery({
    queryKey: ['restaurant-menu', restaurantSlug],
    queryFn: () => fetchRestaurantMenuData(restaurantSlug!),
    enabled: !!restaurantSlug,
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
    refetchOnWindowFocus: false,
  });
}
