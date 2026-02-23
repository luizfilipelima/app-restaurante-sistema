-- =============================================================================
-- Migration: Canais de pontuação e validade dos pontos (Programa de Fidelidade)
-- Data: 2026-03-10
--
-- Adiciona:
--   - scoring_channels: JSONB com { delivery: bool, table: bool, buffet: bool }
--     (delivery inclui pickup; table inclui comanda/mesas; buffet = buffet/kg)
--   - points_validity_days: NULL = nunca expira, 90 = expira em 90 dias
--
-- O RPC credit_loyalty_point será atualizado para checar o canal do pedido.
-- =============================================================================

-- Canais de pontuação (default: todos ativos para retrocompatibilidade)
ALTER TABLE loyalty_programs
ADD COLUMN IF NOT EXISTS scoring_channels JSONB DEFAULT '{"delivery": true, "table": true, "buffet": true}'::jsonb,
ADD COLUMN IF NOT EXISTS points_validity_days INTEGER DEFAULT NULL;

COMMENT ON COLUMN loyalty_programs.scoring_channels IS
  'Canais onde o cliente pontua: { delivery: bool (delivery+pickup), table: bool (mesas+comanda), buffet: bool }';
COMMENT ON COLUMN loyalty_programs.points_validity_days IS
  'Dias até os pontos expirarem. NULL = nunca expira.';

-- ─── Atualizar credit_loyalty_point para respeitar canais ─────────────────────
-- order_source: delivery, pickup → canal 'delivery'; table, comanda → 'table'; buffet → 'buffet'
CREATE OR REPLACE FUNCTION credit_loyalty_point(
  p_restaurant_id UUID,
  p_order_id      UUID,
  p_phone         TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_credited BOOLEAN;
  v_prog_enabled     BOOLEAN;
  v_channels         JSONB;
  v_order_source     TEXT;
  v_channel_key      TEXT;
  v_channel_enabled  BOOLEAN;
BEGIN
  SELECT loyalty_points_credited, order_source
  INTO v_already_credited, v_order_source
  FROM orders WHERE id = p_order_id;

  IF v_already_credited THEN RETURN false; END IF;
  IF p_phone IS NULL OR TRIM(p_phone) = '' THEN RETURN false; END IF;

  -- Mapear order_source para canal
  v_channel_key := CASE
    WHEN v_order_source IN ('delivery', 'pickup') THEN 'delivery'
    WHEN v_order_source IN ('table', 'comanda') THEN 'table'
    WHEN v_order_source = 'buffet' THEN 'buffet'
    ELSE 'delivery'  -- fallback para retrocompatibilidade
  END;

  SELECT enabled, COALESCE(scoring_channels, '{"delivery": true, "table": true, "buffet": true}'::jsonb)
  INTO v_prog_enabled, v_channels
  FROM loyalty_programs WHERE restaurant_id = p_restaurant_id;

  IF NOT COALESCE(v_prog_enabled, false) THEN RETURN false; END IF;

  v_channel_enabled := COALESCE((v_channels->>v_channel_key)::boolean, true);
  IF NOT v_channel_enabled THEN RETURN false; END IF;

  INSERT INTO loyalty_points (restaurant_id, customer_phone, points, updated_at)
  VALUES (p_restaurant_id, p_phone, 1, NOW())
  ON CONFLICT (restaurant_id, customer_phone)
  DO UPDATE SET points = loyalty_points.points + 1, updated_at = NOW();

  UPDATE orders SET loyalty_points_credited = true WHERE id = p_order_id;
  RETURN true;
END;
$$;
