/**
 * useReservations — Lista e gerencia reservas do restaurante
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ReservationStatus = 'pending' | 'confirmed' | 'activated' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  restaurant_id: string;
  virtual_comanda_id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string | null;
  scheduled_at: string;
  late_tolerance_minutes: number;
  notes: string | null;
  status: ReservationStatus;
  activated_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  virtual_comandas?: { short_code: string };
  tables?: { number: number; hall_zone_id: string | null };
  hall_zones?: { name: string };
}

export interface ReservationWithDetails extends Reservation {
  short_code: string;
  table_number: number;
  zone_name?: string;
}

async function fetchReservations(restaurantId: string | null): Promise<ReservationWithDetails[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      virtual_comandas(short_code),
      tables(number, hall_zone_id)
    `)
    .eq('restaurant_id', restaurantId)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as any[];
  return rows.map((r) => {
    const vc = r.virtual_comandas;
    const t = r.tables;
    return {
      ...r,
      short_code: vc?.short_code ?? '',
      table_number: t?.number ?? 0,
      zone_name: undefined as string | undefined,
    };
  });
}

export function useReservations(restaurantId: string | null, filters?: { status?: ReservationStatus[]; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['reservations', restaurantId, filters],
    queryFn: () => fetchReservations(restaurantId),
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
  });
}

export function useCreateReservation(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      table_id: string;
      customer_name: string;
      customer_phone?: string;
      scheduled_at: string;
      late_tolerance_minutes?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_reservation', {
        p_restaurant_id: restaurantId,
        p_table_id: params.table_id,
        p_customer_name: params.customer_name,
        p_customer_phone: params.customer_phone ?? null,
        p_scheduled_at: params.scheduled_at,
        p_late_tolerance_mins: params.late_tolerance_minutes ?? 15,
        p_notes: params.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}

export function useCancelReservation(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      const { data, error } = await supabase.rpc('cancel_reservation', { p_reservation_id: reservationId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}
