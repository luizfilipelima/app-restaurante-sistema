-- =============================================================================
-- Migration: current_customer_name na mesa — nome do cliente em tempo real
-- Data: 2026-04-09
--
-- Objetivo: Quando o cliente salva seu nome no cardápio da mesa, o nome deve
-- aparecer imediatamente na tela do garçom e no painel de mesas. O cliente
-- salva antes de fazer o pedido; precisamos persistir no servidor para que
-- o painel (realtime) mostre o nome assim que for salvo.
--
-- 1. Coluna current_customer_name em tables
-- 2. RPC update_table_customer_name — chamável por anon (cliente no cardápio)
-- 3. Limpar ao fechar mesa (useCloseTableAccount, reset_table, complete_reservation)
-- =============================================================================

ALTER TABLE tables ADD COLUMN IF NOT EXISTS current_customer_name TEXT;
COMMENT ON COLUMN tables.current_customer_name IS 'Nome do cliente atual na mesa (salvo pelo cliente no cardápio). Limpo ao fechar conta.';

-- RPC: Cliente salva nome no cardápio — atualiza imediatamente para aparecer no painel
CREATE OR REPLACE FUNCTION update_table_customer_name(
  p_table_id       UUID,
  p_customer_name  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tables
     SET current_customer_name = NULLIF(TRIM(p_customer_name), ''),
         updated_at = NOW()
   WHERE id = p_table_id
     AND is_active = TRUE;
END;
$$;

COMMENT ON FUNCTION update_table_customer_name(UUID, TEXT) IS
  'Atualiza o nome do cliente na mesa. Chamado pelo cardápio público quando o cliente salva seu nome.';

GRANT EXECUTE ON FUNCTION update_table_customer_name(UUID, TEXT) TO anon, authenticated;


-- complete_reservation: limpar current_customer_name da mesa ao concluir
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

  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'completed');
END;
$$;


-- reset_table: limpar current_customer_name
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

  RETURN jsonb_build_object(
    'success',  true,
    'table_id', p_table_id
  );
END;
$$;
