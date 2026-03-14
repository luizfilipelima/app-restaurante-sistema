-- =============================================================================
-- Migration: KDS — Pedidos no local vão direto para fila de preparo
-- Data: 2026-06-16
--
-- Objetivo: Pedidos feitos no local (mesas, buffet, comandas) são confirmados no momento
-- do pedido. No KDS da cozinha e do bar, não precisam de confirmação adicional:
-- vão automaticamente para "Em preparo" em vez de "Aguardando".
--
-- Afeta: place_order (mesa, buffet via WaiterPDV/Checkout) e sync_virtual_comanda_to_order.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- place_order: se order_source IN ('table', 'comanda', 'buffet') → status='preparing', accepted_at=now()
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.place_order(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.place_order(
  p_order   jsonb,
  p_items   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id   uuid;
  v_restaurant restaurants%ROWTYPE;
  v_order_src  text;
  v_status     text;
  v_accepted_at timestamptz;
BEGIN
  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = (p_order->>'restaurant_id')::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurante não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_restaurant.is_active THEN
    RAISE EXCEPTION 'Restaurante está inativo.' USING ERRCODE = 'P0001';
  END IF;

  IF v_restaurant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restaurante não disponível.' USING ERRCODE = 'P0001';
  END IF;

  v_order_src := COALESCE(p_order->>'order_source', 'delivery');

  -- Pedidos no local (mesa, buffet, comanda) vão direto para fila de preparo
  IF v_order_src IN ('table', 'comanda', 'buffet') THEN
    v_status     := 'preparing';
    v_accepted_at := now();
  ELSE
    v_status     := COALESCE(p_order->>'status', 'pending');
    v_accepted_at := NULL;
  END IF;

  INSERT INTO public.orders (
    restaurant_id,
    customer_name,
    customer_phone,
    delivery_type,
    delivery_zone_id,
    delivery_address,
    latitude,
    longitude,
    address_details,
    delivery_fee,
    subtotal,
    total,
    payment_method,
    payment_change_for,
    payment_pix_key,
    payment_bank_account,
    order_source,
    table_id,
    status,
    accepted_at,
    notes,
    is_paid,
    loyalty_redeemed,
    customer_language,
    discount_coupon_id,
    discount_amount
  )
  VALUES (
    (p_order->>'restaurant_id')::uuid,
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'delivery_type',
    NULLIF(p_order->>'delivery_zone_id', '')::uuid,
    NULLIF(p_order->>'delivery_address', ''),
    NULLIF(TRIM(p_order->>'latitude'), '')::double precision,
    NULLIF(TRIM(p_order->>'longitude'), '')::double precision,
    NULLIF(p_order->>'address_details', ''),
    COALESCE((p_order->>'delivery_fee')::numeric, 0),
    (p_order->>'subtotal')::numeric,
    (p_order->>'total')::numeric,
    p_order->>'payment_method',
    NULLIF(p_order->>'payment_change_for', '')::numeric,
    NULLIF(TRIM(p_order->>'payment_pix_key'), ''),
    CASE WHEN p_order->'payment_bank_account' IS NOT NULL AND p_order->'payment_bank_account' != 'null'::jsonb
      THEN p_order->'payment_bank_account' ELSE NULL END,
    v_order_src,
    NULLIF(p_order->>'table_id', '')::uuid,
    v_status,
    v_accepted_at,
    NULLIF(p_order->>'notes', ''),
    COALESCE((p_order->>'is_paid')::boolean, false),
    COALESCE((p_order->>'loyalty_redeemed')::boolean, false),
    CASE WHEN p_order->>'customer_language' IN ('pt', 'es') THEN p_order->>'customer_language' ELSE NULL END,
    NULLIF(p_order->>'discount_coupon_id', '')::uuid,
    COALESCE((p_order->>'discount_amount')::numeric, 0)
  )
  RETURNING id INTO v_order_id;

  IF (p_order->>'discount_coupon_id') IS NOT NULL AND TRIM(p_order->>'discount_coupon_id') != '' THEN
    UPDATE discount_coupons
    SET use_count = use_count + 1
    WHERE id = NULLIF(TRIM(p_order->>'discount_coupon_id'), '')::uuid;
  END IF;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    total_price,
    observations,
    pizza_size,
    pizza_flavors,
    pizza_dough,
    pizza_edge,
    is_upsell,
    addons
  )
  SELECT
    v_order_id,
    NULLIF(item->>'product_id', '')::uuid,
    item->>'product_name',
    (item->>'quantity')::numeric,
    (item->>'unit_price')::numeric,
    (item->>'total_price')::numeric,
    NULLIF(item->>'observations', ''),
    NULLIF(item->>'pizza_size', ''),
    CASE
      WHEN item->'pizza_flavors' IS NOT NULL AND jsonb_typeof(item->'pizza_flavors') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(item->'pizza_flavors'))
      ELSE NULL
    END,
    NULLIF(item->>'pizza_dough', ''),
    NULLIF(item->>'pizza_edge', ''),
    COALESCE((item->>'is_upsell')::boolean, false),
    CASE
      WHEN item->'addons' IS NOT NULL AND jsonb_typeof(item->'addons') = 'array'
      THEN item->'addons'
      ELSE NULL
    END
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- sync_virtual_comanda_to_order: comanda = pedido no local → status='preparing', accepted_at=now()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_virtual_comanda_to_order(
  p_comanda_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda      virtual_comandas%ROWTYPE;
  v_order_id     UUID;
  v_items_count  INTEGER;
  v_total_int    INTEGER;
BEGIN
  SELECT * INTO v_comanda
    FROM virtual_comandas
   WHERE id = p_comanda_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', p_comanda_id USING ERRCODE = 'P0002';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'Comanda % está % e não pode receber novos pedidos.',
      p_comanda_id, v_comanda.status
      USING ERRCODE = 'P0001';
  END IF;

  v_total_int := CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG'
    THEN ROUND(v_comanda.total_amount)::INTEGER
    ELSE ROUND(v_comanda.total_amount * 100)::INTEGER END;

  SELECT id INTO v_order_id
    FROM orders
   WHERE virtual_comanda_id = p_comanda_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_order_id IS NULL THEN
    INSERT INTO orders (
      restaurant_id,
      customer_name,
      customer_phone,
      delivery_type,
      delivery_fee,
      subtotal,
      total,
      payment_method,
      order_source,
      status,
      accepted_at,
      notes,
      virtual_comanda_id
    )
    VALUES (
      v_comanda.restaurant_id,
      COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
      '',
      'pickup',
      0,
      v_total_int,
      v_total_int,
      'cash',
      'comanda',
      'preparing',
      now(),
      COALESCE(v_comanda.notes, '') || CASE WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> '' THEN ' | Mesa: ' || v_comanda.table_number ELSE '' END,
      v_comanda.id
    )
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE orders
       SET customer_name = COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
           total         = v_total_int,
           subtotal      = v_total_int,
           notes         = COALESCE(v_comanda.notes, '') || CASE WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> '' THEN ' | Mesa: ' || v_comanda.table_number ELSE '' END,
           order_source  = 'comanda',
           status        = 'preparing',
           accepted_at   = COALESCE(accepted_at, now()),
           updated_at    = NOW()
     WHERE id = v_order_id;
  END IF;

  DELETE FROM order_items WHERE order_id = v_order_id;

  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, observations)
  SELECT
    v_order_id,
    vci.product_id,
    vci.product_name,
    vci.quantity,
    CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG' THEN ROUND(vci.unit_price)::INTEGER ELSE ROUND(vci.unit_price * 100)::INTEGER END,
    CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG' THEN ROUND(vci.total_price)::INTEGER ELSE ROUND(vci.total_price * 100)::INTEGER END,
    vci.notes
  FROM virtual_comanda_items vci
  WHERE vci.comanda_id = p_comanda_id;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'comanda_id', p_comanda_id,
    'items_count', v_items_count,
    'total_amount', v_comanda.total_amount
  );
END;
$$;

COMMENT ON FUNCTION sync_virtual_comanda_to_order(UUID) IS
  'Cria/atualiza pedido (orders) com base nos itens da comanda digital. Pedidos de comanda vão direto para fila de preparo no KDS.';

GRANT EXECUTE ON FUNCTION sync_virtual_comanda_to_order(UUID) TO anon;
GRANT EXECUTE ON FUNCTION sync_virtual_comanda_to_order(UUID) TO authenticated;
