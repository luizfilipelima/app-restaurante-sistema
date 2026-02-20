import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Coordenadas de pedidos para mapa de calor */
export interface OrderCoordinate {
  lat: number;
  lng: number;
  intensity?: number;
}

/** Busca coordenadas de pedidos (delivery) do restaurante para heatmap */
async function fetchOrderCoordinates(
  restaurantId: string | null,
  startDate: Date,
  endDate: Date
): Promise<OrderCoordinate[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('latitude, longitude')
    .eq('restaurant_id', restaurantId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) throw error;
  return (data || [])
    .filter((o: { latitude: number; longitude: number }) => o.latitude && o.longitude)
    .map((o: { latitude: number; longitude: number }) => ({
      lat: o.latitude,
      lng: o.longitude,
      intensity: 1,
    }));
}

export function useOrderCoordinates(
  restaurantId: string | null,
  startDate: Date,
  endDate: Date,
  enabled = true
) {
  return useQuery({
    queryKey: ['order-coordinates', restaurantId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)],
    queryFn: () => fetchOrderCoordinates(restaurantId, startDate, endDate),
    enabled: !!restaurantId && enabled,
  });
}
