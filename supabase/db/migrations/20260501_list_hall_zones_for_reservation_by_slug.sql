-- =============================================================================
-- Migration: RPC list_hall_zones_for_reservation_by_slug
-- Data: 2026-05-01
--
-- Lista todas as zonas do salão do restaurante (por slug) para exibição na
-- página de reserva. Não exige data/hora; disponibilidade é obtida depois
-- com get_available_hall_zones_for_reservation. Permite ao cliente visualizar
-- e escolher setor antes de preencher outros campos.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_hall_zones_for_reservation_by_slug(
  p_restaurant_slug TEXT
)
RETURNS TABLE (
  hall_zone_id       UUID,
  zone_name         TEXT,
  image_url         TEXT,
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
    ARRAY[]::UUID[] AS available_table_ids
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

GRANT EXECUTE ON FUNCTION public.list_hall_zones_for_reservation_by_slug(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.list_hall_zones_for_reservation_by_slug(TEXT) IS
  'Lista zonas do salão do restaurante por slug, sem filtrar por data/hora. Usado na página de reserva para o cliente ver e escolher setor antes de preencher data/hora.';
