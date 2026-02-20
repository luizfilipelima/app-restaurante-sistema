import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Courier, CourierStatus } from '@/types';

/** Busca entregadores do restaurante. Isolamento por tenant via restaurant_id. */
async function fetchCouriers(restaurantId: string | null): Promise<Courier[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('couriers')
    .select('id, restaurant_id, name, phone, phone_country, status, vehicle_plate, active, created_at, updated_at')
    .eq('restaurant_id', restaurantId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as Courier[];
}

/** Hook de leitura: lista de entregadores com cache. */
export function useCouriers(restaurantId: string | null) {
  const query = useQuery({
    queryKey: ['couriers', restaurantId],
    queryFn: () => fetchCouriers(restaurantId),
    enabled: !!restaurantId,
  });

  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['couriers', restaurantId] });

  const createCourier = useMutation({
    mutationFn: async (payload: {
      name: string;
      phone?: string;
      phone_country?: 'BR' | 'PY' | 'AR' | null;
      status?: CourierStatus;
      vehicle_plate?: string;
    }) => {
      if (!restaurantId) throw new Error('Restaurante não definido');
      const { data, error } = await supabase
        .from('couriers')
        .insert({
          restaurant_id: restaurantId,
          name: payload.name,
          phone: payload.phone || null,
          phone_country: payload.phone_country || 'BR',
          status: payload.status || 'offline',
          vehicle_plate: payload.vehicle_plate || null,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Courier;
    },
    onSuccess: invalidate,
  });

  const updateCourier = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Pick<Courier, 'name' | 'phone' | 'phone_country' | 'status' | 'vehicle_plate' | 'active'>>;
    }) => {
      const { error } = await supabase.from('couriers').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteCourier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('couriers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    couriers: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createCourier: createCourier.mutateAsync,
    updateCourier: (id: string, payload: Parameters<typeof updateCourier.mutateAsync>[0]['payload']) =>
      updateCourier.mutateAsync({ id, payload }),
    deleteCourier: deleteCourier.mutateAsync,
  };
}
