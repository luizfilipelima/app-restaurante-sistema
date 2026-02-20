import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LoyaltyProgram, LoyaltyStatus, LoyaltyPoints } from '@/types';

// ─── Fetch programa ───────────────────────────────────────────────────────────

async function fetchLoyaltyProgram(restaurantId: string | null): Promise<LoyaltyProgram | null> {
  if (!restaurantId) return null;
  const { data, error } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data as LoyaltyProgram | null;
}

export function useLoyaltyProgram(restaurantId: string | null) {
  return useQuery({
    queryKey: ['loyaltyProgram', restaurantId],
    queryFn: () => fetchLoyaltyProgram(restaurantId),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });
}

// ─── Salvar programa ──────────────────────────────────────────────────────────

async function saveLoyaltyProgram(program: LoyaltyProgram): Promise<void> {
  const { restaurant_id, enabled, orders_required, reward_description } = program;
  const { error } = await supabase
    .from('loyalty_programs')
    .upsert(
      { restaurant_id, enabled, orders_required, reward_description, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id' }
    );
  if (error) throw error;
}

export function useSaveLoyaltyProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveLoyaltyProgram,
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['loyaltyProgram', variables.restaurant_id] });
    },
  });
}

// ─── Pontos públicos (via RPC SECURITY DEFINER) ───────────────────────────────

export async function fetchLoyaltyStatus(
  restaurantId: string,
  phone: string
): Promise<LoyaltyStatus | null> {
  if (!restaurantId || !phone) return null;
  const { data, error } = await supabase.rpc('get_loyalty_points', {
    p_restaurant_id: restaurantId,
    p_phone: phone,
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as LoyaltyStatus;
  return row;
}

export function useLoyaltyStatus(restaurantId: string | null, phone: string | null) {
  return useQuery({
    queryKey: ['loyaltyStatus', restaurantId, phone],
    queryFn: () => fetchLoyaltyStatus(restaurantId!, phone!),
    enabled: !!restaurantId && !!phone && phone.replace(/\D/g, '').length >= 8,
    staleTime: 30_000,
  });
}

// ─── Métricas de fidelidade para o Dashboard ─────────────────────────────────

export interface LoyaltyMetrics {
  totalRedeemed: number;
  activeClients: number;
  topClients: Array<LoyaltyPoints & { name?: string }>;
}

async function fetchLoyaltyMetrics(restaurantId: string | null): Promise<LoyaltyMetrics> {
  if (!restaurantId) return { totalRedeemed: 0, activeClients: 0, topClients: [] };
  const { data, error } = await supabase
    .from('loyalty_points')
    .select('customer_phone, points, redeemed_count')
    .eq('restaurant_id', restaurantId)
    .order('points', { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as LoyaltyPoints[];
  const totalRedeemed = rows.reduce((s, r) => s + r.redeemed_count, 0);
  const activeClients = rows.filter((r) => r.points > 0 || r.redeemed_count > 0).length;
  return { totalRedeemed, activeClients, topClients: rows.slice(0, 10) };
}

export function useLoyaltyMetrics(restaurantId: string | null) {
  return useQuery({
    queryKey: ['loyaltyMetrics', restaurantId],
    queryFn: () => fetchLoyaltyMetrics(restaurantId),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

// ─── Creditar ponto ao concluir pedido ───────────────────────────────────────

export async function creditLoyaltyPoint(
  restaurantId: string,
  orderId: string,
  phone: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('credit_loyalty_point', {
    p_restaurant_id: restaurantId,
    p_order_id: orderId,
    p_phone: phone,
  });
  if (error) {
    console.error('Erro ao creditar fidelidade:', error.message);
    return false;
  }
  return !!data;
}

// ─── Resgatar prêmio ──────────────────────────────────────────────────────────

export async function redeemLoyalty(restaurantId: string, phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('redeem_loyalty', {
    p_restaurant_id: restaurantId,
    p_phone: phone,
  });
  if (error) {
    console.error('Erro ao resgatar fidelidade:', error.message);
    return false;
  }
  return !!data;
}
