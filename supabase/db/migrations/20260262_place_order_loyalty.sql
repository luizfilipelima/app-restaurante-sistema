-- =============================================================================
-- Migration: place_order — adiciona suporte a loyalty_redeemed
-- Garante que o flag de resgate de fidelidade seja persistido ao criar pedido.
-- Colunas loyalty_redeemed e loyalty_points_credited já existem (20260254).
-- =============================================================================

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
    order_source,
    table_id,
    status,
    notes,
    is_paid,
    loyalty_redeemed
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
    COALESCE(p_order->>'order_source', 'delivery'),
    NULLIF(p_order->>'table_id', '')::uuid,
    COALESCE(p_order->>'status', 'pending'),
    NULLIF(p_order->>'notes', ''),
    COALESCE((p_order->>'is_paid')::boolean, false),
    COALESCE((p_order->>'loyalty_redeemed')::boolean, false)
  )
  RETURNING id INTO v_order_id;

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
    is_upsell
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
    COALESCE((item->>'is_upsell')::boolean, false)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb) TO authenticated;
