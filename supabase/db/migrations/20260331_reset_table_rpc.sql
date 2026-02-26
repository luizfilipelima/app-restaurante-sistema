-- =============================================================================
-- Migration: RPC reset_table — Resetar mesa e desvincular comanda de reserva
--
-- Permite que gerente e garçom resetem uma mesa. Ao resetar:
-- 1. Cancela pedidos vinculados à mesa (table_id)
-- 2. Para reservas ativas (pending, confirmed, activated): cancela pedidos das
--    comandas, deleta as reservas, reseta as virtual_comandas (limpa itens,
--    customer_name, notes, table_number)
-- 3. Remove vínculos table_comanda_links (buffet)
--
-- A comanda perde o vínculo com a reserva e fica aberta para reutilização.
-- =============================================================================

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
  -- Validar: mesa existe e pertence ao restaurante
  SELECT EXISTS (
    SELECT 1 FROM tables
    WHERE id = p_table_id
      AND restaurant_id = p_restaurant_id
      AND is_active = TRUE
  ) INTO v_table_exists;

  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Mesa não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Coletar virtual_comanda_ids de reservas ativas desta mesa
  SELECT ARRAY_AGG(r.virtual_comanda_id)
  INTO v_comanda_ids
  FROM reservations r
  WHERE r.table_id = p_table_id
    AND r.status IN ('pending', 'confirmed', 'activated');

  -- 2. Cancelar pedidos: table_id = mesa OU virtual_comanda_id nas comandas das reservas
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

  -- 3. Deletar reservas ativas desta mesa (remove o vínculo)
  DELETE FROM reservations
  WHERE table_id = p_table_id
    AND status IN ('pending', 'confirmed', 'activated');

  -- 4. Resetar cada virtual_comanda que estava vinculada
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

  -- 5. Remover vínculos de comandas físicas (buffet)
  DELETE FROM table_comanda_links
  WHERE table_id = p_table_id
    AND restaurant_id = p_restaurant_id;

  RETURN jsonb_build_object(
    'success',  true,
    'table_id', p_table_id
  );
END;
$$;

COMMENT ON FUNCTION reset_table(UUID, UUID) IS
  'Reseta uma mesa: cancela pedidos, remove reservas ativas, reseta comandas digitais e remove vínculos. '
  'Permite gerente e garçom liberar a mesa para novo uso.';

GRANT EXECUTE ON FUNCTION reset_table(UUID, UUID) TO authenticated;
