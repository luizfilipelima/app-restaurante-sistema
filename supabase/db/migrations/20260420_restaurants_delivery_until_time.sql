-- =============================================================================
-- Migration: restaurants — horário limite do delivery
-- Data: 2026-04-20
--
-- delivery_until_time: aceitar pedidos de delivery até este horário (HH:mm).
-- Se preenchido e o horário atual passar, não é possível fazer pedidos de
-- delivery (a menos que always_open esteja ativado).
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_until_time TEXT;

COMMENT ON COLUMN public.restaurants.delivery_until_time IS
  'Horário limite para aceitar pedidos de delivery (formato HH:mm). Não aplicado se always_open = true.';
