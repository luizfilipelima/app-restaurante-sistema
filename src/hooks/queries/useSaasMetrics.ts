/**
 * Hook para consumir a RPC get_saas_metrics() do Supabase.
 * Retorna métricas financeiras consolidadas do SaaS para o painel Super Admin.
 *
 * A função SQL usa SECURITY DEFINER e é idempotente.
 * Recomendado: chamar apenas em páginas com role = 'super_admin'.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Tipos de retorno da RPC ──────────────────────────────────────────────────

export interface RevenuePlanItem {
  plan_name:           string;   // 'core' | 'standard' | 'enterprise'
  plan_label:          string;   // 'Core' | 'Standard' | 'Enterprise'
  tenant_count:        number;
  monthly_revenue_brl: number;
}

export interface SaasMetrics {
  total_mrr:       number;           // MRR total em BRL
  total_tenants:   number;           // Total de restaurantes ativos (deleted_at IS NULL)
  new_tenants_7d:  number;           // Novos nos últimos 7 dias
  revenue_by_plan: RevenuePlanItem[]; // Distribuição por plano
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const saasMetricsKey = () => ['saas-metrics'] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSaasMetrics() {
  return useQuery<SaasMetrics>({
    queryKey: saasMetricsKey(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_saas_metrics');
      if (error) throw error;
      return data as SaasMetrics;
    },
    // 5 min — métricas financeiras não mudam segundo a segundo
    staleTime: 1000 * 60 * 5,
    gcTime:    1000 * 60 * 15,
    // Mantém os dados anteriores visíveis enquanto refetch ocorre em background,
    // evitando que o layout pisque ou fique em branco ao invalidar a query.
    placeholderData: keepPreviousData,
  });
}
