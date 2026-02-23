-- ============================================================
-- Corrige erros 400 nas RPCs get_dashboard_analytics e get_advanced_dashboard_stats
-- Garante que as funções existem, têm os GRANT corretos e força o PostgREST
-- a recarregar o schema (evita PGRST202 / schema cache desatualizado)
-- ============================================================

-- 1. Garantir colunas BI (caso add_bi_columns.sql não tenha rodado)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. Recriar get_dashboard_analytics (base do dashboard BI)
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
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
  v_result JSONB;
  v_total_revenue NUMERIC := 0;
  v_total_orders BIGINT := 0;
  v_avg_ticket NUMERIC := 0;
  v_pending_orders BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(total), 0)::NUMERIC, COALESCE(COUNT(*), 0)::BIGINT,
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total), 0) / COUNT(*) ELSE 0 END
  INTO v_total_revenue, v_total_orders, v_avg_ticket
  FROM orders
  WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
    AND created_at >= p_start_date AND created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND order_source = 'table')
         OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND order_source = 'buffet'));

  SELECT COUNT(*)::BIGINT INTO v_pending_orders FROM orders
  WHERE restaurant_id = p_tenant_id AND status = 'pending'
    AND created_at >= p_start_date AND created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND order_source = 'table')
         OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND order_source = 'buffet'));

  SELECT jsonb_build_object(
    'kpis', jsonb_build_object('total_faturado', COALESCE(v_total_revenue, 0), 'total_pedidos', COALESCE(v_total_orders, 0)::INTEGER,
      'ticket_medio', COALESCE(v_avg_ticket, 0), 'pedidos_pendentes', COALESCE(v_pending_orders, 0)::INTEGER),
    'retention', COALESCE((
      WITH orders_in_period AS (
        SELECT id, COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name) AS client_key, total, created_at
        FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet')),
      first_order_per_client AS (
        SELECT COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name) AS client_key, MIN(created_at) AS first_order_at
        FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
        GROUP BY COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name)),
      clients_in_period AS (
        SELECT DISTINCT o.client_key, f.first_order_at FROM orders_in_period o
        JOIN first_order_per_client f ON o.client_key = f.client_key)
      SELECT jsonb_build_object(
        'clientes_novos', (SELECT COUNT(*)::INTEGER FROM clients_in_period WHERE first_order_at >= p_start_date AND first_order_at <= p_end_date),
        'clientes_recorrentes', (SELECT COUNT(*)::INTEGER FROM clients_in_period WHERE first_order_at < p_start_date))
    ), '{"clientes_novos":0,"clientes_recorrentes":0}'::jsonb),
    'channels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('channel', COALESCE(source, 'outros'), 'total_vendas', total_vendas, 'total_pedidos', total_pedidos) ORDER BY total_vendas DESC)
      FROM (SELECT COALESCE(order_source, delivery_type::TEXT, 'outros') AS source, COALESCE(SUM(total), 0)::NUMERIC AS total_vendas, COUNT(*)::INTEGER AS total_pedidos
        FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY COALESCE(order_source, delivery_type::TEXT)) ch
    ), '[]'::jsonb),
    'sales_trend', COALESCE((
      WITH date_series AS (SELECT generate_series(date_trunc('day', p_start_date)::DATE, date_trunc('day', p_end_date)::DATE, '1 day'::INTERVAL)::DATE AS day),
      daily_sales AS (
        SELECT (created_at AT TIME ZONE 'UTC')::DATE AS day, COALESCE(SUM(total), 0)::NUMERIC AS revenue, COUNT(*)::INTEGER AS orders_count
        FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY (created_at AT TIME ZONE 'UTC')::DATE)
      SELECT jsonb_agg(jsonb_build_object('date', to_char(d.day, 'YYYY-MM-DD'), 'revenue', COALESCE(s.revenue, 0), 'orders', COALESCE(s.orders_count, 0)) ORDER BY d.day)
      FROM date_series d LEFT JOIN daily_sales s ON d.day = s.day
    ), '[]'::jsonb),
    'payment_methods', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', method, 'value', total) ORDER BY total DESC)
      FROM (SELECT payment_method AS method, COALESCE(SUM(total), 0)::NUMERIC AS total
        FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY payment_method) pm
    ), '[]'::jsonb),
    'top_zone', (SELECT jsonb_build_object('name', dz.location_name, 'count', cnt)
      FROM (SELECT delivery_zone_id, COUNT(*)::INTEGER AS cnt FROM orders
        WHERE restaurant_id = p_tenant_id AND status != 'cancelled' AND created_at >= p_start_date AND created_at <= p_end_date
          AND delivery_zone_id IS NOT NULL
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY delivery_zone_id ORDER BY cnt DESC LIMIT 1) tz
      JOIN delivery_zones dz ON dz.id = tz.delivery_zone_id),
    'peak_hours', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', hour, 'count', cnt) ORDER BY cnt DESC)
      FROM (SELECT EXTRACT(HOUR FROM created_at)::INTEGER AS hour, COUNT(*)::INTEGER AS cnt FROM orders
        WHERE restaurant_id = p_tenant_id AND status != 'cancelled' AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY cnt DESC LIMIT 5) ph
    ), '[]'::jsonb),
    'top_products', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', qty)) FROM (
      SELECT oi.product_name AS name, SUM(oi.quantity)::INTEGER AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled' AND o.created_at >= p_start_date AND o.created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND o.order_source = 'table')
             OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
      GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5) tp), '[]'::jsonb),
    'bottom_products', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', qty)) FROM (
      SELECT oi.product_name AS name, SUM(oi.quantity)::INTEGER AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled' AND o.created_at >= p_start_date AND o.created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND o.order_source = 'table')
             OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
      GROUP BY oi.product_name ORDER BY qty ASC LIMIT 5) bp), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;

