/**
 * useAdminProducts — Busca produtos do restaurante para o admin (mesas, buffet, etc.)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

async function fetchAdminProducts(restaurantId: string | null): Promise<Product[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('order_index', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export function useAdminProducts(restaurantId: string | null) {
  return useQuery({
    queryKey: ['adminProducts', restaurantId],
    queryFn: () => fetchAdminProducts(restaurantId),
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}
