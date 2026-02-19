-- =============================================================================
-- Migration: RPC cashier_complete_comanda
-- Data: 2026-02-23
--
-- Objetivo:
-- Finaliza uma comanda no caixa e marca o pedido diretamente como 'completed',
-- alimentando o Dashboard BI sem passar pelas etapas do Kanban.
--
-- Diferença de close_virtual_comanda (20260222):
--   - status do orders → 'completed' (não 'pending')
--   - is_paid → true
--   - Conversão correta: unit_price/total_price já vêm em "storage format"
--     (centavos para BRL, inteiro para PYG) pois são copiados de products.price.
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
  v_comanda       virtual_comandas%ROWTYPE;
  v_order_id      UUID;
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

  IF v_comanda.total_amount = 0 THEN
    RAISE EXCEPTION 'Comanda % está vazia. Adicione ao menos um item antes de encerrar.', p_comanda_id
      USING ERRCODE = 'P0001';
  END IF;

  -- total_amount já está em "storage format" (centavos para BRL, inteiro para PYG)
  -- pois é a soma de virtual_comanda_items.total_price, que por sua vez vem de products.price
  v_total_int := ROUND(v_comanda.total_amount)::INTEGER;

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
  -- (o caixa pode ter removido itens; reflete o estado final)
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
    ROUND(vci.unit_price)::INTEGER,   -- já em storage format (centavos/inteiro)
    ROUND(vci.total_price)::INTEGER,  -- já em storage format
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
    'total_amount', v_comanda.total_amount,
    'short_code',   v_comanda.short_code
  );
END;
$$;

COMMENT ON FUNCTION cashier_complete_comanda(UUID, TEXT) IS
  'Finaliza comanda no caixa e marca o pedido como completed imediatamente, '
  'alimentando o Dashboard BI sem passar pelo Kanban.';

GRANT EXECUTE ON FUNCTION cashier_complete_comanda(UUID, TEXT) TO authenticated;

-- =============================================================================
-- RPC: reset_virtual_comanda
-- Limpa os itens e dados pessoais de uma comanda aberta sem fechá-la,
-- permitindo reutilização do QR code para o próximo cliente.
--
-- Chamada quando o pedido vinculado à comanda é cancelado no Kanban.
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_virtual_comanda(
  p_comanda_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove itens (o trigger recalcula total_amount → 0 automaticamente)
  DELETE FROM virtual_comanda_items WHERE comanda_id = p_comanda_id;

  -- Limpa nome e observações; mantém status 'open' para reutilizar o QR
  UPDATE virtual_comandas
     SET customer_name = NULL,
         notes         = NULL,
         updated_at    = NOW()
   WHERE id = p_comanda_id
     AND status = 'open';
END;
$$;

COMMENT ON FUNCTION reset_virtual_comanda(UUID) IS
  'Reinicializa uma comanda aberta: remove itens e nome do cliente. '
  'Chamada ao cancelar no Kanban o pedido vinculado à comanda.';

GRANT EXECUTE ON FUNCTION reset_virtual_comanda(UUID) TO authenticated;
