import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Courier, CourierStatus } from '@/types';

export function useCouriers(restaurantId: string | null) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCouriers = useCallback(async () => {
    if (!restaurantId) {
      setCouriers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('couriers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true });
      if (err) throw err;
      setCouriers((data as Courier[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Erro ao carregar entregadores'));
      setCouriers([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchCouriers();
  }, [fetchCouriers]);

  const createCourier = useCallback(
    async (payload: { name: string; phone?: string; status?: CourierStatus; vehicle_plate?: string }) => {
      if (!restaurantId) throw new Error('Restaurante não definido');
      const { data, error: err } = await supabase
        .from('couriers')
        .insert({
          restaurant_id: restaurantId,
          name: payload.name,
          phone: payload.phone || null,
          status: payload.status || 'offline',
          vehicle_plate: payload.vehicle_plate || null,
          active: true,
        })
        .select()
        .single();
      if (err) throw err;
      await fetchCouriers();
      return data as Courier;
    },
    [restaurantId, fetchCouriers]
  );

  const updateCourier = useCallback(
    async (id: string, payload: Partial<Pick<Courier, 'name' | 'phone' | 'status' | 'vehicle_plate' | 'active'>>) => {
      const { error: err } = await supabase.from('couriers').update(payload).eq('id', id);
      if (err) throw err;
      await fetchCouriers();
    },
    [fetchCouriers]
  );

  const deleteCourier = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.from('couriers').delete().eq('id', id);
      if (err) throw err;
      await fetchCouriers();
    },
    [fetchCouriers]
  );

  return {
    couriers,
    loading,
    error,
    refetch: fetchCouriers,
    createCourier,
    updateCourier,
    deleteCourier,
  };
}
