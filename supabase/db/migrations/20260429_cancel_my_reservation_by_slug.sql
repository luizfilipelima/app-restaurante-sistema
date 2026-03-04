-- =============================================================================
-- Migration: RPC cancel_my_reservation_by_slug (anon)
-- Data: 2026-04-29
--
-- Permite que o cliente cancele sua própria reserva pela tela "Minhas reservas".
-- Valida telefone para garantir que é o titular da reserva.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_my_reservation_by_slug(
  p_restaurant_slug  TEXT,
  p_reservation_id   UUID,
  p_customer_phone   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_row          reservations%ROWTYPE;
  v_phone_digits TEXT;
BEGIN
  -- Valida restaurante
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE slug = p_restaurant_slug
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurante não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- Busca reserva
  SELECT * INTO v_row
  FROM reservations
  WHERE id = p_reservation_id
    AND restaurant_id = v_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- Verifica se pode cancelar
  IF v_row.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Esta reserva não pode mais ser cancelada.' USING ERRCODE = 'P0001';
  END IF;

  -- Valida telefone do titular
  v_phone_digits := COALESCE(regexp_replace(p_customer_phone, '\D', '', 'g'), '');
  IF LENGTH(v_phone_digits) < 8 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = 'P0001';
  END IF;

  IF regexp_replace(COALESCE(v_row.customer_phone, ''), '\D', '', 'g') != v_phone_digits THEN
    RAISE EXCEPTION 'Esta reserva não pertence a este telefone.' USING ERRCODE = 'P0001';
  END IF;

  -- Cancela via lógica existente
  UPDATE reservations SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = p_reservation_id;
  UPDATE virtual_comandas SET status = 'cancelled', updated_at = NOW() WHERE id = v_row.virtual_comanda_id;

  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_reservation_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.cancel_my_reservation_by_slug IS
  'Cancela reserva do cliente pela interface Minhas Reservas. Valida telefone para garantir que é o titular.';
