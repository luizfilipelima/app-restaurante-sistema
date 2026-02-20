-- =============================================================================
-- Migration: Corrige "record v_courier is not assigned yet" em get_order_tracking
-- Data: 2026-02-20
--
-- Quando courier_id está preenchido mas o entregador foi deletado ou não existe,
-- o SELECT INTO v_courier não retorna linhas e v_courier fica não-atribuído.
-- O acesso a v_courier.id na montagem do JSON causa o erro.
-- Solução: usar variável booleana para só referenciar v_courier quando atribuído.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_order_tracking(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_courier RECORD;
  v_courier_found BOOLEAN := FALSE;
  v_restaurant RECORD;
  v_result JSONB;
BEGIN
  -- Busca o pedido
  SELECT
    o.id,
    o.restaurant_id,
    o.customer_name,
    o.status,
    o.delivery_type,
    o.delivery_address,
    o.address_details,
    o.notes,
    o.subtotal,
    o.delivery_fee,
    o.total,
    o.payment_method,
    o.order_source,
    o.courier_id,
    o.loyalty_redeemed,
    o.created_at,
    o.updated_at
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado.');
  END IF;

  -- Busca o restaurante (nome, logo, whatsapp, phone_country)
  SELECT
    r.id,
    r.name,
    r.slug,
    r.logo,
    r.whatsapp,
    r.phone,
    r.phone_country
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = v_order.restaurant_id;

  -- Busca entregador se houver (evita acessar v_courier quando não atribuído)
  IF v_order.courier_id IS NOT NULL THEN
    SELECT
      c.id,
      c.name,
      c.vehicle_plate
    INTO v_courier
    FROM public.couriers c
    WHERE c.id = v_order.courier_id;
    v_courier_found := FOUND;
  END IF;

  -- Monta o resultado
  v_result := jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id',             v_order.id,
      'restaurant_id',  v_order.restaurant_id,
      'customer_name',  v_order.customer_name,
      'status',         v_order.status,
      'delivery_type',  v_order.delivery_type,
      'delivery_address', v_order.delivery_address,
      'address_details',  v_order.address_details,
      'subtotal',       v_order.subtotal,
      'delivery_fee',   v_order.delivery_fee,
      'total',          v_order.total,
      'payment_method', v_order.payment_method,
      'order_source',   v_order.order_source,
      'loyalty_redeemed', v_order.loyalty_redeemed,
      'created_at',     v_order.created_at,
      'updated_at',     v_order.updated_at
    ),
    'restaurant', jsonb_build_object(
      'id',           v_restaurant.id,
      'name',         v_restaurant.name,
      'slug',         v_restaurant.slug,
      'logo',         v_restaurant.logo,
      'whatsapp',     v_restaurant.whatsapp,
      'phone',        v_restaurant.phone,
      'phone_country', v_restaurant.phone_country
    ),
    'courier', CASE
      WHEN v_courier_found THEN
        jsonb_build_object(
          'id',            v_courier.id,
          'name',          v_courier.name,
          'vehicle_plate', v_courier.vehicle_plate
        )
      ELSE NULL
    END
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
