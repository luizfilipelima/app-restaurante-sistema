-- =============================================================================
-- Migration: Corrige conversão de moeda em cashier_complete_comanda
-- Data: 2026-03-30
--
-- Problema: virtual_comanda_items armazena unit_price/total_price em NUMERIC (reais).
-- orders/order_items após migration_prices-to-integer usam INTEGER (centavos BRL, inteiro PYG).
-- A função gravava valor em reais como inteiro (ex: 10.50 -> 11 em vez de 1050).
--
-- Solução: Usar get_restaurant_currency e converter ao gravar em orders/order_items
-- (mesma lógica de 20260222 sync_virtual_comanda_to_order / close_virtual_comanda).
-- =============================================================================

-- Garante que a função helper existe (criada em 20260222; pode ter sido dropada por migration_prices-to-integer)
CREATE OR REPLACE FUNCTION get_restaurant_currency(rest_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(currency, 'BRL') FROM restaurants WHERE id = rest_id;
$$ LANGUAGE SQL STABLE;

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
BEGIN
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

  -- Soma dos itens como fonte de verdade (virtual_comanda_items em reais/guaraníes)
  SELECT COALESCE(SUM(total_price), 0) INTO v_total_from_items
    FROM virtual_comanda_items
   WHERE comanda_id = p_comanda_id;

  IF v_total_from_items = 0 OR v_total_from_items IS NULL THEN
    RAISE EXCEPTION 'Comanda % está vazia. Adicione ao menos um item antes de encerrar.', p_comanda_id
      USING ERRCODE = 'P0001';
  END IF;

  v_currency := get_restaurant_currency(v_comanda.restaurant_id);
  -- orders.total/subtotal: INTEGER (centavos para BRL, inteiro para PYG)
  v_total_int := CASE WHEN v_currency = 'PYG'
    THEN ROUND(v_total_from_items)::INTEGER
    ELSE ROUND(v_total_from_items * 100)::INTEGER
  END;

  -- Consistência do total_amount na comanda
  UPDATE virtual_comandas
     SET total_amount = v_total_from_items, updated_at = NOW()
   WHERE id = p_comanda_id;

  -- Reutiliza order existente (sync_virtual_comanda_to_order) ou cria novo
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
      COALESCE(v_comanda.notes, '')
        || CASE
             WHEN v_comanda.table_number IS NOT NULL AND v_comanda.table_number <> ''
             THEN ' | Mesa: ' || v_comanda.table_number
             ELSE ''
           END,
      'completed',
      true,
      v_comanda.id
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
           updated_at     = NOW()
     WHERE id = v_order_id;
  END IF;

  -- order_items: unit_price/total_price em INTEGER (centavos BRL, inteiro PYG)
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
     SET status     = 'paid',
         closed_at  = NOW(),
         updated_at = NOW()
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

COMMENT ON FUNCTION cashier_complete_comanda(UUID, TEXT) IS
  'Finaliza comanda no caixa: usa soma dos itens como total e converte corretamente para INTEGER (BRL=centavos, PYG=inteiro).';

-- =============================================================================
-- Trigger subcategories: EXECUTE PROCEDURE -> EXECUTE FUNCTION (consistência PG11+)
-- =============================================================================
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW
  EXECUTE FUNCTION update_subcategories_updated_at();
