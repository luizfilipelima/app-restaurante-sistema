/**
 * Hook para a página /super-admin/restaurants.
 * Carrega restaurantes + métricas (ordens, faturamento) em 2 round-trips paralelos.
 * Usa React Query para cache, placeholderData e fluidez semelhante ao Dashboard BI.
 */

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/types';

export interface SuperAdminRestaurantsData {
  restaurants: Restaurant[];
  ordersByRestaurant: Record<string, number>;
  metrics: {
    totalRestaurants: number;
    activeRestaurants: number;
    totalRevenue: number;
    totalOrders: number;
  };
}

export const superAdminRestaurantsKey = () => ['super-admin-restaurants'] as const;

export async function fetchSuperAdminRestaurants(): Promise<SuperAdminRestaurantsData> {
  const [restaurantsRes, ordersRes] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('orders')
      .select('restaurant_id, total'),
  ]);

  if (restaurantsRes.error) throw restaurantsRes.error;
  if (ordersRes.error) throw ordersRes.error;

  const list = (restaurantsRes.data || []) as Restaurant[];
  const orders = ordersRes.data || [];

  const countByRestaurant: Record<string, number> = {};
  let totalRevenue = 0;
  let totalOrders = 0;

  for (const o of orders as { restaurant_id: string; total?: number }[]) {
    countByRestaurant[o.restaurant_id] = (countByRestaurant[o.restaurant_id] || 0) + 1;
    totalOrders += 1;
    totalRevenue += o.total ?? 0;
  }

  return {
    restaurants: list,
    ordersByRestaurant: countByRestaurant,
    metrics: {
      totalRestaurants: list.length,
      activeRestaurants: list.filter((r) => r.is_active).length,
      totalRevenue,
      totalOrders,
    },
  };
}

export function useSuperAdminRestaurants() {
  return useQuery<SuperAdminRestaurantsData>({
    queryKey: superAdminRestaurantsKey(),
    queryFn: fetchSuperAdminRestaurants,
    staleTime: 60 * 1000,
    gcTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
}

export function useInvalidateSuperAdminRestaurants() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: superAdminRestaurantsKey() });
}
