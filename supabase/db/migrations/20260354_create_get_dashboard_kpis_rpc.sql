-- ============================================================
-- RPC: get_dashboard_kpis
-- Retorna apenas os 4 KPIs principais (rápido, confiável).
-- Usado para exibir métricas imediatamente enquanto o BI carrega.
-- Mesma lógica de filtro de get_dashboard_analytics.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_area_filter TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue NUMERIC := 0;
  v_total_orders BIGINT := 0;
  v_avg_ticket NUMERIC := 0;
  v_pending_orders BIGINT := 0;
BEGIN
  -- Single query para KPIs principais (exclui cancelados)
  SELECT
    COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0)::NUMERIC,
    COALESCE(COUNT(*) FILTER (WHERE o.status != 'cancelled'), 0)::BIGINT,
    CASE WHEN COUNT(*) FILTER (WHERE o.status != 'cancelled') > 0
      THEN COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0) / COUNT(*) FILTER (WHERE o.status != 'cancelled')
      ELSE 0 END::NUMERIC,
    COALESCE(COUNT(*) FILTER (WHERE o.status = 'pending'), 0)::BIGINT
  INTO v_total_revenue, v_total_orders, v_avg_ticket, v_pending_orders
  FROM orders o
  WHERE o.restaurant_id = p_tenant_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND o.order_source = 'table')
         OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'));

  RETURN jsonb_build_object(
    'total_faturado', COALESCE(v_total_revenue, 0),
    'total_pedidos', COALESCE(v_total_orders, 0)::INTEGER,
    'ticket_medio', COALESCE(v_avg_ticket, 0),
    'pedidos_pendentes', COALESCE(v_pending_orders, 0)::INTEGER
  );
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Retorna apenas os 4 KPIs do dashboard (total_faturado, total_pedidos, ticket_medio, pedidos_pendentes). Rápido para carregamento inicial.';

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;
