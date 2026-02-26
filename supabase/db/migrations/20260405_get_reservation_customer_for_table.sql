-- =============================================================================
-- Migration: get_reservation_customer_for_table — pré-preencher nome do cliente
-- Data      : 2026-04-05
-- Depende de: 20260320_reservations_and_waiting_queue.sql
--
-- Quando o cliente abre o cardápio via QR da mesa (cardapio/:tableNumber) e
-- existe uma reserva ativa para aquela mesa, o nome do cliente já deve estar
-- vinculado — não deve pedir novamente no modal "Qual seu nome?".
--
-- RPC: retorna customer_name da reserva ativa (pending, confirmed, activated)
-- para a mesa. Usado pela interface pública MenuTable para pré-preencher o
-- nome e dispensar o modal de boas-vindas.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_reservation_customer_for_table(p_table_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
BEGIN
  SELECT r.customer_name INTO v_customer_name
    FROM reservations r
   WHERE r.table_id = p_table_id
     AND r.status IN ('pending', 'confirmed', 'activated')
   ORDER BY r.scheduled_at DESC
   LIMIT 1;

  IF v_customer_name IS NULL OR TRIM(v_customer_name) = '' THEN
    RETURN jsonb_build_object('customer_name', NULL);
  END IF;

  RETURN jsonb_build_object('customer_name', TRIM(v_customer_name));
END;
$$;

COMMENT ON FUNCTION get_reservation_customer_for_table(UUID) IS
  'Retorna o customer_name da reserva ativa da mesa. Usado pelo cardápio público para pré-preencher o nome e dispensar o modal de boas-vindas.';

GRANT EXECUTE ON FUNCTION get_reservation_customer_for_table(UUID) TO anon, authenticated;
