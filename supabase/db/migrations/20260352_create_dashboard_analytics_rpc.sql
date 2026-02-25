-- ============================================================
-- RPC: get_dashboard_analytics
-- Agrega métricas de BI no banco para performance extrema
-- Multi-tenant: filtra sempre por p_tenant_id (restaurant_id)
-- ============================================================

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
  -- Filtro de área (opcional): delivery, table, pickup, buffet, all
  -- 1. KPIs: Total Faturado, Total Pedidos, Ticket Médio
  -- Exclui pedidos cancelados
  SELECT
    COALESCE(SUM(total), 0)::NUMERIC,
    COALESCE(COUNT(*), 0)::BIGINT,
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total), 0) / COUNT(*) ELSE 0 END
  INTO v_total_revenue, v_total_orders, v_avg_ticket
  FROM orders
  WHERE restaurant_id = p_tenant_id
    AND status != 'cancelled'
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND order_source = 'table')
         OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND order_source = 'buffet'));

  SELECT COUNT(*)::BIGINT INTO v_pending_orders
  FROM orders
  WHERE restaurant_id = p_tenant_id
    AND status = 'pending'
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND (p_area_filter = 'all' OR p_area_filter IS NULL
         OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
         OR (p_area_filter = 'table' AND order_source = 'table')
         OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
         OR (p_area_filter = 'buffet' AND order_source = 'buffet'));

  -- 2. Retention: Clientes Novos (1ª compra no período) vs Recorrentes (já compraram antes)
  -- Usa customer_phone como identificador do cliente
  -- 3. Channels: vendas agrupadas por order_source
  -- 4. sales_trend: vendas diárias no período
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_faturado', COALESCE(v_total_revenue, 0),
      'total_pedidos', COALESCE(v_total_orders, 0)::INTEGER,
      'ticket_medio', COALESCE(v_avg_ticket, 0),
      'pedidos_pendentes', COALESCE(v_pending_orders, 0)::INTEGER
    ),
    'retention', COALESCE((
      WITH orders_in_period AS (
        SELECT
          id,
          COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name) AS client_key,
          total,
          created_at
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
      ),
      first_order_per_client AS (
        SELECT
          COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name) AS client_key,
          MIN(created_at) AS first_order_at
        FROM orders
        WHERE restaurant_id = p_tenant_id
          AND status != 'cancelled'
        GROUP BY COALESCE(NULLIF(TRIM(customer_phone), ''), customer_name)
      ),
      clients_in_period AS (
        SELECT DISTINCT o.client_key, f.first_order_at
        FROM orders_in_period o
        JOIN first_order_per_client f ON o.client_key = f.client_key
      )
      SELECT jsonb_build_object(
        'clientes_novos', (SELECT COUNT(*)::INTEGER FROM clients_in_period WHERE first_order_at >= p_start_date AND first_order_at <= p_end_date),
        'clientes_recorrentes', (SELECT COUNT(*)::INTEGER FROM clients_in_period WHERE first_order_at < p_start_date)
      )
    ), '{"clientes_novos":0,"clientes_recorrentes":0}'::jsonb),
    'channels', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'channel', COALESCE(source, 'outros'),
          'total_vendas', total_vendas,
          'total_pedidos', total_pedidos
        ) ORDER BY total_vendas DESC
      )
      FROM (
        SELECT
          COALESCE(order_source, delivery_type::TEXT, 'outros') AS source,
          COALESCE(SUM(total), 0)::NUMERIC AS total_vendas,
          COUNT(*)::INTEGER AS total_pedidos
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
        GROUP BY COALESCE(order_source, delivery_type::TEXT)
      ) ch
    ), '[]'::jsonb),
    'sales_trend', COALESCE((
      WITH date_series AS (
        SELECT generate_series(
          date_trunc('day', p_start_date)::DATE,
          date_trunc('day', p_end_date)::DATE,
          '1 day'::INTERVAL
        )::DATE AS day
      ),
      daily_sales AS (
        SELECT
          (created_at AT TIME ZONE 'UTC')::DATE AS day,
          COALESCE(SUM(total), 0)::NUMERIC AS revenue,
          COUNT(*)::INTEGER AS orders_count
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
        GROUP BY (created_at AT TIME ZONE 'UTC')::DATE
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'revenue', COALESCE(s.revenue, 0),
          'orders', COALESCE(s.orders_count, 0)
        ) ORDER BY d.day
      )
      FROM date_series d
      LEFT JOIN daily_sales s ON d.day = s.day
    ), '[]'::jsonb),
    'payment_methods', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', method, 'value', total) ORDER BY total DESC)
      FROM (
        SELECT payment_method AS method, COALESCE(SUM(total), 0)::NUMERIC AS total
        FROM orders
        WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY payment_method
      ) pm
    ), '[]'::jsonb),
    'top_zone', (
      SELECT jsonb_build_object('name', dz.location_name, 'count', cnt)
      FROM (
        SELECT delivery_zone_id, COUNT(*)::INTEGER AS cnt
        FROM orders
        WHERE restaurant_id = p_tenant_id AND status != 'cancelled'
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND delivery_zone_id IS NOT NULL
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (order_source = 'delivery' OR (order_source IS NULL AND delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND order_source = 'table')
               OR (p_area_filter = 'pickup' AND (order_source = 'pickup' OR (order_source IS NULL AND delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND order_source = 'buffet'))
        GROUP BY delivery_zone_id
        ORDER BY cnt DESC
        LIMIT 1
      ) tz
      JOIN delivery_zones dz ON dz.id = tz.delivery_zone_id
    ),
    'peak_hours', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', hour, 'count', cnt) ORDER BY cnt DESC)
      FROM (
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
        ORDER BY cnt DESC
        LIMIT 5
      ) ph
    ), '[]'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', qty))
      FROM (
        SELECT oi.product_name AS name, SUM(oi.quantity)::INTEGER AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled'
          AND o.created_at >= p_start_date AND o.created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND o.order_source = 'table')
               OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
        GROUP BY oi.product_name
        ORDER BY qty DESC
        LIMIT 5
      ) tp
    ), '[]'::jsonb),
    'bottom_products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', qty))
      FROM (
        SELECT oi.product_name AS name, SUM(oi.quantity)::INTEGER AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = p_tenant_id AND o.status != 'cancelled'
          AND o.created_at >= p_start_date AND o.created_at <= p_end_date
          AND (p_area_filter = 'all' OR p_area_filter IS NULL
               OR (p_area_filter = 'delivery' AND (o.order_source = 'delivery' OR (o.order_source IS NULL AND o.delivery_type = 'delivery')))
               OR (p_area_filter = 'table' AND o.order_source = 'table')
               OR (p_area_filter = 'pickup' AND (o.order_source = 'pickup' OR (o.order_source IS NULL AND o.delivery_type = 'pickup')))
               OR (p_area_filter = 'buffet' AND o.order_source = 'buffet'))
        GROUP BY oi.product_name
        ORDER BY qty ASC
        LIMIT 5
      ) bp
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Retorna métricas agregadas de BI para o dashboard: KPIs, retenção (novos vs recorrentes), canais de venda e tendência diária. Filtra por tenant (restaurant_id).';

-- Permite que usuários autenticados chamem a RPC (o frontend passa o restaurant_id do contexto)
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;
