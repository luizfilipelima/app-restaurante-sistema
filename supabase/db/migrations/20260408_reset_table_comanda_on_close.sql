-- =============================================================================
-- Migration: Reset mesa e comanda ao finalizar — privacidade para próximo cliente
-- Data: 2026-04-08
--
-- Objetivo: Ao concluir pedido de mesa/comanda, garantir que ao acessar o
-- cardápio novamente (mesmo dispositivo) não apareçam dados do cliente anterior.
--
-- 1. RPC is_table_available_for_new_session — indica se mesa está "livre"
--    (sem pedidos não pagos, sem reserva ativa). Usado pelo cardápio público
--    para limpar localStorage e não pré-preencher nome.
--
-- 2. cashier_complete_comanda — ao fechar comanda, limpa customer_name e notes
--
-- 3. complete_reservation — ao fechar virtual_comanda vinculada, limpa customer_name e notes
-- =============================================================================

-- RPC: Indica se a mesa está disponível para nova sessão (conta foi fechada)
CREATE OR REPLACE FUNCTION is_table_available_for_new_session(p_table_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tem pedidos não pagos?
  IF EXISTS (
    SELECT 1 FROM orders
    WHERE table_id = p_table_id
      AND is_paid = false
      AND status <> 'cancelled'
  ) THEN
    RETURN false;
  END IF;

  -- Tem reserva ativa (pending, confirmed, activated)?
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE table_id = p_table_id
      AND status IN ('pending', 'confirmed', 'activated')
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION is_table_available_for_new_session(UUID) IS
  'Retorna true se a mesa está livre (sem pedidos não pagos e sem reserva ativa). '
  'Usado pelo cardápio público para limpar dados locais ao abrir mesa recém-fechada.';

GRANT EXECUTE ON FUNCTION is_table_available_for_new_session(UUID) TO anon, authenticated;


-- cashier_complete_comanda: limpar customer_name e notes ao fechar (privacidade)
CREATE OR REPLACE FUNCTION cashier_complete_comanda(
  p_comanda_id     UUID,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda           virtual_comandas%ROWTYPE;
  v_order_id          UUID;
  v_total_from_items  NUMERIC;
  v_total_int         INTEGER;
  v_items_count       INTEGER;
  v_currency          TEXT;
  v_closed_by         UUID;
BEGIN
  v_closed_by := auth.uid();

  SELECT * INTO v_comanda
    FROM virtual_comandas
   WHERE id = p_comanda_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', p_comanda_id USING ERRCODE = 'P0002';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'Comanda % já está % e não pode ser encerrada.',
      p_comanda_id, v_comanda.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(total_price), 0) INTO v_total_from_items
    FROM virtual_comanda_items
   WHERE comanda_id = p_comanda_id;

  IF v_total_from_items = 0 OR v_total_from_items IS NULL THEN
    RAISE EXCEPTION 'Comanda % está vazia. Adicione ao menos um item antes de encerrar.', p_comanda_id
      USING ERRCODE = 'P0001';
  END IF;

  v_currency := get_restaurant_currency(v_comanda.restaurant_id);
  v_total_int := CASE WHEN v_currency = 'PYG'
    THEN ROUND(v_total_from_items)::INTEGER
    ELSE ROUND(v_total_from_items * 100)::INTEGER
  END;

  UPDATE virtual_comandas
     SET total_amount = v_total_from_items, updated_at = NOW()
   WHERE id = p_comanda_id;

  SELECT id INTO v_order_id
    FROM orders
   WHERE virtual_comanda_id = p_comanda_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_order_id IS NULL THEN
    INSERT INTO orders (
      restaurant_id,
      customer_name,
      customer_phone,
      delivery_type,
      delivery_fee,
      subtotal,
      total,
      payment_method,
      order_source,
      notes,
      status,
      is_paid,
      virtual_comanda_id,
      closed_by_user_id
    )
    VALUES (
      v_comanda.restaurant_id,
      COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
      '',
      'pickup',
      0,
      v_total_int,
      v_total_int,
      p_payment_method,
      'comanda',
      COALESCE(v_comanda.notes, '')
        || CASE
             WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> ''
             THEN ' | Mesa: ' || v_comanda.table_number
             ELSE ''
           END,
      'completed',
      true,
      v_comanda.id,
      v_closed_by
    )
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE orders
       SET customer_name  = COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
           total          = v_total_int,
           subtotal       = v_total_int,
           payment_method = p_payment_method,
           notes          = COALESCE(v_comanda.notes, '')
                             || CASE
                                  WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> ''
                                  THEN ' | Mesa: ' || v_comanda.table_number
                                  ELSE ''
                                END,
           status         = 'completed',
           is_paid        = true,
           updated_at     = NOW(),
           closed_by_user_id = v_closed_by
     WHERE id = v_order_id;
  END IF;

  DELETE FROM order_items WHERE order_id = v_order_id;

  INSERT INTO order_items (
    order_id, product_id, product_name,
    quantity, unit_price, total_price, observations
  )
  SELECT
    v_order_id,
    vci.product_id,
    vci.product_name,
    vci.quantity,
    CASE WHEN v_currency = 'PYG' THEN ROUND(vci.unit_price)::INTEGER ELSE ROUND(vci.unit_price * 100)::INTEGER END,
    CASE WHEN v_currency = 'PYG' THEN ROUND(vci.total_price)::INTEGER ELSE ROUND(vci.total_price * 100)::INTEGER END,
    vci.notes
  FROM virtual_comanda_items vci
  WHERE vci.comanda_id = p_comanda_id;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  -- Fecha comanda e limpa dados do cliente (privacidade para próximo uso)
  UPDATE virtual_comandas
     SET status           = 'paid',
         closed_at        = NOW(),
         updated_at       = NOW(),
         closed_by_user_id = v_closed_by,
         customer_name    = NULL,
         notes            = NULL
   WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'comanda_id',   p_comanda_id,
    'items_count',  v_items_count,
    'total_amount', v_total_from_items,
    'short_code',   v_comanda.short_code
  );
END;
$$;


-- complete_reservation: ao fechar virtual_comanda vinculada, limpa customer_name e notes
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

  -- Fecha virtual_comanda e limpa dados do cliente (privacidade para próximo uso)
  UPDATE virtual_comandas
     SET status        = 'paid',
         closed_at     = NOW(),
         updated_at    = NOW(),
         customer_name = NULL,
         notes         = NULL
   WHERE id = v_row.virtual_comanda_id
     AND status = 'open';

  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'completed');
END;
$$;
