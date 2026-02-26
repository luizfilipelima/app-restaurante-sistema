-- =============================================================================
-- Migration: Status 'completed' para reservas e RPCs de conclusão
-- Data      : 2026-04-01
-- Depende de: 20260320_reservations_and_waiting_queue.sql
--
-- Adiciona status 'completed' ao enum reservation_status_type.
-- Cria RPCs complete_reservation e complete_reservation_for_table para marcar
-- reserva como concluída quando a conta for finalizada (Cashier/Gerente/Garçom).
-- =============================================================================

-- Adiciona valor 'completed' ao enum
DO $$
BEGIN
  ALTER TYPE reservation_status_type ADD VALUE 'completed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- RPC: complete_reservation — marca reserva específica como concluída
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
  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'completed');
END;
$$;

COMMENT ON FUNCTION complete_reservation(UUID) IS
  'Marca reserva como concluída (conta finalizada). Usado pelo Cashier/gerente/garçom.';

GRANT EXECUTE ON FUNCTION complete_reservation(UUID) TO authenticated;


-- RPC: complete_reservation_for_table — encontra reserva ativada da mesa e conclui
CREATE OR REPLACE FUNCTION complete_reservation_for_table(p_table_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
BEGIN
  SELECT id INTO v_reservation_id
    FROM reservations
   WHERE table_id = p_table_id
     AND status = 'activated'
   ORDER BY scheduled_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_reservation_id IS NULL THEN
    RETURN jsonb_build_object('reservation_id', NULL, 'status', NULL, 'message', 'Nenhuma reserva ativada nesta mesa');
  END IF;

  RETURN complete_reservation(v_reservation_id);
END;
$$;

COMMENT ON FUNCTION complete_reservation_for_table(UUID) IS
  'Marca reserva ativada da mesa como concluída. Chamado ao finalizar conta no Cashier.';

GRANT EXECUTE ON FUNCTION complete_reservation_for_table(UUID) TO authenticated;
