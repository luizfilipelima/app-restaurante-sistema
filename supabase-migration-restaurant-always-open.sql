-- =====================================================
-- Migration: Restaurante sempre aberto (24h)
-- =====================================================

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS always_open BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN restaurants.always_open IS 'Se true, o estabelecimento é considerado aberto 24h (ignora horários por dia, exceto "fechado manualmente")';
