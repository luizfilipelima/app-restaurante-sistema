import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProductOffer, Product } from '@/types';

/** Ofertas ativas/agendadas do restaurante (admin) */
async function fetchOffers(restaurantId: string | null): Promise<ProductOffer[]> {
  if (!restaurantId) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('product_offers')
    .select(`
      id, restaurant_id, product_id, offer_price, original_price, starts_at, ends_at,
      label, is_active, sort_order, created_at, updated_at,
      product:products(id, name, price, price_sale, image_url, category, is_active)
    `)
    .eq('restaurant_id', restaurantId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, product: row.product as Product }));
}

/** Ofertas vigentes para o cardápio público (starts_at <= now <= ends_at) */
async function fetchActiveOffersForMenu(restaurantId: string | null): Promise<Array<ProductOffer & { product: Product }>> {
  if (!restaurantId) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('product_offers')
    .select(`
      id, restaurant_id, product_id, offer_price, original_price, starts_at, ends_at,
      label, is_active, sort_order,
      product:products(*)
    `)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, product: row.product as Product }));
}

/** Ofertas vigentes por slug do restaurante (cardápio público) */
export async function fetchActiveOffersBySlug(restaurantSlug: string | null): Promise<Array<ProductOffer & { product: Product }>> {
  if (!restaurantSlug) return [];
  try {
    const { data: r } = await supabase.from('restaurants').select('id').eq('slug', restaurantSlug).eq('is_active', true).single();
    if (!r?.id) return [];
    return await fetchActiveOffersForMenu(r.id);
  } catch {
    return [];
  }
}

export function useProductOffers(restaurantId: string | null) {
  const query = useQuery({
    queryKey: ['product-offers', restaurantId],
    queryFn: () => fetchOffers(restaurantId),
    enabled: !!restaurantId,
  });

  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['product-offers', restaurantId] });

  const createOffer = useMutation({
    mutationFn: async (payload: {
      product_id: string;
      offer_price: number;
      original_price: number;
      starts_at: string;
      ends_at: string;
      label?: string | null;
      sort_order?: number;
    }) => {
      if (!restaurantId) throw new Error('Restaurante não definido');
      const { data, error } = await supabase
        .from('product_offers')
        .insert({ restaurant_id: restaurantId, ...payload })
        .select()
        .single();
      if (error) throw error;
      return data as ProductOffer;
    },
    onSuccess: invalidate,
  });

  const updateOffer = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ProductOffer> }) => {
      const { error } = await supabase.from('product_offers').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteOffer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_offers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    offers: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createOffer: createOffer.mutateAsync,
    updateOffer: (id: string, payload: Partial<ProductOffer>) => updateOffer.mutateAsync({ id, payload }),
    deleteOffer: deleteOffer.mutateAsync,
  };
}

/** Hook para ofertas vigentes no cardápio público */
export function useActiveOffers(restaurantSlug: string | null) {
  return useQuery({
    queryKey: ['active-offers', restaurantSlug],
    queryFn: () => fetchActiveOffersBySlug(restaurantSlug),
    enabled: !!restaurantSlug,
    staleTime: 60 * 1000,
  });
}
