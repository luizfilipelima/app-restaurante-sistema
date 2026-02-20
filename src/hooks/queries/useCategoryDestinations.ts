import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PrintDestination } from '@/types';

export interface CategoryDestination {
  id: string;
  name: string;
  print_destination: PrintDestination;
}

/** Retorna um Map de nome-da-categoria → print_destination. */
async function fetchCategoryDestinations(
  restaurantId: string | null
): Promise<Map<string, PrintDestination>> {
  if (!restaurantId) return new Map();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, print_destination')
    .eq('restaurant_id', restaurantId);
  if (error) throw error;
  const map = new Map<string, PrintDestination>();
  for (const cat of data ?? []) {
    map.set(cat.name, (cat.print_destination as PrintDestination) ?? 'kitchen');
  }
  return map;
}

/** Hook: Map<categoryName, PrintDestination> para o restaurante atual. */
export function useCategoryDestinations(restaurantId: string | null) {
  return useQuery({
    queryKey: ['categoryDestinations', restaurantId],
    queryFn: () => fetchCategoryDestinations(restaurantId),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

/**
 * Retorna um Map de product_id → PrintDestination a partir do campo
 * print_destination da tabela products (por produto).
 */
async function fetchProductPrintDestinations(
  restaurantId: string | null
): Promise<Map<string, PrintDestination>> {
  if (!restaurantId) return new Map();
  const { data: prods, error } = await supabase
    .from('products')
    .select('id, print_destination')
    .eq('restaurant_id', restaurantId);
  if (error) throw error;
  const productMap = new Map<string, PrintDestination>();
  for (const p of prods ?? []) {
    const dest = (p.print_destination as PrintDestination) ?? 'kitchen';
    productMap.set(p.id, dest);
  }
  return productMap;
}

/** Hook: Map<productId, PrintDestination> para uso na impressão dual de pedidos. */
export function useProductPrintDestinations(restaurantId: string | null) {
  return useQuery({
    queryKey: ['productPrintDestinations', restaurantId],
    queryFn: () => fetchProductPrintDestinations(restaurantId),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}
