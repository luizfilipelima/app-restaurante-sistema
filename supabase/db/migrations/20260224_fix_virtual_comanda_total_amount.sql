-- =============================================================================
-- Migration: Corrige total_amount de virtual_comandas
-- Data: 2026-02-24
--
-- Problema: total_amount pode ficar 0 mesmo com itens (trigger não dispara
-- corretamente em alguns cenários). Isso faz o Caixa e a lista de comandas
-- exibirem Gs. 0 incorretamente.
--
-- Solução:
--  1. Recalcula total_amount de todas as comandas abertas a partir dos itens.
--  2. Altera cashier_complete_comanda para usar a soma dos itens como fonte
--     de verdade (em vez de confiar em total_amount).
-- =============================================================================

-- Recalcula total_amount de comandas abertas a partir dos itens
UPDATE virtual_comandas vc
   SET total_amount = COALESCE(
         (SELECT SUM(total_price) FROM virtual_comanda_items WHERE comanda_id = vc.id),
         0
       ),
       updated_at = NOW()
 WHERE vc.status = 'open';

-- Altera cashier_complete_comanda para usar soma dos itens como fonte de verdade
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
  v_comanda       virtual_comandas%ROWTYPE;
  v_order_id      UUID;
  v_total_from_items NUMERIC;
  v_total_int     INTEGER;
  v_items_count   INTEGER;
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

  -- Usa a soma dos itens como fonte de verdade (corrige total_amount inconsistente)
  SELECT COALESCE(SUM(total_price), 0) INTO v_total_from_items
    FROM virtual_comanda_items
   WHERE comanda_id = p_comanda_id;

  IF v_total_from_items = 0 OR v_total_from_items IS NULL THEN
    RAISE EXCEPTION 'Comanda % está vazia. Adicione ao menos um item antes de encerrar.', p_comanda_id
      USING ERRCODE = 'P0001';
  END IF;

  v_total_int := ROUND(v_total_from_items)::INTEGER;

  -- Sincroniza total_amount na comanda (para consistência)
  UPDATE virtual_comandas
     SET total_amount = v_total_from_items, updated_at = NOW()
   WHERE id = p_comanda_id;

  -- Reutiliza order existente (criado por sync_virtual_comanda_to_order ao cliente confirmar)
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

  -- Sincroniza order_items com os itens atuais da comanda
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
    ROUND(vci.unit_price)::INTEGER,
    ROUND(vci.total_price)::INTEGER,
    vci.notes
  FROM virtual_comanda_items vci
  WHERE vci.comanda_id = p_comanda_id;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  -- Fecha a comanda
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
  'Finaliza comanda no caixa: usa soma dos itens como total (corrige total_amount inconsistente).';
