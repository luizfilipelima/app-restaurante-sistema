-- =============================================================================
-- Migration: Sincronização de Comanda Digital com Orders (Kanban)
-- Data: 2026-02-22
--
-- Objetivo:
-- 1) Ao cliente confirmar itens na comanda, refletir imediatamente em orders/order_items.
-- 2) Evitar duplicidade de pedidos ao fechar comanda no caixa.
--
-- Nota: orders não possui table_number (apenas table_id). Incluímos order_source 'comanda'.
-- =============================================================================

-- Função usada pelo sync (pode ter sido removida por migration_prices-to-integer).
CREATE OR REPLACE FUNCTION get_restaurant_currency(rest_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(currency, 'BRL') FROM restaurants WHERE id = rest_id;
$$ LANGUAGE SQL STABLE;

-- Permite order_source = 'comanda' (tabela orders usa CHECK)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_source_check
  CHECK (order_source IN ('delivery', 'pickup', 'table', 'buffet', 'comanda'));

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: sync_virtual_comanda_to_order
-- Cria/atualiza um pedido "order_source = comanda" com os itens atuais.
-- Uso: tela pública da comanda (cliente).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_virtual_comanda_to_order(
  p_comanda_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda      virtual_comandas%ROWTYPE;
  v_order_id     UUID;
  v_items_count  INTEGER;
  v_total_int    INTEGER;
BEGIN
  SELECT * INTO v_comanda
    FROM virtual_comandas
   WHERE id = p_comanda_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', p_comanda_id USING ERRCODE = 'P0002';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'Comanda % está % e não pode receber novos pedidos.',
      p_comanda_id, v_comanda.status
      USING ERRCODE = 'P0001';
  END IF;

  v_total_int := CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG'
    THEN ROUND(v_comanda.total_amount)::INTEGER
    ELSE ROUND(v_comanda.total_amount * 100)::INTEGER END;

  -- Reaproveita pedido já existente da comanda, se houver.
  SELECT id INTO v_order_id
    FROM orders
   WHERE virtual_comanda_id = p_comanda_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- orders não possui coluna table_number; usa table_id (UUID). Comanda usa notes.
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
      virtual_comanda_id
    )
    VALUES (
      v_comanda.restaurant_id,
      COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
      '',
      'pickup',
      0,
      v_total_int,
      v_total_int,
      'cash',
      'comanda',
      COALESCE(v_comanda.notes, '') || CASE WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> '' THEN ' | Mesa: ' || v_comanda.table_number ELSE '' END,
      v_comanda.id
    )
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE orders
       SET customer_name = COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
           total         = v_total_int,
           subtotal      = v_total_int,
           notes         = COALESCE(v_comanda.notes, '') || CASE WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> '' THEN ' | Mesa: ' || v_comanda.table_number ELSE '' END,
           order_source  = 'comanda',
           updated_at    = NOW()
     WHERE id = v_order_id;
  END IF;

  -- Mantém order_items espelhado com os itens da comanda.
  DELETE FROM order_items WHERE order_id = v_order_id;

  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, observations)
  SELECT
    v_order_id,
    vci.product_id,
    vci.product_name,
    vci.quantity,
    CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG' THEN ROUND(vci.unit_price)::INTEGER ELSE ROUND(vci.unit_price * 100)::INTEGER END,
    CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG' THEN ROUND(vci.total_price)::INTEGER ELSE ROUND(vci.total_price * 100)::INTEGER END,
    vci.notes
  FROM virtual_comanda_items vci
  WHERE vci.comanda_id = p_comanda_id;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'comanda_id', p_comanda_id,
    'items_count', v_items_count,
    'total_amount', v_comanda.total_amount
  );
END;
$$;

COMMENT ON FUNCTION sync_virtual_comanda_to_order(UUID) IS
  'Cria/atualiza pedido (orders) com base nos itens atuais da comanda digital.';

GRANT EXECUTE ON FUNCTION sync_virtual_comanda_to_order(UUID) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Override: close_virtual_comanda
-- Evita pedido duplicado: se já existir orders.virtual_comanda_id, reaproveita.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION close_virtual_comanda(
  p_comanda_id     UUID,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda       virtual_comandas%ROWTYPE;
  v_order_id      UUID;
  v_existing_stat TEXT;
  v_total_int     INTEGER;
BEGIN
  SELECT * INTO v_comanda
    FROM virtual_comandas
   WHERE id = p_comanda_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', p_comanda_id USING ERRCODE = 'P0002';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'Comanda % já está % e não pode ser fechada novamente.',
      p_comanda_id, v_comanda.status
      USING ERRCODE = 'P0001';
  END IF;

  IF v_comanda.total_amount = 0 THEN
    RAISE EXCEPTION 'Comanda % está vazia. Adicione ao menos um item antes de fechar.', p_comanda_id
      USING ERRCODE = 'P0001';
  END IF;

  v_total_int := CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG'
    THEN ROUND(v_comanda.total_amount)::INTEGER
    ELSE ROUND(v_comanda.total_amount * 100)::INTEGER END;

  SELECT id, status INTO v_order_id, v_existing_stat
    FROM orders
   WHERE virtual_comanda_id = p_comanda_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- orders não possui table_number; mesa vai em notes quando existir.
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
      virtual_comanda_id
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
      COALESCE(v_comanda.notes, '') || CASE WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> '' THEN ' | Mesa: ' || v_comanda.table_number ELSE '' END,
      v_comanda.id
    )
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE orders
       SET customer_name = COALESCE(NULLIF(TRIM(v_comanda.customer_name), ''), 'Comanda ' || v_comanda.short_code),
           total         = v_total_int,
           subtotal      = v_total_int,
           payment_method= p_payment_method,
           notes         = COALESCE(v_comanda.notes, '') || CASE WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> '' THEN ' | Mesa: ' || v_comanda.table_number ELSE '' END,
           status        = COALESCE(v_existing_stat, 'pending'),
           updated_at    = NOW()
     WHERE id = v_order_id;
  END IF;

  DELETE FROM order_items WHERE order_id = v_order_id;

  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, observations)
  SELECT
    v_order_id,
    vci.product_id,
    vci.product_name,
    vci.quantity,
    CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG' THEN ROUND(vci.unit_price)::INTEGER ELSE ROUND(vci.unit_price * 100)::INTEGER END,
    CASE WHEN get_restaurant_currency(v_comanda.restaurant_id) = 'PYG' THEN ROUND(vci.total_price)::INTEGER ELSE ROUND(vci.total_price * 100)::INTEGER END,
    vci.notes
  FROM virtual_comanda_items vci
  WHERE vci.comanda_id = p_comanda_id;

  UPDATE virtual_comandas
     SET status     = 'paid',
         closed_at  = NOW(),
         updated_at = NOW()
   WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'comanda_id',   p_comanda_id,
    'total_amount', v_comanda.total_amount,
    'short_code',   v_comanda.short_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION close_virtual_comanda(UUID, TEXT) TO authenticated;
