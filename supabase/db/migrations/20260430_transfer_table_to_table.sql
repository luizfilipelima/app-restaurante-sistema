-- =============================================================================
-- Migration: RPC transfer_table_to_table
-- Data: 2026-04-30
--
-- Transfere todos os pedidos e dados de uma mesa para outra.
-- Usado por garçom, administrador, proprietário e super admin.
-- Atualiza: orders, reservations, virtual_comandas, table_comanda_links, waiter_calls.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transfer_table_to_table(
  p_restaurant_id   UUID,
  p_source_table_id UUID,
  p_target_table_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_num INT;
  v_target_num INT;
  v_comanda_ids UUID[];
  v_orders_updated INT := 0;
  v_reservations_updated INT := 0;
  v_links_updated INT := 0;
  v_calls_updated INT := 0;
  v_row_count INT;
BEGIN
  IF p_source_table_id = p_target_table_id THEN
    RAISE EXCEPTION 'A mesa de origem e destino devem ser diferentes.' USING ERRCODE = 'P0001';
  END IF;

  SELECT number INTO v_source_num FROM tables
  WHERE id = p_source_table_id AND restaurant_id = p_restaurant_id AND is_active = TRUE;
  IF v_source_num IS NULL THEN
    RAISE EXCEPTION 'Mesa de origem não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  SELECT number INTO v_target_num FROM tables
  WHERE id = p_target_table_id AND restaurant_id = p_restaurant_id AND is_active = TRUE;
  IF v_target_num IS NULL THEN
    RAISE EXCEPTION 'Mesa de destino não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Reservas: mover para mesa destino
  UPDATE reservations
     SET table_id = p_target_table_id, updated_at = NOW()
   WHERE table_id = p_source_table_id
     AND status IN ('pending', 'confirmed', 'activated');

  GET DIAGNOSTICS v_reservations_updated = ROW_COUNT;

  -- 3. virtual_comandas: atualizar table_number (reservas + comandas com orders na mesa origem)
  UPDATE virtual_comandas vc
     SET table_number = v_target_num::TEXT, updated_at = NOW()
   WHERE vc.restaurant_id = p_restaurant_id
     AND (
       vc.id IN (
         SELECT r.virtual_comanda_id FROM reservations r
         WHERE r.table_id = p_target_table_id AND r.virtual_comanda_id IS NOT NULL
       )
       OR vc.id IN (
         SELECT o.virtual_comanda_id FROM orders o
         WHERE o.table_id = p_source_table_id AND o.virtual_comanda_id IS NOT NULL AND o.status <> 'cancelled'
       )
     );

  -- 4. Orders: por table_id direto
  UPDATE orders
     SET table_id = p_target_table_id, updated_at = NOW()
   WHERE restaurant_id = p_restaurant_id
     AND table_id = p_source_table_id
     AND status <> 'cancelled';

  GET DIAGNOSTICS v_orders_updated = ROW_COUNT;

  -- 4. Orders: por virtual_comanda (reservas já movidas)
  SELECT ARRAY_AGG(r.virtual_comanda_id) INTO v_comanda_ids
  FROM reservations r
  WHERE r.table_id = p_target_table_id
    AND r.virtual_comanda_id IS NOT NULL;

  IF v_comanda_ids IS NOT NULL AND array_length(v_comanda_ids, 1) > 0 THEN
    UPDATE orders
       SET table_id = p_target_table_id, updated_at = NOW()
     WHERE restaurant_id = p_restaurant_id
       AND virtual_comanda_id = ANY(v_comanda_ids)
       AND (table_id = p_source_table_id OR table_id IS NULL)
       AND status <> 'cancelled';
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_orders_updated := v_orders_updated + v_row_count;
  END IF;

  -- 5. table_comanda_links
  SELECT COUNT(*)::INT INTO v_links_updated
  FROM table_comanda_links
  WHERE table_id = p_source_table_id AND restaurant_id = p_restaurant_id;

  UPDATE table_comanda_links
     SET table_id = p_target_table_id, created_at = NOW()
   WHERE table_id = p_source_table_id AND restaurant_id = p_restaurant_id;

  -- 6. waiter_calls
  SELECT COUNT(*)::INT INTO v_calls_updated
  FROM waiter_calls
  WHERE table_id = p_source_table_id AND restaurant_id = p_restaurant_id;

  UPDATE waiter_calls
     SET table_id = p_target_table_id
   WHERE table_id = p_source_table_id AND restaurant_id = p_restaurant_id;

  -- 7. Limpar current_customer_name da mesa de origem
  UPDATE tables
     SET current_customer_name = NULL, updated_at = NOW()
   WHERE id = p_source_table_id;

  RETURN jsonb_build_object(
    'success', true,
    'source_table_id', p_source_table_id,
    'target_table_id', p_target_table_id,
    'source_number', v_source_num,
    'target_number', v_target_num,
    'orders_moved', v_orders_updated,
    'reservations_moved', v_reservations_updated,
    'comanda_links_moved', v_links_updated,
    'waiter_calls_moved', v_calls_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_table_to_table(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.transfer_table_to_table IS
  'Transfere todos os pedidos e dados de uma mesa para outra. Atualiza orders, reservations, virtual_comandas, table_comanda_links e waiter_calls.';
