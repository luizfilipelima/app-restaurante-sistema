-- =============================================================================
-- Migration: update_reservation_table — alterar mesa vinculada à reserva
-- Data      : 2026-04-06
-- Depende de: 20260320_reservations_and_waiting_queue.sql
--
-- Permite ao garçom e staff alterar a mesa de uma reserva ativa (pending,
-- confirmed, activated). Atualiza: reservations.table_id, virtual_comandas.
-- table_number, orders.table_id — garante consistência em toda a aplicação.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_reservation_table(
  p_reservation_id UUID,
  p_table_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row         reservations%ROWTYPE;
  v_table_num   TEXT;
  v_restaurant_id UUID;
BEGIN
  SELECT * INTO v_row FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status NOT IN ('pending', 'confirmed', 'activated') THEN
    RAISE EXCEPTION 'Só é possível alterar a mesa de reservas pendentes, confirmadas ou ativadas.' USING ERRCODE = 'P0001';
  END IF;

  -- Nova mesa deve existir, estar ativa e pertencer ao mesmo restaurante
  SELECT t.number::TEXT, t.restaurant_id INTO v_table_num, v_restaurant_id
    FROM tables t
   WHERE t.id = p_table_id
     AND t.is_active = TRUE
     AND t.restaurant_id = v_row.restaurant_id;

  IF v_table_num IS NULL THEN
    RAISE EXCEPTION 'Mesa não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  -- Atualiza reserva
  UPDATE reservations SET table_id = p_table_id, updated_at = NOW() WHERE id = p_reservation_id;

  -- Atualiza virtual_comanda.table_number (exibição em caixa, cardápio, etc.)
  UPDATE virtual_comandas SET table_number = v_table_num, updated_at = NOW() WHERE id = v_row.virtual_comanda_id;

  -- Atualiza orders vinculados à comanda da reserva (pedidos já feitos)
  UPDATE orders SET table_id = p_table_id, updated_at = NOW() WHERE virtual_comanda_id = v_row.virtual_comanda_id;

  RETURN jsonb_build_object(
    'reservation_id', p_reservation_id,
    'table_id',       p_table_id,
    'table_number',   v_table_num,
    'status',         'updated'
  );
END;
$$;

COMMENT ON FUNCTION update_reservation_table(UUID, UUID) IS
  'Altera a mesa vinculada a uma reserva ativa. Atualiza reserva, virtual_comanda e orders para manter consistência.';

GRANT EXECUTE ON FUNCTION update_reservation_table(UUID, UUID) TO authenticated;
