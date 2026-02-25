import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import type { PrintDestination } from '@/types';

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
