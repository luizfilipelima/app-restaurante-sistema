-- =============================================================================
-- Migration: Configurações de balança para buffet
-- Data: 2026-06-18
--
-- Permite configurar baud rate e unidade da balança (kg/g) por restaurante.
-- A seleção da porta serial é feita no cliente (Web Serial API).
-- =============================================================================

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS scale_baud_rate INTEGER DEFAULT 9600,
ADD COLUMN IF NOT EXISTS scale_unit TEXT DEFAULT 'kg' CHECK (scale_unit IN ('kg', 'g'));

COMMENT ON COLUMN restaurants.scale_baud_rate IS
  'Baud rate da comunicação serial com a balança (ex: 9600, 2400).';
COMMENT ON COLUMN restaurants.scale_unit IS
  'Unidade de saída da balança: kg ou g. Se g, o sistema converte para kg antes do cálculo.';
