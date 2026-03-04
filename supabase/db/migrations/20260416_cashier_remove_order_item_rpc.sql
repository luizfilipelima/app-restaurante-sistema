-- =============================================================================
-- Migration: Caixa/PDV — Remover item individual do pedido
-- Data: 2026-04-16
--
-- Permite que caixa, gerente, proprietário e super_admin removam um item de
-- um pedido de mesa (não pago). Recalcula subtotal/total do pedido.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cashier_remove_order_item(
  p_order_id      UUID,
  p_order_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_restaurant_id UUID;
  v_is_paid             BOOLEAN;
  v_order_source        TEXT;
  v_caller_id           UUID := auth.uid();
  v_caller_ok           BOOLEAN;
  v_new_subtotal        INTEGER;
  v_new_total           INTEGER;
  v_delivery_fee        INTEGER;
BEGIN
  -- 1. Carregar pedido e validar
  SELECT o.restaurant_id, o.is_paid, o.order_source, COALESCE(o.delivery_fee, 0)::INTEGER
  INTO v_order_restaurant_id, v_is_paid, v_order_source, v_delivery_fee
  FROM orders o
  WHERE o.id = p_order_id;

  IF v_order_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_is_paid THEN
    RAISE EXCEPTION 'Não é possível remover itens de pedido já pago.' USING ERRCODE = 'P0001';
  END IF;

  -- Apenas pedidos de mesa (fila do caixa)
  IF v_order_source IS DISTINCT FROM 'table' THEN
    RAISE EXCEPTION 'Remoção de item permitida apenas para pedidos de mesa.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Item pertence ao pedido
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE id = p_order_item_id AND order_id = p_order_id) THEN
    RAISE EXCEPTION 'Item não pertence a este pedido.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Caller: caixa, gerente, proprietário ou super_admin (mesmo critério de cancelar pedido no PDV)
  v_caller_ok := (SELECT current_user_can_admin_restaurant(v_order_restaurant_id))
    OR (
      (SELECT role FROM users WHERE id = v_caller_id) = 'cashier'
      AND (
        (SELECT restaurant_id FROM users WHERE id = v_caller_id) = v_order_restaurant_id
        OR EXISTS (
          SELECT 1 FROM restaurant_user_roles rur
          WHERE rur.user_id = v_caller_id
            AND rur.restaurant_id = v_order_restaurant_id
            AND rur.is_active = true
        )
      )
    );

  IF NOT COALESCE(v_caller_ok, false) THEN
    RAISE EXCEPTION 'Sem permissão para remover itens neste pedido.' USING ERRCODE = '42501';
  END IF;

  -- 4. Remover o item
  DELETE FROM order_items
  WHERE id = p_order_item_id AND order_id = p_order_id;

  -- 5. Recalcular subtotal e total do pedido (colunas são INTEGER)
  SELECT COALESCE(SUM(total_price), 0)::INTEGER INTO v_new_subtotal
  FROM order_items
  WHERE order_id = p_order_id;

  v_new_total := v_new_subtotal + v_delivery_fee;

  IF v_new_subtotal <= 0 THEN
    -- Sem itens: cancelar o pedido para sair da fila do caixa
    UPDATE orders
    SET status = 'cancelled', subtotal = 0, total = 0, updated_at = NOW()
    WHERE id = p_order_id;
  ELSE
    UPDATE orders
    SET subtotal = v_new_subtotal,
        total   = v_new_total,
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'order_item_id', p_order_item_id,
    'subtotal', v_new_subtotal,
    'total', v_new_total
  );
END;
$$;

COMMENT ON FUNCTION public.cashier_remove_order_item(UUID, UUID) IS
  'Remove um item de um pedido de mesa (não pago). Usado no Caixa/PDV. Recalcula subtotal e total.';

REVOKE ALL ON FUNCTION public.cashier_remove_order_item(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashier_remove_order_item(UUID, UUID) TO authenticated;
