-- =============================================================================
-- Migration: restaurants — horários de reserva (início e fim)
-- Data: 2026-04-21
--
-- reservation_start_time / reservation_end_time: janela em que o cliente pode
-- escolher horário na tela de reservas (formato HH:mm). Se definidos, o input
-- de horário na reserva só permite valores dentro desse intervalo.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS reservation_start_time TEXT,
  ADD COLUMN IF NOT EXISTS reservation_end_time TEXT;

COMMENT ON COLUMN public.restaurants.reservation_start_time IS
  'Horário mínimo para reservas (HH:mm). Exibido na tela de reservas do cliente.';
COMMENT ON COLUMN public.restaurants.reservation_end_time IS
  'Horário máximo para reservas (HH:mm). Exibido na tela de reservas do cliente.';
