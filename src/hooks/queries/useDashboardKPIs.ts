import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DashboardKPIs } from '@/types/dashboard-analytics';

export interface UseDashboardKPIsParams {
  tenantId: string | null;
  startDate: Date;
  endDate: Date;
  /** Filtro de área: all, delivery, table, pickup, buffet */
  areaFilter?: string;
  enabled?: boolean;
}

/** Busca apenas os 4 KPIs via RPC leve - resposta rápida para contagem correta. */
async function fetchDashboardKPIs({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
}: UseDashboardKPIsParams): Promise<DashboardKPIs> {
  if (!tenantId) {
    return { total_faturado: 0, total_pedidos: 0, ticket_medio: 0, pedidos_pendentes: 0 };
  }
  const { data, error } = await supabase.rpc('get_dashboard_kpis', {
    p_tenant_id: tenantId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_area_filter: areaFilter,
  });
  if (error) throw error;
  return data as DashboardKPIs;
}

/** Hook para KPIs do dashboard (RPC leve). Priorize este para exibir os 4 números principais. */
export function useDashboardKPIs({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
  enabled = true,
}: UseDashboardKPIsParams) {
  const startKey = startDate.toISOString().slice(0, 10);
  const endKey = endDate.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['dashboard-kpis', tenantId, startKey, endKey, areaFilter],
    queryFn: () => fetchDashboardKPIs({ tenantId, startDate, endDate, areaFilter }),
    enabled: !!tenantId && enabled,
    staleTime: 60 * 1000, // 1 min - KPIs podem ser recarregados menos
    retry: 1, // Se a RPC não existir (migração não aplicada), fallback usa useDashboardStats
    throwOnError: false, // Silencioso: fallback para useDashboardStats quando RPC não existe
  });
}
