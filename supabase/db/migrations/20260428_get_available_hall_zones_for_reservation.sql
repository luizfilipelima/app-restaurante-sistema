-- =============================================================================
-- Migration: RPC get_available_hall_zones_for_reservation
-- Data: 2026-04-28
--
-- Retorna zonas do salão (hall_zones) com mesas disponíveis para reserva.
-- Usado na tela pública de reservas para o cliente escolher setor em vez de mesa.
-- Cada zona inclui: id, nome, imagem e lista de table_ids disponíveis.
-- Zonas com available_table_ids vazio = LOTADO.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_available_hall_zones_for_reservation(
  p_restaurant_slug  TEXT,
  p_scheduled_at     TIMESTAMPTZ
)
RETURNS TABLE (
  hall_zone_id       UUID,
  zone_name          TEXT,
  image_url          TEXT,
  available_table_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE slug = p_restaurant_slug
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    hz.id,
    hz.name::TEXT,
    hz.image_url,
    COALESCE(
      (
        SELECT array_agg(t.id ORDER BY t.order_index, t.number)
        FROM tables t
        WHERE t.hall_zone_id = hz.id
          AND t.restaurant_id = v_restaurant_id
          AND t.is_active = TRUE
          AND t.id NOT IN (
            SELECT r.table_id
            FROM reservations r
            WHERE r.restaurant_id = v_restaurant_id
              AND r.status IN ('pending', 'confirmed')
              AND r.scheduled_at::date = p_scheduled_at::date
          )
      ),
      ARRAY[]::UUID[]
    ) AS available_table_ids
  FROM hall_zones hz
  WHERE hz.restaurant_id = v_restaurant_id
    AND EXISTS (
      SELECT 1 FROM tables t
      WHERE t.hall_zone_id = hz.id
        AND t.restaurant_id = v_restaurant_id
        AND t.is_active = TRUE
    )
  ORDER BY hz.order_index, hz.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_hall_zones_for_reservation(TEXT, TIMESTAMPTZ) TO anon, authenticated;

COMMENT ON FUNCTION public.get_available_hall_zones_for_reservation IS
  'Retorna zonas do salão com mesas disponíveis para reserva. Usado na interface pública para escolher setor (cliente recebe mesa aleatória do setor).';
