-- =============================================================================
-- Migration: closed_by_user_id — Rastrear quem finalizou cada atendimento no caixa
-- Data: 2026-04-07
--
-- Objetivo: Identificar o usuário (e-mail) que fechou cada conta via painel do
-- restaurante ou central do garçom, para logs e gestão.
--
-- Colunas adicionadas:
--   orders.closed_by_user_id
--   virtual_comandas.closed_by_user_id
--   comandas.closed_by_user_id
-- =============================================================================

-- orders: usuário que marcou o pedido como pago
ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN orders.closed_by_user_id IS 'Usuário que finalizou o pagamento no caixa/garçom';

-- virtual_comandas: usuário que fechou a comanda digital
ALTER TABLE virtual_comandas ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN virtual_comandas.closed_by_user_id IS 'Usuário que finalizou a comanda no caixa';

-- comandas (buffet): usuário que fechou a comanda física
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN comandas.closed_by_user_id IS 'Usuário que fechou a comanda buffet no caixa';

-- =============================================================================
-- Atualizar RPC cashier_complete_comanda para gravar auth.uid() como closed_by
-- =============================================================================
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

  UPDATE virtual_comandas
     SET status           = 'paid',
         closed_at        = NOW(),
         updated_at       = NOW(),
         closed_by_user_id = v_closed_by
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
