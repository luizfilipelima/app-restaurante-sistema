/**
 * useCashierSessions — Abrir e fechar caixa diário
 *
 * Permite ao dono/gerente registrar valor inicial ao abrir e valor final ao fechar o caixa.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { format, startOfDay } from 'date-fns';

export interface CashierSession {
  id: string;
  restaurant_id: string;
  date: string;
  opening_amount: number;
  closing_amount: number | null;
  opened_at: string;
  closed_at: string | null;
  opened_by_user_id: string | null;
  closed_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const cashierSessionsKey = (restaurantId: string | null, date: Date) =>
  ['cashier-sessions', restaurantId, format(date, 'yyyy-MM-dd')] as const;

export function useCashierSession(restaurantId: string | null, date: Date) {
  const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
  return useQuery({
    queryKey: cashierSessionsKey(restaurantId, date),
    queryFn: async (): Promise<CashierSession | null> => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('cashier_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('date', dateStr)
        .maybeSingle();
      if (error) throw error;
      return data as CashierSession | null;
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
  });
}

export interface OpenCashierParams {
  restaurantId: string;
  openingAmount: number;
  date?: Date;
}

async function openCashier(params: OpenCashierParams): Promise<CashierSession> {
  const { restaurantId, openingAmount, date = new Date() } = params;
  const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('cashier_sessions')
    .upsert(
      {
        restaurant_id: restaurantId,
        date: dateStr,
        opening_amount: openingAmount,
        opened_at: new Date().toISOString(),
        opened_by_user_id: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'restaurant_id,date' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as CashierSession;
}

export function useOpenCashier(restaurantId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: openCashier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashier-sessions', restaurantId] });
      qc.invalidateQueries({ queryKey: ['cashier-sessions'] });
    },
  });
}

export interface CloseCashierParams {
  restaurantId: string;
  date: Date;
  closingAmount: number;
}

async function closeCashier(params: CloseCashierParams): Promise<CashierSession> {
  const { restaurantId, date, closingAmount } = params;
  const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('cashier_sessions')
    .update({
      closing_amount: closingAmount,
      closed_at: new Date().toISOString(),
      closed_by_user_id: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurant_id', restaurantId)
    .eq('date', dateStr)
    .select()
    .single();

  if (error) throw error;
  return data as CashierSession;
}

export function useCloseCashier(restaurantId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: closeCashier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashier-sessions', restaurantId] });
      qc.invalidateQueries({ queryKey: ['cashier-sessions'] });
      qc.invalidateQueries({ queryKey: ['cashier-daily-orders'] });
    },
  });
}
