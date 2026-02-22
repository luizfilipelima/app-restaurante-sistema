-- =============================================================================
-- Migration: get_saas_metrics usa manual_monthly_revenue_brl quando definido
-- Data: 2026-02-22
--
-- Se o restaurante tem manual_monthly_revenue_brl, usa esse valor no MRR.
-- Caso contrário, usa o preço do plano (subscription_plans.price_brl).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_saas_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_mrr        NUMERIC(12, 2);
  v_total_tenants    BIGINT;
  v_new_tenants_7d   BIGINT;
  v_revenue_by_plan  JSONB;
BEGIN

  -- ── 1. MRR: COALESCE(manual, preço do plano) por restaurante assinante ─────
  SELECT COALESCE(SUM(COALESCE(r.manual_monthly_revenue_brl, sp.price_brl)), 0)
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

  -- ── 4. Receita e contagem por plano (usa manual quando definido) ───────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'plan_name',           sub.plan_name,
        'plan_label',          sub.plan_label,
        'tenant_count',        sub.cnt,
        'monthly_revenue_brl', ROUND(sub.revenue, 2)
      )
      ORDER BY sub.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_revenue_by_plan
    FROM (
      SELECT sp.name AS plan_name,
             sp.label AS plan_label,
             sp.sort_order,
             COUNT(r.id)::BIGINT AS cnt,
             COALESCE(SUM(COALESCE(r.manual_monthly_revenue_brl, sp.price_brl)), 0) AS revenue
        FROM subscription_plans sp
        LEFT JOIN restaurant_subscriptions rs ON rs.plan_id = sp.id
        LEFT JOIN restaurants r ON r.id = rs.restaurant_id
         AND r.deleted_at IS NULL
         AND r.is_active = TRUE
         AND rs.status IN ('active', 'trial')
       WHERE sp.is_active = TRUE
       GROUP BY sp.id, sp.name, sp.label, sp.sort_order
    ) sub;

  RETURN jsonb_build_object(
    'total_mrr',       v_total_mrr,
    'total_tenants',   v_total_tenants,
    'new_tenants_7d',  v_new_tenants_7d,
    'revenue_by_plan', v_revenue_by_plan
  );

END;
$$;

COMMENT ON FUNCTION public.get_saas_metrics IS
  'Retorna métricas financeiras do SaaS (MRR, tenants ativos, crescimento 7d, receita por plano). '
  'Usa manual_monthly_revenue_brl quando definido no restaurante, senão preço do plano.';
