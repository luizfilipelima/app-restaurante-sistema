-- =============================================================================
-- Migration: Caixa/PDV — Remover item de comanda (digital e buffet)
-- Data: 2026-06-14
--
-- Permite que owner, restaurant_admin e super_admin removam itens individuais
-- de comandas digitais e comandas buffet (não pagas).
-- O total da comanda é recalculado automaticamente via triggers existentes.
-- =============================================================================

-- ─── 1. Remover item de comanda digital (virtual_comanda_items) ──────────────
CREATE OR REPLACE FUNCTION public.cashier_remove_virtual_comanda_item(
  p_comanda_id UUID,
  p_item_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_status        TEXT;
  v_caller_ok     BOOLEAN;
  v_new_total     NUMERIC(12,2);
BEGIN
  -- 1. Carregar comanda e validar
  SELECT vc.restaurant_id, vc.status::TEXT
  INTO v_restaurant_id, v_status
  FROM virtual_comandas vc
  WHERE vc.id = p_comanda_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Comanda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Não é possível remover itens de comanda já fechada ou cancelada.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Item pertence à comanda
  IF NOT EXISTS (
    SELECT 1 FROM virtual_comanda_items
    WHERE id = p_item_id AND comanda_id = p_comanda_id
  ) THEN
    RAISE EXCEPTION 'Item não pertence a esta comanda.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Permissão: owner, restaurant_admin ou super_admin
  v_caller_ok := (SELECT current_user_can_admin_restaurant(v_restaurant_id));

  IF NOT COALESCE(v_caller_ok, false) THEN
    RAISE EXCEPTION 'Sem permissão para remover itens desta comanda.' USING ERRCODE = '42501';
  END IF;

  -- 4. Remover o item (trigger recalculará total_amount)
  DELETE FROM virtual_comanda_items
  WHERE id = p_item_id AND comanda_id = p_comanda_id;

  -- 5. Obter novo total após trigger
  SELECT COALESCE(total_amount, 0) INTO v_new_total
  FROM virtual_comandas WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'comanda_id',  p_comanda_id,
    'item_id',     p_item_id,
    'total',       v_new_total
  );
END;
$$;

COMMENT ON FUNCTION public.cashier_remove_virtual_comanda_item(UUID, UUID) IS
  'Remove um item de uma comanda digital aberta. Usado no Caixa. Recalcula total via trigger.';

REVOKE ALL ON FUNCTION public.cashier_remove_virtual_comanda_item(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashier_remove_virtual_comanda_item(UUID, UUID) TO authenticated;


-- ─── 2. Remover item de comanda buffet (comanda_items) ───────────────────────
CREATE OR REPLACE FUNCTION public.cashier_remove_comanda_item(
  p_comanda_id UUID,
  p_item_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_status        TEXT;
  v_caller_ok     BOOLEAN;
  v_new_total     NUMERIC(12,2);
BEGIN
  -- 1. Carregar comanda e validar
  SELECT c.restaurant_id, c.status
  INTO v_restaurant_id, v_status
  FROM comandas c
  WHERE c.id = p_comanda_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Comanda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Não é possível remover itens de comanda já fechada.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Item pertence à comanda
  IF NOT EXISTS (
    SELECT 1 FROM comanda_items
    WHERE id = p_item_id AND comanda_id = p_comanda_id
  ) THEN
    RAISE EXCEPTION 'Item não pertence a esta comanda.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Permissão: owner, restaurant_admin ou super_admin
  v_caller_ok := (SELECT current_user_can_admin_restaurant(v_restaurant_id));

  IF NOT COALESCE(v_caller_ok, false) THEN
    RAISE EXCEPTION 'Sem permissão para remover itens desta comanda.' USING ERRCODE = '42501';
  END IF;

  -- 4. Remover o item (trigger recalculará total_amount)
  DELETE FROM comanda_items
  WHERE id = p_item_id AND comanda_id = p_comanda_id;

  -- 5. Obter novo total após trigger
  SELECT COALESCE(total_amount, 0) INTO v_new_total
  FROM comandas WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'comanda_id',  p_comanda_id,
    'item_id',     p_item_id,
    'total',       v_new_total
  );
END;
$$;

COMMENT ON FUNCTION public.cashier_remove_comanda_item(UUID, UUID) IS
  'Remove um item de uma comanda buffet aberta. Usado no Caixa. Recalcula total via trigger.';

REVOKE ALL ON FUNCTION public.cashier_remove_comanda_item(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashier_remove_comanda_item(UUID, UUID) TO authenticated;
