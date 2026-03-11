-- =============================================================================
-- Migration: Pagamento separado por pessoa na mesa (Caixa)
-- Data: 2026-05-17
--
-- Permite finalizar o pagamento de um cliente específico (Filipe, Guillermo, etc.)
-- sem fechar a conta da mesa inteira. Só aplicável a mesas com mais de um cliente.
--
-- 1. Adiciona is_paid em order_items
-- 2. RPC cashier_pay_customer_portion — marca itens de um cliente como pagos
-- =============================================================================

-- 1. Coluna is_paid em order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.order_items.is_paid IS 'Se o item foi pago (pagamento separado por pessoa na mesa).';

-- 2. RPC: marca itens de um cliente como pagos e fecha o pedido se todos estiverem pagos
CREATE OR REPLACE FUNCTION public.cashier_pay_customer_portion(
  p_order_ids   UUID[],
  p_customer_key TEXT,  -- '' ou NULL = Mesa Geral; senão = customer_name (ex: 'Filipe')
  p_payment_method TEXT DEFAULT 'cash',
  p_closed_by_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oid    UUID;
  v_all_paid BOOLEAN;
  v_count   INT;
BEGIN
  IF array_length(p_order_ids, 1) IS NULL OR array_length(p_order_ids, 1) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'p_order_ids vazio');
  END IF;

  -- Marcar itens: __mesa_geral__ ou '' = Mesa Geral (customer_name NULL/vazio); senão match por customer_name
  UPDATE public.order_items
  SET is_paid = true
  WHERE order_id = ANY(p_order_ids)
    AND (
      (NULLIF(TRIM(COALESCE(p_customer_key, '')), '') IS NULL OR TRIM(p_customer_key) = '__mesa_geral__')
        AND (customer_name IS NULL OR TRIM(COALESCE(customer_name, '')) = '')
      OR
      (NULLIF(TRIM(COALESCE(p_customer_key, '')), '') IS NOT NULL AND TRIM(p_customer_key) != '__mesa_geral__')
        AND TRIM(COALESCE(customer_name, '')) = TRIM(p_customer_key)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Para cada order: se todos os itens estão pagos, marcar order como is_paid
  FOREACH v_oid IN ARRAY p_order_ids
  LOOP
    SELECT NOT EXISTS (
      SELECT 1 FROM public.order_items
      WHERE order_id = v_oid AND (is_paid IS NULL OR is_paid = false)
    ) INTO v_all_paid;

    IF v_all_paid THEN
      UPDATE public.orders
      SET is_paid = true, status = 'completed', payment_method = p_payment_method,
          updated_at = NOW(), closed_by_user_id = p_closed_by_user_id
      WHERE id = v_oid;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'items_updated', v_count);
END;
$$;

COMMENT ON FUNCTION public.cashier_pay_customer_portion(UUID[], TEXT, TEXT, UUID) IS
  'Marca order_items de um cliente específico (customer_name ou Mesa Geral) como pagos. Usado no Caixa para pagamento separado por pessoa.';

GRANT EXECUTE ON FUNCTION public.cashier_pay_customer_portion(UUID[], TEXT, TEXT, UUID) TO authenticated;
