import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DashboardAnalyticsResponse } from '@/types/dashboard-analytics';

export interface UseDashboardAnalyticsParams {
  tenantId: string | null;
  startDate: Date;
  endDate: Date;
  /** Filtro de área: all, delivery, table, pickup, buffet */
  areaFilter?: string;
  /** Se false, não executa a query (ex: período anterior quando period=max) */
  enabled?: boolean;
}

/** Busca métricas agregadas de BI via RPC. Cálculos feitos no banco para performance. */
async function fetchDashboardAnalytics({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
}: UseDashboardAnalyticsParams): Promise<DashboardAnalyticsResponse> {
  if (!tenantId) {
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
  const { data, error } = await supabase.rpc('get_dashboard_analytics', {
    p_tenant_id: tenantId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_area_filter: areaFilter,
  });
  if (error) throw error;
  return data as DashboardAnalyticsResponse;
}

/** Hook para métricas do dashboard (RPC). Cache com chave por tenant e período. */
export function useDashboardAnalytics({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
  enabled = true,
}: UseDashboardAnalyticsParams) {
  const startKey = startDate.toISOString().slice(0, 10);
  const endKey = endDate.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['dashboard-analytics', tenantId, startKey, endKey, areaFilter],
    queryFn: () => fetchDashboardAnalytics({ tenantId, startDate, endDate, areaFilter }),
    enabled: !!tenantId && enabled,
  });
}
