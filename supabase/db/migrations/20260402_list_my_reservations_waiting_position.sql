-- =============================================================================
-- Migration: RPCs para cliente consultar suas reservas e posição na fila
-- Data      : 2026-04-02
-- Depende de: 20260321_reservations_waiting_queue_public.sql
--
-- RPCs públicas (anon) para o cliente acessar minhas reservas e ver posição na fila
-- usando slug do restaurante + telefone (e opcionalmente nome).
-- =============================================================================

-- =============================================================================
-- RPC: list_my_reservations_by_slug (anon)
-- Lista reservas do cliente por telefone e opcionalmente nome.
-- Retorna: JSONB array com id, short_code, table_number, mesa, scheduled_at, status.
-- =============================================================================
CREATE OR REPLACE FUNCTION list_my_reservations_by_slug(
  p_restaurant_slug  TEXT,
  p_customer_phone   TEXT,
  p_customer_name    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_phone_digits  TEXT;
  v_result        JSONB;
BEGIN
  -- Valida restaurante
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE slug = p_restaurant_slug
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Normaliza telefone: apenas dígitos
  v_phone_digits := COALESCE(regexp_replace(p_customer_phone, '\D', '', 'g'), '');

  IF LENGTH(v_phone_digits) < 8 THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)::JSONB), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      r.id,
      vc.short_code,
      t.number::INTEGER AS table_number,
      r.customer_name,
      r.scheduled_at,
      r.status,
      r.created_at
    FROM reservations r
    JOIN virtual_comandas vc ON vc.id = r.virtual_comanda_id
    JOIN tables t ON t.id = r.table_id
    WHERE r.restaurant_id = v_restaurant_id
      AND regexp_replace(COALESCE(r.customer_phone, ''), '\D', '', 'g') = v_phone_digits
      AND (
        p_customer_name IS NULL
        OR LOWER(TRIM(r.customer_name)) = LOWER(TRIM(p_customer_name))
      )
    ORDER BY r.scheduled_at DESC
  ) r;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION list_my_reservations_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION list_my_reservations_by_slug IS 'Lista reservas do cliente por telefone (e opcionalmente nome). Usado pela interface pública Minhas Reservas.';


-- =============================================================================
-- RPC: get_my_waiting_position_by_slug (anon)
-- Retorna posição do cliente na fila de espera por telefone.
-- Retorna JSONB com position, customer_name, status ou null se não encontrado.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_my_waiting_position_by_slug(
  p_restaurant_slug  TEXT,
  p_customer_phone   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_phone_digits  TEXT;
  v_result        JSONB;
BEGIN
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE slug = p_restaurant_slug
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_phone_digits := COALESCE(regexp_replace(p_customer_phone, '\D', '', 'g'), '');

  IF LENGTH(v_phone_digits) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id',           wq.id,
    'position',     wq.position,
    'customer_name', wq.customer_name,
    'status',       wq.status,
    'created_at',   wq.created_at
  )
  INTO v_result
  FROM waiting_queue wq
  WHERE wq.restaurant_id = v_restaurant_id
    AND wq.status = 'waiting'
    AND regexp_replace(COALESCE(wq.customer_phone, ''), '\D', '', 'g') = v_phone_digits
  ORDER BY wq.position ASC
  LIMIT 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_waiting_position_by_slug(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION get_my_waiting_position_by_slug IS 'Retorna posição do cliente na fila de espera por telefone. Usado pela interface pública Ver Minha Posição.';
