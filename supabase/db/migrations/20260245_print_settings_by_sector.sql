-- =============================================================================
-- Migration: Impressão por setor — taxa de garçom configurável por canal
-- Cada setor (delivery, table, pickup, buffet) pode ter:
--   waiter_tip_enabled: boolean — adicionar taxa de garçom na nota
--   waiter_tip_pct: number — percentual (ex: 10 para 10%)
-- =============================================================================

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS print_settings_by_sector JSONB DEFAULT '{}';

COMMENT ON COLUMN restaurants.print_settings_by_sector IS
  'Config de impressão por setor. Ex: {"table":{"waiter_tip_enabled":true,"waiter_tip_pct":10},"delivery":{...}}';
