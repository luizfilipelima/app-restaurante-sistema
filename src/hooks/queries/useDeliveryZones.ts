import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DeliveryZone } from '@/types';

/** Busca zonas de entrega do restaurante. Isolamento por tenant via restaurant_id. */
async function fetchDeliveryZones(restaurantId: string | null): Promise<DeliveryZone[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('id, restaurant_id, location_name, fee, is_active, center_lat, center_lng, radius_meters, created_at')
    .eq('restaurant_id', restaurantId)
    .order('location_name', { ascending: true });
  if (error) throw error;
  return (data || []) as DeliveryZone[];
}

/** Hook para zonas de entrega. Usado em AdminDeliveryZones e formulários de pedido. */
export function useDeliveryZones(restaurantId: string | null) {
  return useQuery({
    queryKey: ['deliveryZones', restaurantId],
    queryFn: () => fetchDeliveryZones(restaurantId),
    enabled: !!restaurantId,
  });
}
