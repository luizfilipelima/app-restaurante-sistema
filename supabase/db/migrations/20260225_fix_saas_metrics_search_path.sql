-- =============================================================================
-- MIGRATION: fix search_path na função get_saas_metrics
-- Data: 2026-02-25
-- =============================================================================
--
-- Motivo: O Supabase emite alertas de segurança quando funções SECURITY DEFINER
-- não definem explicitamente o SET search_path = public.
-- Sem isso, o search_path pode ser alterado por um atacante para redefinir
-- nomes de objetos e executar código arbitrário.
--
-- Referência: https://supabase.com/docs/guides/database/database-advisors
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_saas_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public          -- ← Corrige o alerta de segurança do Supabase
AS $$
DECLARE
  v_total_mrr        NUMERIC(12, 2);
  v_total_tenants    BIGINT;
  v_new_tenants_7d   BIGINT;
  v_revenue_by_plan  JSONB;
BEGIN

  -- ── 1. MRR (Monthly Recurring Revenue) ────────────────────────────────────
  SELECT COALESCE(SUM(sp.price_brl), 0)
    INTO v_total_mrr
    FROM restaurant_subscriptions rs
    JOIN subscription_plans sp ON sp.id = rs.plan_id
    JOIN restaurants         r  ON r.id  = rs.restaurant_id
   WHERE r.deleted_at IS NULL
     AND r.is_active   = TRUE
     AND rs.status    IN ('active', 'trial');

  -- ── 2. Total de tenants ativos ─────────────────────────────────────────────
  SELECT COUNT(*)
    INTO v_total_tenants
    FROM restaurants
   WHERE deleted_at IS NULL;

  -- ── 3. Novos tenants nos últimos 7 dias ───────────────────────────────────
  SELECT COUNT(*)
    INTO v_new_tenants_7d
    FROM restaurants
   WHERE deleted_at IS NULL
     AND created_at >= (NOW() - INTERVAL '7 days');

  -- ── 4. Receita e contagem por plano ───────────────────────────────────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'plan_name',           sp.name,
        'plan_label',          sp.label,
        'tenant_count',        COALESCE(stats.cnt, 0),
        'monthly_revenue_brl', ROUND(COALESCE(stats.cnt, 0) * sp.price_brl, 2)
      )
      ORDER BY sp.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_revenue_by_plan
    FROM subscription_plans sp
    LEFT JOIN (
      SELECT rs.plan_id,
             COUNT(*) AS cnt
        FROM restaurant_subscriptions rs
        JOIN restaurants r ON r.id = rs.restaurant_id
       WHERE r.deleted_at IS NULL
         AND r.is_active   = TRUE
         AND rs.status    IN ('active', 'trial')
       GROUP BY rs.plan_id
    ) stats ON stats.plan_id = sp.id
   WHERE sp.is_active = TRUE;

  -- ── Retorno ────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'total_mrr',       v_total_mrr,
    'total_tenants',   v_total_tenants,
    'new_tenants_7d',  v_new_tenants_7d,
    'revenue_by_plan', v_revenue_by_plan
  );

END;
$$;

COMMENT ON FUNCTION public.get_saas_metrics IS
  'Retorna métricas financeiras do SaaS (MRR, tenants ativos, crescimento 7d, '
  'receita por plano). Deve ser chamada apenas por usuários super_admin. '
  'search_path fixado para evitar alerta de segurança do Supabase Advisor.';

-- Mantém as permissões idênticas à migration original
REVOKE ALL ON FUNCTION public.get_saas_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_metrics() TO authenticated;
