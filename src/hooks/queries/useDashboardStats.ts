import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import type { DashboardAdvancedStatsResponse } from '@/types/dashboard-analytics';
import { computeDashboardAdvancedStatsFallback } from '@/lib/dashboard/dashboard-fallback';
import { isUUID } from '@/hooks/admin/useResolveRestaurantId';

export interface UseDashboardStatsParams {
  tenantId: string | null;
  startDate: Date;
  endDate: Date;
  /** Filtro de área: all, delivery, table, pickup, buffet */
  areaFilter?: string;
  /** Se false, não executa a query */
  enabled?: boolean;
}

/** Busca métricas avançadas via RPC (operational, financial, retention_risk, menu_matrix). */
async function fetchDashboardStats({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
}: UseDashboardStatsParams): Promise<DashboardAdvancedStatsResponse> {
  if (!tenantId || !isUUID(tenantId)) {
    return {
      kpis: { total_faturado: 0, total_pedidos: 0, ticket_medio: 0, pedidos_pendentes: 0 },
      retention: { clientes_novos: 0, clientes_recorrentes: 0 },
      channels: [],
      sales_trend: [],
      payment_methods: [],
      top_zone: null,
      peak_hours: [],
      top_products: [],
      bottom_products: [],
    };
  }
  try {
    const { data, error } = await supabase.rpc('get_advanced_dashboard_stats', {
      p_tenant_id: tenantId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_area_filter: areaFilter,
    });

    if (!error && data) {
      const typedData = data as DashboardAdvancedStatsResponse;
      const hasAdvancedSections =
        !!typedData.operational &&
        !!typedData.financial &&
        Array.isArray(typedData.retention_risk) &&
        !!typedData.menu_matrix;

      if (hasAdvancedSections) return typedData;
    }
  } catch {
    // fallback abaixo
  }

  return computeDashboardAdvancedStatsFallback({
    tenantId,
    startDate,
    endDate,
    areaFilter,
  });
}

/** Hook para métricas avançadas do dashboard (RPC). Inclui operational e financial. */
export function useDashboardStats({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
  enabled = true,
}: UseDashboardStatsParams) {
  const startKey = startDate.toISOString().slice(0, 10);
  const endKey = endDate.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['dashboard-stats', tenantId, startKey, endKey, areaFilter],
    queryFn: () => fetchDashboardStats({ tenantId, startDate, endDate, areaFilter }),
    enabled: !!tenantId && isUUID(tenantId) && enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Atualiza a cada 1 min com dashboard aberto
  });
}
