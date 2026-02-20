import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProductAddonGroup, ProductAddonItem } from '@/types';

export interface ProductAddonGroupWithItems extends ProductAddonGroup {
  items: ProductAddonItem[];
}

/** Busca grupos de adicionais de um produto (com itens) */
async function fetchProductAddons(productId: string | null): Promise<ProductAddonGroupWithItems[]> {
  if (!productId) return [];
  const { data: groups, error: groupsError } = await supabase
    .from('product_addon_groups')
    .select('*')
    .eq('product_id', productId)
    .order('order_index', { ascending: true });
  if (groupsError) throw groupsError;
  if (!groups?.length) return [];

  const groupIds = groups.map((g) => g.id);
  const { data: items, error: itemsError } = await supabase
    .from('product_addon_items')
    .select('*')
    .in('addon_group_id', groupIds)
    .order('order_index', { ascending: true });
  if (itemsError) throw itemsError;

  const itemsByGroup: Record<string, ProductAddonItem[]> = {};
  (items ?? []).forEach((i) => {
    const gid = i.addon_group_id;
    if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
    itemsByGroup[gid].push(i as ProductAddonItem);
  });

  return groups.map((g) => ({
    ...g,
    items: itemsByGroup[g.id] ?? [],
  })) as ProductAddonGroupWithItems[];
}

/** Retorna mapa product_id -> ProductAddonGroupWithItems[] */
async function fetchAddonsByProductIds(
  productIds: string[]
): Promise<Record<string, ProductAddonGroupWithItems[]>> {
  if (productIds.length === 0) return {};
  const { data: groups, error: groupsError } = await supabase
    .from('product_addon_groups')
    .select('*')
    .in('product_id', productIds)
    .order('order_index', { ascending: true });
  if (groupsError) throw groupsError;
  if (!groups?.length) return Object.fromEntries(productIds.map((id) => [id, []]));

  const groupIds = groups.map((g) => g.id);
  const { data: items, error: itemsError } = await supabase
    .from('product_addon_items')
    .select('*')
    .in('addon_group_id', groupIds)
    .order('order_index', { ascending: true });
  if (itemsError) throw itemsError;

  const itemsByGroup: Record<string, ProductAddonItem[]> = {};
  (items ?? []).forEach((i) => {
    const gid = i.addon_group_id;
    if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
    itemsByGroup[gid].push(i as ProductAddonItem);
  });

  const result: Record<string, ProductAddonGroupWithItems[]> = {};
  productIds.forEach((pid) => {
    result[pid] = (groups.filter((g) => g.product_id === pid) as ProductAddonGroup[]).map((g) => ({
      ...g,
      items: itemsByGroup[g.id] ?? [],
    }));
  });
  return result;
}

export function useProductAddons(productId: string | null) {
  const query = useQuery({
    queryKey: ['product-addons', productId],
    queryFn: () => fetchProductAddons(productId),
    enabled: !!productId,
  });
  return {
    addons: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useProductAddonsMap(productIds: string[]) {
  const query = useQuery({
    queryKey: ['product-addons-map', productIds.sort().join(',')],
    queryFn: () => fetchAddonsByProductIds(productIds),
    enabled: productIds.length > 0,
  });
  return {
    addonsMap: query.data ?? {},
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useSaveProductAddons(productIdOrNull?: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (
      payload: { productId?: string; groups: { name: string; order_index: number; items: { name: string; price: number; cost?: number; cost_currency?: string; in_stock: boolean; ingredient_id?: string | null; order_index: number }[] }[] }
    ) => {
      const productId = payload.productId ?? productIdOrNull;
      if (!productId) throw new Error('Product ID required');

      // Remove grupos existentes (cascade remove itens)
      await supabase.from('product_addon_groups').delete().eq('product_id', productId);

      for (let gi = 0; gi < payload.groups.length; gi++) {
        const g = payload.groups[gi];
        const { data: groupRow, error: groupErr } = await supabase
          .from('product_addon_groups')
          .insert({ product_id: productId, name: g.name, order_index: gi })
          .select('id')
          .single();
        if (groupErr) throw groupErr;
        const groupId = groupRow!.id;

        for (let ii = 0; ii < g.items.length; ii++) {
          const it = g.items[ii];
          const { error: itemErr } = await supabase.from('product_addon_items').insert({
            addon_group_id: groupId,
            name: it.name,
            price: it.price,
            cost: it.cost ?? 0,
            cost_currency: it.cost_currency ?? 'BRL',
            in_stock: it.in_stock,
            ingredient_id: it.ingredient_id || null,
            order_index: ii,
          });
          if (itemErr) throw itemErr;
        }
      }
    },
    onSuccess: (_, variables) => {
      const pid = variables.productId ?? productIdOrNull;
      if (pid) queryClient.invalidateQueries({ queryKey: ['product-addons', pid] });
    },
  });

  return mutation;
}
