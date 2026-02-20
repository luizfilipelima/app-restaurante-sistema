import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProductComboItem, Product } from '@/types';

/** Busca itens de um combo (com produto populado) */
async function fetchComboItems(comboProductId: string | null): Promise<Array<ProductComboItem & { product: Product }>> {
  if (!comboProductId) return [];
  const { data, error } = await supabase
    .from('product_combo_items')
    .select(`
      id, combo_product_id, product_id, quantity, sort_order, created_at,
      product:products(id, name, price, price_sale, image_url, is_active)
    `)
    .eq('combo_product_id', comboProductId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    product: row.product as Product,
  }));
}

/** Retorna mapa combo_product_id -> ProductComboItem[] para todos os combos */
async function fetchAllComboItemsByProduct(
  productIds: string[]
): Promise<Record<string, Array<ProductComboItem & { product: Product }>>> {
  if (productIds.length === 0) return {};
  const { data, error } = await supabase
    .from('product_combo_items')
    .select(`
      id, combo_product_id, product_id, quantity, sort_order, created_at,
      product:products(id, name, price, price_sale, image_url, is_active)
    `)
    .in('combo_product_id', productIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const result: Record<string, Array<ProductComboItem & { product: Product }>> = {};
  (data ?? []).forEach((row: any) => {
    const key = row.combo_product_id;
    if (!result[key]) result[key] = [];
    result[key].push({ ...row, product: row.product as Product });
  });
  return result;
}

export function useProductComboItems(comboProductId: string | null) {
  const query = useQuery({
    queryKey: ['product-combo-items', comboProductId],
    queryFn: () => fetchComboItems(comboProductId),
    enabled: !!comboProductId,
  });
  return {
    comboItems: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useProductComboItemsMap(productIds: string[]) {
  const query = useQuery({
    queryKey: ['product-combo-items-map', productIds.sort().join(',')],
    queryFn: () => fetchAllComboItemsByProduct(productIds),
    enabled: productIds.length > 0,
  });
  return {
    comboItemsMap: query.data ?? {},
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useSaveProductComboItems(comboProductId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (items: { product_id: string; quantity: number; sort_order: number }[]) => {
      if (!comboProductId) throw new Error('Combo product ID required');
      await supabase.from('product_combo_items').delete().eq('combo_product_id', comboProductId);
      if (items.length === 0) return;
      const rows = items.map((it) => ({
        combo_product_id: comboProductId,
        product_id: it.product_id,
        quantity: it.quantity,
        sort_order: it.sort_order,
      }));
      const { error } = await supabase.from('product_combo_items').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-combo-items', comboProductId] });
    },
  });

  return mutation;
}
