-- =============================================================================
-- Migration: Resetar sinalização "mesa chamando" ao concluir mesa/comanda
-- Data: 2026-04-10
--
-- Ao finalizar o pagamento de uma mesa ou comanda, os waiter_calls pendentes
-- da mesa devem ser marcados como atendidos, removendo o status "Chamando"
-- das telas Mesas e Praças e Terminal do Garçom.
--
-- 1. complete_reservation — ao concluir reserva (comanda digital), limpa chamados da mesa
-- 2. complete_reservation_for_table — ao concluir mesa sem reserva, limpa chamados
-- 3. reset_table — ao resetar mesa, limpa chamados pendentes
-- =============================================================================

-- complete_reservation: marcar waiter_calls da mesa como atendidos
CREATE OR REPLACE FUNCTION complete_reservation(p_reservation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status IN ('cancelled', 'no_show', 'completed') THEN
    RAISE EXCEPTION 'Reserva já está % e não pode ser concluída.', v_row.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE reservations
     SET status = 'completed', updated_at = NOW()
   WHERE id = p_reservation_id;

  UPDATE virtual_comandas
     SET status        = 'paid',
         closed_at     = NOW(),
         updated_at    = NOW(),
         customer_name = NULL,
         notes         = NULL
   WHERE id = v_row.virtual_comanda_id
     AND status = 'open';

  -- Limpar nome do cliente na mesa (conta fechada)
  UPDATE tables
     SET current_customer_name = NULL,
         updated_at = NOW()
   WHERE id = v_row.table_id;

  -- Resetar sinalização "mesa chamando"
  UPDATE waiter_calls
     SET status = 'attended', attended_at = NOW()
   WHERE table_id = v_row.table_id
     AND status = 'pending';

  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'completed');
END;
$$;


-- complete_reservation_for_table: ao retornar "sem reserva", também limpar chamados da mesa
CREATE OR REPLACE FUNCTION complete_reservation_for_table(p_table_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
BEGIN
  -- Encontra reserva da mesa em qualquer status ativo (pendente, confirmada ou ativada)
  SELECT id INTO v_reservation_id
    FROM reservations
   WHERE table_id = p_table_id
     AND status IN ('pending', 'confirmed', 'activated')
   ORDER BY scheduled_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_reservation_id IS NULL THEN
    -- Sem reserva: ainda assim limpar chamados de garçom da mesa
    UPDATE waiter_calls
       SET status = 'attended', attended_at = NOW()
     WHERE table_id = p_table_id
       AND status = 'pending';
    RETURN jsonb_build_object('reservation_id', NULL, 'status', NULL, 'message', 'Nenhuma reserva ativa nesta mesa');
  END IF;

  RETURN complete_reservation(v_reservation_id);
END;
$$;


-- reset_table: limpar chamados de garçom pendentes da mesa
CREATE OR REPLACE FUNCTION reset_table(
  p_restaurant_id UUID,
  p_table_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_exists BOOLEAN;
  v_comanda_ids  UUID[];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM tables
    WHERE id = p_table_id
      AND restaurant_id = p_restaurant_id
      AND is_active = TRUE
  ) INTO v_table_exists;

  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Mesa não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  SELECT ARRAY_AGG(r.virtual_comanda_id)
  INTO v_comanda_ids
  FROM reservations r
  WHERE r.table_id = p_table_id
    AND r.status IN ('pending', 'confirmed', 'activated');

  UPDATE orders
  SET status = 'cancelled',
      table_id = NULL,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id
    AND (
      table_id = p_table_id
      OR (
        virtual_comanda_id IS NOT NULL
        AND virtual_comanda_id = ANY(COALESCE(v_comanda_ids, ARRAY[]::UUID[]))
      )
    )
    AND status <> 'cancelled';

  DELETE FROM reservations
  WHERE table_id = p_table_id
    AND status IN ('pending', 'confirmed', 'activated');

  IF v_comanda_ids IS NOT NULL AND array_length(v_comanda_ids, 1) > 0 THEN
    DELETE FROM virtual_comanda_items
    WHERE comanda_id = ANY(v_comanda_ids);
    UPDATE virtual_comandas
    SET customer_name = NULL,
        notes         = NULL,
        table_number  = NULL,
        updated_at    = NOW()
    WHERE id = ANY(v_comanda_ids)
      AND status = 'open';
  END IF;

  DELETE FROM table_comanda_links
  WHERE table_id = p_table_id
    AND restaurant_id = p_restaurant_id;

  -- Limpar nome do cliente na mesa
  UPDATE tables
     SET current_customer_name = NULL,
         updated_at = NOW()
   WHERE id = p_table_id;

  -- Resetar sinalização "mesa chamando"
  UPDATE waiter_calls
     SET status = 'attended', attended_at = NOW()
   WHERE table_id = p_table_id
     AND status = 'pending';

  RETURN jsonb_build_object(
    'success',  true,
    'table_id', p_table_id
  );
END;
$$;