-- 3. Recriar get_advanced_dashboard_stats (depende de get_dashboard_analytics)
-- Usa versão simplificada se product_ingredients/ingredients não existirem
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

  SELECT jsonb_build_object(
    'avg_prep_time', COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (ready_at - accepted_at)) / 60.0)::NUMERIC(10,2) FROM orders
      WHERE restaurant_id = p_tenant_id AND accepted_at IS NOT NULL AND ready_at IS NOT NULL
        AND created_at >= p_start_date AND created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND order_source = 'table')
             OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND order_source = 'buffet')), 0),
    'avg_delivery_time', COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - ready_at)) / 60.0)::NUMERIC(10,2) FROM orders
      WHERE restaurant_id = p_tenant_id AND ready_at IS NOT NULL AND delivered_at IS NOT NULL
        AND created_at >= p_start_date AND created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND order_source = 'table')
             OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND order_source = 'buffet')), 0),
    'idleness_heatmap', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', h.hour, 'count', COALESCE(hm.cnt, 0)) ORDER BY h.hour)
      FROM (SELECT generate_series(0, 23) AS hour) h
      LEFT JOIN (SELECT EXTRACT(HOUR FROM created_at)::INTEGER AS hour, COUNT(*)::INTEGER AS cnt FROM orders
        WHERE restaurant_id = p_tenant_id AND status != 'cancelled' AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY EXTRACT(HOUR FROM created_at)) hm ON hm.hour = h.hour
    ), '[]'::jsonb)
  ) INTO v_operational;

  SELECT COALESCE(SUM(o.total), 0) INTO v_total_sales FROM orders o
  WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled'
    AND o.created_at >= p_start_date AND o.created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND o.order_source = 'table')
         OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'));

  SELECT COALESCE(SUM((SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, p.price_cost, 0)), 0)
    FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id)), 0)
  INTO v_total_cost FROM orders o
  WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled'
    AND o.created_at >= p_start_date AND o.created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND o.order_source = 'table')
         OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'));

  SELECT COUNT(*)::BIGINT, (SELECT COUNT(*)::BIGINT FROM orders WHERE restaurant_id = p_tenant_id AND status = 'cancelled' AND created_at >= p_start_date AND created_at <= p_end_date)
  INTO v_total_orders_all, v_cancelled_orders FROM orders
  WHERE restaurant_id = p_tenant_id AND created_at >= p_start_date AND created_at <= p_end_date;
  v_total_orders_all := v_total_orders_all + v_cancelled_orders;

  SELECT jsonb_build_object(
    'gross_profit', COALESCE(v_total_sales, 0) - COALESCE(v_total_cost, 0),
    'total_cost', COALESCE(v_total_cost, 0),
    'cost_by_ingredients', 0,
    'cancel_rate', CASE WHEN v_total_orders_all > 0 THEN ROUND((v_cancelled_orders::NUMERIC / v_total_orders_all) * 100, 2) ELSE 0 END,
    'avg_ticket_by_channel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('channel', channel, 'avg_ticket', avg_ticket) ORDER BY avg_ticket DESC)
      FROM (SELECT COALESCE(order_source, delivery_type::TEXT, 'outros') AS channel, (SUM(total) / NULLIF(COUNT(*), 0))::NUMERIC(10,2) AS avg_ticket
        FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY COALESCE(order_source, delivery_type::TEXT)) ch
    ), '[]'::jsonb)
  ) INTO v_financial;

  SELECT COALESCE((SELECT jsonb_agg(row) FROM (
    SELECT jsonb_build_object('nome', customer_name, 'telefone', customer_phone, 'total_gasto', total_gasto) AS row
    FROM (SELECT MAX(customer_name) AS customer_name, MAX(customer_phone) AS customer_phone, SUM(total)::NUMERIC(12,2) AS total_gasto
      FROM orders WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
      GROUP BY COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name)
      HAVING MAX(created_at) < (NOW() - INTERVAL '30 days')) churn
    ORDER BY total_gasto DESC LIMIT 20) sub), '[]'::jsonb) INTO v_retention_risk;

  WITH product_stats AS (
    SELECT COALESCE(p.name, oi.product_name) AS name, SUM(oi.quantity)::INTEGER AS total_sold,
      AVG(oi.unit_price - COALESCE(p.cost_price, p.price_cost, 0))::NUMERIC(10,2) AS avg_margin
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled'
      AND o.created_at >= p_start_date AND o.created_at <= p_end_date
      AND (p_area_filter = 'all' OR p_area_filter IS NULL
           OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
           OR (p_area_filter = 'table' AND o.order_source = 'table')
           OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
           OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
    GROUP BY COALESCE(p.id, oi.product_id), COALESCE(p.name, oi.product_name)
  ), globals AS (SELECT AVG(total_sold)::NUMERIC(10,2) AS avg_sales, AVG(avg_margin)::NUMERIC(10,2) AS avg_margin_global FROM product_stats)
  SELECT (SELECT avg_sales FROM globals), (SELECT avg_margin_global FROM globals) INTO v_avg_sales, v_avg_margin;

  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'total_sold', total_sold, 'avg_margin', COALESCE(avg_margin, 0))) FROM (
      SELECT COALESCE(p.name, oi.product_name) AS name, SUM(oi.quantity)::INTEGER AS total_sold,
        AVG(oi.unit_price - COALESCE(p.cost_price, p.price_cost, 0))::NUMERIC(10,2) AS avg_margin
      FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled'
        AND o.created_at >= p_start_date AND o.created_at <= p_end_date
        AND (p_area_filter = 'all' OR p_area_filter IS NULL
             OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
             OR (p_area_filter = 'table' AND o.order_source = 'table')
             OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
             OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
      GROUP BY COALESCE(p.id, oi.product_id), COALESCE(p.name, oi.product_name)) ps), '[]'::jsonb),
    'avg_sales_cut', COALESCE(v_avg_sales, 0),
    'avg_margin_cut', COALESCE(v_avg_margin, 0)
  ) INTO v_menu_matrix;

  RETURN v_base || jsonb_build_object('operational', v_operational, 'financial', v_financial, 'retention_risk', v_retention_risk, 'menu_matrix', v_menu_matrix);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_advanced_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advanced_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;

-- 4. Recarrega o schema do PostgREST (evita PGRST202 / 400 por cache desatualizado)
NOTIFY pgrst, 'reload schema';
