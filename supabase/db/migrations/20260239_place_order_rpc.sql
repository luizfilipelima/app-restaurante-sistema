-- =============================================================================
-- Migration: RPC place_order — cria order + order_items como SECURITY DEFINER
-- Data: 2026-02-19
-- =============================================================================
--
-- Resolve definitivamente o erro "new row violates row-level security policy
-- for table orders" que ocorre quando clientes anônimos (cardápio público)
-- tentam fazer pedidos via delivery, retirada ou mesa.
--
-- Estratégia: função SECURITY DEFINER roda com permissões do owner (postgres),
-- bypassando RLS completamente. Assim, nenhuma política de INSERT em orders ou
-- order_items bloqueia clientes anônimos.
--
-- Execute no Supabase SQL Editor (uma única vez).
-- =============================================================================

DROP FUNCTION IF EXISTS public.place_order(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.place_order(
  p_order   jsonb,   -- dados do pedido (ver campos abaixo)
  p_items   jsonb    -- array de itens [{product_id, product_name, quantity, unit_price, total_price, ...}]
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
  -- 1. Validar restaurante
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

  -- 2. Inserir order (SECURITY DEFINER bypassa RLS)
  INSERT INTO public.orders (
    restaurant_id,
    customer_name,
    customer_phone,
    delivery_type,
    delivery_zone_id,
    delivery_address,
    delivery_fee,
    subtotal,
    total,
    payment_method,
    payment_change_for,
    order_source,
    table_id,
    status,
    notes,
    is_paid
  )
  VALUES (
    (p_order->>'restaurant_id')::uuid,
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'delivery_type',
    NULLIF(p_order->>'delivery_zone_id', '')::uuid,
    NULLIF(p_order->>'delivery_address', ''),
    COALESCE((p_order->>'delivery_fee')::numeric, 0),
    (p_order->>'subtotal')::numeric,
    (p_order->>'total')::numeric,
    p_order->>'payment_method',
    NULLIF(p_order->>'payment_change_for', '')::numeric,
    COALESCE(p_order->>'order_source', 'delivery'),
    NULLIF(p_order->>'table_id', '')::uuid,
    COALESCE(p_order->>'status', 'pending'),
    NULLIF(p_order->>'notes', ''),
    COALESCE((p_order->>'is_paid')::boolean, false)
  )
  RETURNING id INTO v_order_id;

  -- 3. Inserir order_items
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
    pizza_edge
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
    NULLIF(item->>'pizza_edge', '')
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object(
    'ok',       true,
    'order_id', v_order_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'error',   SQLERRM,
      'code',    SQLSTATE
    );
END;
$$;

-- Permitir que anon e authenticated chamem a função
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb) TO authenticated;
