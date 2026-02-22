import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DiscountCoupon } from '@/types';

/** Busca cupons do restaurante (admin) */
async function fetchCoupons(restaurantId: string | null): Promise<DiscountCoupon[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('discount_coupons')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DiscountCoupon[];
}

/** Valida cupom por código e restaurante (checkout) */
export async function validateCoupon(
  restaurantId: string | null,
  code: string,
  subtotal: number
): Promise<{ valid: boolean; coupon?: DiscountCoupon; error?: string; discountAmount?: number }> {
  if (!restaurantId || !code?.trim()) {
    return { valid: false, error: 'Código inválido' };
  }
  const normalizedCode = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from('discount_coupons')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .ilike('code', normalizedCode)
    .maybeSingle();
  if (error) {
    return { valid: false, error: 'Erro ao validar cupom' };
  }
  const coupon = data as DiscountCoupon | null;
  if (!coupon) {
    return { valid: false, error: 'Cupom não encontrado' };
  }
  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, error: 'Cupom ainda não está válido' };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, error: 'Cupom expirado' };
  }
  if (coupon.max_uses != null && coupon.use_count >= coupon.max_uses) {
    return { valid: false, error: 'Cupom esgotado' };
  }
  let discountAmount = 0;
  if (coupon.discount_type === 'percent') {
    discountAmount = Math.round((subtotal * coupon.discount_value) / 100);
  } else {
    discountAmount = Math.min(coupon.discount_value, subtotal);
  }
  if (discountAmount <= 0) {
    return { valid: false, error: 'Cupom não aplicável a este pedido' };
  }
  return { valid: true, coupon, discountAmount };
}

export function useDiscountCoupons(restaurantId: string | null) {
  const query = useQuery({
    queryKey: ['discount-coupons', restaurantId],
    queryFn: () => fetchCoupons(restaurantId),
    enabled: !!restaurantId,
  });

  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discount-coupons', restaurantId] });

  const createCoupon = useMutation({
    mutationFn: async (payload: Omit<DiscountCoupon, 'id' | 'use_count' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('discount_coupons')
        .insert({
          restaurant_id: payload.restaurant_id,
          code: payload.code.trim().toUpperCase(),
          discount_type: payload.discount_type,
          discount_value: payload.discount_value,
          is_active: payload.is_active ?? true,
          max_uses: payload.max_uses ?? null,
          valid_from: payload.valid_from || null,
          valid_until: payload.valid_until || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DiscountCoupon;
    },
    onSuccess: () => invalidate(),
  });

  const updateCoupon = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<DiscountCoupon> & { id: string }) => {
      const update: Record<string, unknown> = {};
      if (payload.code !== undefined) update.code = payload.code.trim().toUpperCase();
      if (payload.discount_type !== undefined) update.discount_type = payload.discount_type;
      if (payload.discount_value !== undefined) update.discount_value = payload.discount_value;
      if (payload.is_active !== undefined) update.is_active = payload.is_active;
      if (payload.max_uses !== undefined) update.max_uses = payload.max_uses ?? null;
      if (payload.valid_from !== undefined) update.valid_from = payload.valid_from || null;
      if (payload.valid_until !== undefined) update.valid_until = payload.valid_until || null;
      const { data, error } = await supabase
        .from('discount_coupons')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DiscountCoupon;
    },
    onSuccess: () => invalidate(),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discount_coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return {
    coupons: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
    createCoupon: createCoupon.mutateAsync,
    updateCoupon: (id: string, payload: Partial<DiscountCoupon>) =>
      updateCoupon.mutateAsync({ id, ...payload }),
    deleteCoupon: deleteCoupon.mutateAsync,
  };
}
