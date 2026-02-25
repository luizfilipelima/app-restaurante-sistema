-- =============================================================================
-- Migration: Permite cliente anônimo atualizar customer_name em comanda aberta
-- Data: 2026-02-22
-- Uso: VirtualComanda — campo "Seu nome" abaixo do código de barras
-- =============================================================================

CREATE OR REPLACE FUNCTION update_virtual_comanda_customer_name(
  p_comanda_id UUID,
  p_customer_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Só atualiza se a comanda existir e estiver aberta
  UPDATE virtual_comandas
  SET customer_name = NULLIF(TRIM(p_customer_name), ''),
      updated_at   = NOW()
  WHERE id     = p_comanda_id
    AND status = 'open';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION update_virtual_comanda_customer_name(UUID, TEXT) IS
  'Permite ao cliente atualizar o nome na comanda aberta. Usado pela interface pública.';

GRANT EXECUTE ON FUNCTION update_virtual_comanda_customer_name(UUID, TEXT) TO anon, authenticated;
