-- =============================================================================
-- Migration: complete_reservation — fechar virtual_comanda ao concluir reserva
-- Data      : 2026-04-04
-- Depende de: 20260401_reservation_completed_status.sql
--
-- Problema: ao finalizar conta pela mesa (fluxo reserva + mesa), a virtual_comanda
-- da reserva permanecia status='open'. O caixa buscava comandas abertas e exibia
-- essa comanda em "Comandas Avulsas" (CMD-XXXX + nome do cliente, Gs. 0).
--
-- Correção: ao concluir a reserva, fechar também a virtual_comanda vinculada
-- (status='paid', closed_at=NOW()), igual ao cancel_reservation que fecha com
-- status='cancelled'.
-- =============================================================================

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

  -- Fechar virtual_comanda vinculada para que não apareça em Comandas Avulsas
  UPDATE virtual_comandas
     SET status     = 'paid',
         closed_at  = NOW(),
         updated_at = NOW()
   WHERE id = v_row.virtual_comanda_id
     AND status = 'open';

  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'completed');
END;
$$;

COMMENT ON FUNCTION complete_reservation(UUID) IS
  'Marca reserva como concluída (conta finalizada) e fecha a virtual_comanda vinculada. Usado pelo Cashier/gerente/garçom.';
