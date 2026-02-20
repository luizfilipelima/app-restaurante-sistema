import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

export interface UpsellRow {
  id: string;
  product_id: string;
  upsell_product_id: string;
  sort_order: number;
  upsell_product: Product | null;
}

/** Busca as sugestões de upsell de um produto específico */
async function fetchUpsells(productId: string): Promise<UpsellRow[]> {
  const { data, error } = await supabase
    .from('product_upsells')
    .select(`
      id, product_id, upsell_product_id, sort_order,
      upsell_product:products!product_upsells_upsell_product_id_fkey(
        id, name, price, price_sale, image_url, is_active, category, restaurant_id,
        is_pizza, is_marmita, description, created_at, updated_at
      )
    `)
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as UpsellRow[];
}

/** Busca as sugestões de upsell para múltiplos produtos (cardápio público) */
export async function fetchUpsellsForProducts(productIds: string[]): Promise<Record<string, UpsellRow[]>> {
  if (!productIds.length) return {};
  const { data, error } = await supabase
    .from('product_upsells')
    .select(`
      id, product_id, upsell_product_id, sort_order,
      upsell_product:products!product_upsells_upsell_product_id_fkey(
        id, name, price, price_sale, image_url, is_active, category, restaurant_id,
        is_pizza, is_marmita, description, created_at, updated_at
      )
    `)
    .in('product_id', productIds)
    .eq('upsell_product.is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const result: Record<string, UpsellRow[]> = {};
  (data || []).forEach((row: unknown) => {
    const r = row as UpsellRow;
    if (!result[r.product_id]) result[r.product_id] = [];
    if (r.upsell_product) result[r.product_id].push(r);
  });
  return result;
}

export function useProductUpsells(productId: string | null) {
  return useQuery({
    queryKey: ['product-upsells', productId],
    queryFn: () => fetchUpsells(productId!),
    enabled: !!productId,
  });
}

/** Hook para salvar (replace) as sugestões de upsell de um produto */
export function useSaveProductUpsells(restaurantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, upsellIds }: { productId: string; upsellIds: string[] }) => {
      if (!restaurantId) throw new Error('Restaurante não definido');
      // Apaga as anteriores e insere as novas
      const { error: delError } = await supabase
        .from('product_upsells')
        .delete()
        .eq('product_id', productId);
      if (delError) throw delError;
      if (upsellIds.length === 0) return;
      const rows = upsellIds.map((uid, i) => ({
        restaurant_id: restaurantId,
        product_id: productId,
        upsell_product_id: uid,
        sort_order: i,
      }));
      const { error: insError } = await supabase.from('product_upsells').insert(rows);
      if (insError) throw insError;
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-upsells', productId] });
    },
  });
}
