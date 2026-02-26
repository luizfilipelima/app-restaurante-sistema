-- =============================================================================
-- Migration: complete_reservation_for_table — incluir pending e confirmed
-- Data      : 2026-04-03
-- Depende de: 20260401_reservation_completed_status.sql
--
-- Ao concluir a conta de uma mesa, completa qualquer reserva vinculada
-- (pending, confirmed ou activated). Permite fluxo em que o cliente vai
-- direto à mesa sem escanear no caixa — ao fechar conta, a reserva vai
-- para Concluídos no kanban.
-- =============================================================================

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
    RETURN jsonb_build_object('reservation_id', NULL, 'status', NULL, 'message', 'Nenhuma reserva ativa nesta mesa');
  END IF;

  RETURN complete_reservation(v_reservation_id);
END;
$$;

COMMENT ON FUNCTION complete_reservation_for_table(UUID) IS
  'Marca reserva da mesa como concluída (status pending, confirmed ou activated). Chamado ao finalizar conta no Cashier/Terminal/Gerente.';
