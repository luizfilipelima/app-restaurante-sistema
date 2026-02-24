-- =============================================================================
-- Migration: Fase 2 e 3 — Fluxos públicos (cliente)
-- Data      : 2026-03-21
-- Depende de: 20260320_reservations_and_waiting_queue.sql
--
-- Fase 2: Cliente faz reserva pela interface pública (/{slug}/reservar)
-- Fase 3: Cliente entra na fila pela interface pública (/{slug}/fila)
--
-- RPCs públicas (anon) que recebem slug em vez de restaurant_id.
-- =============================================================================

-- =============================================================================
-- RPC: create_reservation_by_slug (anon) — Fase 2
-- Cliente faz reserva informando slug do restaurante.
-- =============================================================================
CREATE OR REPLACE FUNCTION create_reservation_by_slug(
  p_restaurant_slug  TEXT,
  p_table_id         UUID,
  p_customer_name    TEXT,
  p_scheduled_at     TIMESTAMPTZ,
  p_customer_phone   TEXT DEFAULT NULL,
  p_late_tolerance_mins INTEGER DEFAULT 15,
  p_notes            TEXT DEFAULT NULL
)
RETURNS JSONB
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
    RAISE EXCEPTION 'Restaurante não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  RETURN create_reservation(
    v_restaurant_id,
    p_table_id,
    p_customer_name,
    p_scheduled_at,
    p_customer_phone,
    p_late_tolerance_mins,
    p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_reservation_by_slug(TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, INTEGER, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION create_reservation_by_slug IS 'Cria reserva a partir do slug do restaurante. Usado pela interface pública do cliente.';


-- =============================================================================
-- RPC: add_to_waiting_queue_by_slug (anon) — Fase 3
-- Cliente entra na fila informando slug do restaurante.
-- =============================================================================
CREATE OR REPLACE FUNCTION add_to_waiting_queue_by_slug(
  p_restaurant_slug  TEXT,
  p_customer_name    TEXT,
  p_customer_phone   TEXT DEFAULT NULL
)
RETURNS JSONB
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
    RAISE EXCEPTION 'Restaurante não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  RETURN add_to_waiting_queue(v_restaurant_id, p_customer_name, p_customer_phone);
END;
$$;

GRANT EXECUTE ON FUNCTION add_to_waiting_queue_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION add_to_waiting_queue_by_slug IS 'Adiciona cliente à fila de espera a partir do slug. Usado pela interface pública do cliente.';


-- =============================================================================
-- RPC: get_available_tables_for_reservation (anon) — Fase 2
-- Retorna mesas disponíveis para reserva em determinada data/hora.
-- (Exclui mesas já reservadas no mesmo período)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_available_tables_for_reservation(
  p_restaurant_slug  TEXT,
  p_scheduled_at     TIMESTAMPTZ
)
RETURNS TABLE (
  table_id   UUID,
  table_number INTEGER,
  zone_name  TEXT
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
    t.id,
    t.number::INTEGER,
    COALESCE(hz.name, '')::TEXT
  FROM tables t
  LEFT JOIN hall_zones hz ON hz.id = t.hall_zone_id
  WHERE t.restaurant_id = v_restaurant_id
    AND t.is_active = TRUE
    AND t.id NOT IN (
      SELECT r.table_id
      FROM reservations r
      WHERE r.restaurant_id = v_restaurant_id
        AND r.status IN ('pending', 'confirmed')
        AND r.scheduled_at::date = p_scheduled_at::date
      -- Simplificação: considera mesma data (poderia refinar com janela de horário)
    )
  ORDER BY hz.order_index, t.order_index, t.number;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_tables_for_reservation(TEXT, TIMESTAMPTZ) TO anon, authenticated;
