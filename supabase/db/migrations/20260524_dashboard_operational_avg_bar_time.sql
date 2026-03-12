-- ============================================================
-- Adiciona avg_bar_time ao objeto operational de get_advanced_dashboard_stats
-- Tempo médio em minutos: accepted_at -> bar_ready_at para itens de bar
-- Depende de: 20260353, 20260515 (order_items.bar_ready_at)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_advanced_dashboard_stats(
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
  v_base JSONB;
  v_operational JSONB;
  v_financial JSONB;
  v_retention_risk JSONB;
  v_menu_matrix JSONB;
  v_total_sales NUMERIC;
  v_total_cost NUMERIC;
  v_total_orders_all BIGINT;
  v_cancelled_orders BIGINT;
  v_avg_sales NUMERIC;
  v_avg_margin NUMERIC;
BEGIN
  v_base := get_dashboard_analytics(p_tenant_id, p_start_date, p_end_date, p_area_filter);

  -- ========== OPERATIONAL ==========
  SELECT jsonb_build_object(
    'avg_prep_time', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (ready_at - accepted_at)) / 60.0)::NUMERIC(10,2)
      FROM orders
      WHERE restaurant_id = p_tenant_id
        AND accepted_at IS NOT NULL AND ready_at IS NOT NULL
        AND created_at >= p_start_date AND created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND order_source = 'table')
             OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
    ), 0),
    'avg_delivery_time', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - ready_at)) / 60.0)::NUMERIC(10,2)
      FROM orders
      WHERE restaurant_id = p_tenant_id
        AND ready_at IS NOT NULL AND delivered_at IS NOT NULL
        AND created_at >= p_start_date AND created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND order_source = 'table')
             OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
    ), 0),
    'avg_bar_time', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (oi.bar_ready_at - o.accepted_at)) / 60.0)::NUMERIC(10,2)
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.restaurant_id = p_tenant_id
        AND o.accepted_at IS NOT NULL AND oi.bar_ready_at IS NOT NULL
        AND COALESCE(p.print_destination, (SELECT c.print_destination FROM categories c WHERE c.name = p.category AND c.restaurant_id = o.restaurant_id LIMIT 1), 'kitchen') = 'bar'
        AND o.created_at >= p_start_date AND o.created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND o.order_source = 'table')
             OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
    ), 0),
    'idleness_heatmap', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('hour', h.hour, 'count', COALESCE(hm.cnt, 0))
        ORDER BY h.hour
      )
      FROM (SELECT generate_series(0, 23) AS hour) h
      LEFT JOIN (
        SELECT EXTRACT(HOUR FROM created_at)::INTEGER AS hour, COUNT(*)::INTEGER AS cnt
        FROM orders
        WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY EXTRACT(HOUR FROM created_at)
      ) hm ON hm.hour = h.hour
    ), '[]'::jsonb)
  ) INTO v_operational;

  -- ========== FINANCIAL ==========
  SELECT
    COALESCE(SUM(o.total), 0),
    COALESCE(SUM(
      (SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, p.price_cost, 0)), 0)
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = o.id)
    ), 0)
  INTO v_total_sales, v_total_cost
  FROM orders o
  WHERE o.restaurant_id = p_tenant_id
    AND o.status != 'cancelled'
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND o.order_source = 'table')
         OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'));

  SELECT COUNT(*)::BIGINT, (SELECT COUNT(*)::BIGINT FROM orders WHERE restaurant_id = p_tenant_id AND status = 'cancelled' AND created_at >= p_start_date AND created_at <= p_end_date)
  INTO v_total_orders_all, v_cancelled_orders
  FROM orders
  WHERE restaurant_id = p_tenant_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  v_total_orders_all := v_total_orders_all + v_cancelled_orders;

  SELECT jsonb_build_object(
    'gross_profit', COALESCE(v_total_sales, 0) - COALESCE(v_total_cost, 0),
    'cancel_rate', CASE WHEN v_total_orders_all > 0 THEN ROUND((v_cancelled_orders::NUMERIC / v_total_orders_all) * 100, 2) ELSE 0 END,
    'avg_ticket_by_channel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('channel', channel, 'avg_ticket', avg_ticket) ORDER BY avg_ticket DESC)
      FROM (
        SELECT
          COALESCE(order_source, delivery_type::TEXT, 'outros') AS channel,
          ROUND(AVG(total)::NUMERIC, 2) AS avg_ticket
        FROM orders
        WHERE restaurant_id = p_tenant_id
          AND status != 'cancelled'
          AND created_at >= p_start_date
          AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY COALESCE(order_source, delivery_type::TEXT, 'outros')
      ) t
    ), '[]'::jsonb)
  ) INTO v_financial;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_retention_risk
  FROM (
    SELECT
      COALESCE(customer_name, customer_phone, '') AS nome,
      COALESCE(customer_phone, '') AS telefone,
      SUM(total)::NUMERIC(12,2) AS total_gasto
    FROM orders
    WHERE restaurant_id = p_tenant_id
      AND status != 'cancelled'
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND (p_area_filter = 'all' OR p_area_filter IS NULL
           OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
           OR (p_area_filter = 'table' AND order_source = 'table')
           OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
           OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
      AND (customer_phone IS NOT NULL OR customer_name IS NOT NULL)
    GROUP BY customer_name, customer_phone
    ORDER BY total_gasto DESC
    LIMIT 20
  ) t;

  SELECT
    AVG(qty)::NUMERIC(10,2),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY margin)::NUMERIC(10,2)
  INTO v_avg_sales, v_avg_margin
  FROM (
    SELECT
      SUM(oi.quantity) AS qty,
      CASE WHEN SUM(oi.quantity * COALESCE(p.price_cost, p.cost_price, 0)) > 0
           THEN (SUM(oi.quantity * oi.unit_price) - SUM(oi.quantity * COALESCE(p.price_cost, p.cost_price, 0))) / SUM(oi.quantity * oi.unit_price) * 100
           ELSE 0 END AS margin
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.restaurant_id = p_tenant_id
      AND o.status != 'cancelled'
      AND o.created_at >= p_start_date
      AND o.created_at <= p_end_date
      AND (p_area_filter = 'all' OR p_area_filter IS NULL
           OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
           OR (p_area_filter = 'table' AND o.order_source = 'table')
           OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
           OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
    GROUP BY p.name
  ) sub;

  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name, 'total_sold', total_sold, 'avg_margin', avg_margin) ORDER BY total_sold DESC)
      FROM (
        SELECT
          p.name,
          SUM(oi.quantity)::INTEGER AS total_sold,
          ROUND(CASE WHEN SUM(oi.quantity * oi.unit_price) > 0
                     THEN (SUM(oi.quantity * oi.unit_price) - SUM(oi.quantity * COALESCE(pp.price_cost, pp.cost_price, 0))) / SUM(oi.quantity * oi.unit_price) * 100
                     ELSE 0 END, 2)::NUMERIC(10,2) AS avg_margin
        FROM order_items oi
        JOIN orders oo ON oo.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN products pp ON pp.id = oi.product_id
        WHERE oo.restaurant_id = p_tenant_id
          AND oo.status != 'cancelled'
          AND oo.created_at >= p_start_date
          AND oo.created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (oo.order_source = 'delivery' OR (oo.order_source IS NULL AND oo.delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND oo.order_source = 'table')
               OR (p_area_filter = 'pickup' AND (oo.order_source = 'pickup' OR (oo.order_source IS NULL AND oo.delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND oo.order_source = 'buffet'))
        GROUP BY p.name
      ) t2
    ), '[]'::jsonb),
    'avg_sales_cut', COALESCE(v_avg_sales, 0),
    'avg_margin_cut', COALESCE(v_avg_margin, 0)
  ) INTO v_menu_matrix;

  RETURN v_base || jsonb_build_object(
    'operational', v_operational,
    'financial', v_financial,
    'retention_risk', v_retention_risk,
    'menu_matrix', v_menu_matrix
  );
END;
$$;

COMMENT ON FUNCTION public.get_advanced_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Dashboard avançado: dados de get_dashboard_analytics + operational (tempos prep/entrega/bar, heatmap ociosidade), financial, retention_risk, menu_matrix.';
