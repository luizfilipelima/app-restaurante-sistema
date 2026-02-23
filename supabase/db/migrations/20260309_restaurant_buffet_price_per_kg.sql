-- =============================================================================
-- Migration: Preço do Kg configurável para Buffet
-- Data: 2026-03-09
--
-- Permite que o restaurante defina um preço padrão por Kg para produtos
-- vendidos por peso (buffet). Integrado com a pesagem no scanner.
-- Valor na moeda nativa do restaurante (centavos BRL, inteiro PYG).
-- =============================================================================

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS buffet_price_per_kg INTEGER DEFAULT NULL;

COMMENT ON COLUMN restaurants.buffet_price_per_kg IS
  'Preço padrão por Kg para buffet, na moeda nativa (centavos BRL, inteiro PYG). Usado quando o produto não tem price/price_sale.';
