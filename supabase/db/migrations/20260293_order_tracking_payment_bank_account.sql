-- =============================================================================
-- Migration: Inclui payment_bank_account no order do get_order_tracking
-- O pedido guarda o snapshot dos dados bancários exibidos no checkout (pyg ou ars).
-- Assim o rastreamento mostra exatamente o que o cliente viu ao confirmar.
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
  v_restaurant_found BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
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
    o.payment_bank_account,
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

  SELECT
    r.id,
    r.name,
    r.slug,
    r.logo,
    r.whatsapp,
    r.phone,
    r.phone_country,
    r.pix_key,
    r.bank_account
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = v_order.restaurant_id;

  v_restaurant_found := FOUND;
  IF NOT v_restaurant_found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Restaurante não encontrado.');
  END IF;

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
      'payment_bank_account', v_order.payment_bank_account,
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
      'phone_country', v_restaurant.phone_country,
      'pix_key',      v_restaurant.pix_key,
      'bank_account', v_restaurant.bank_account
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
