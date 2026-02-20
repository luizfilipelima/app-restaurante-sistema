import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProductOffer, Product } from '@/types';

/** Ofertas ativas/agendadas do restaurante (admin) */
async function fetchOffers(restaurantId: string | null): Promise<ProductOffer[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('product_offers')
    .select(`
      id, restaurant_id, product_id, offer_price, original_price, starts_at, ends_at,
      label, repeat_days, is_active, sort_order, created_at, updated_at,
      product:products(id, name, price, price_sale, image_url, category, is_active)
    `)
    .eq('restaurant_id', restaurantId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, product: row.product as Product }));
}

const DOW_TO_DAY: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

/** Ofertas vigentes para o cardápio público (one-time ou recorrentes) */
async function fetchActiveOffersForMenu(restaurantId: string | null): Promise<Array<ProductOffer & { product: Product }>> {
  if (!restaurantId) return [];
  const now = new Date();
  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from('product_offers')
    .select(`
      id, restaurant_id, product_id, offer_price, original_price, starts_at, ends_at,
      label, repeat_days, is_active, sort_order,
      product:products(*)
    `)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .gte('ends_at', nowIso);
  if (error) throw error;
  const rows = (data ?? []).map((row: any) => ({ ...row, product: row.product as Product }));
  return rows.filter((offer: ProductOffer & { product: Product }) => {
    const start = new Date(offer.starts_at);
    const end = new Date(offer.ends_at);
    const repeatDays = offer.repeat_days as string[] | null | undefined;
    if (repeatDays && repeatDays.length > 0) {
      const today = now.getDay();
      const todayKey = DOW_TO_DAY[today];
      if (!todayKey || !(repeatDays as readonly string[]).includes(todayKey)) return false;
      const todayStr = now.toISOString().slice(0, 10);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      if (todayStr < startStr || todayStr > endStr) return false;
      const t = now.getHours() * 60 + now.getMinutes();
      const tStart = start.getHours() * 60 + start.getMinutes();
      const tEnd = end.getHours() * 60 + end.getMinutes();
      return t >= tStart && t <= tEnd;
    }
    return start <= now && now <= end;
  }).sort((a: ProductOffer, b: ProductOffer) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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
      repeat_days?: string[] | null;
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

/** Hook para ofertas vigentes no cardápio público (por slug — faz 2 requests: slug→id→offers) */
export function useActiveOffers(restaurantSlug: string | null) {
  return useQuery({
    queryKey: ['active-offers', restaurantSlug],
    queryFn: () => fetchActiveOffersBySlug(restaurantSlug),
    enabled: !!restaurantSlug,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook para ofertas vigentes usando o restaurant_id diretamente.
 * Preferir este quando o restaurant_id já estiver disponível (ex: do menuData)
 * para evitar a query extra de buscar o restaurante pelo slug.
 */
export function useActiveOffersByRestaurantId(restaurantId: string | null | undefined) {
  return useQuery({
    queryKey: ['active-offers-by-id', restaurantId],
    queryFn: () => fetchActiveOffersForMenu(restaurantId ?? null),
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}
