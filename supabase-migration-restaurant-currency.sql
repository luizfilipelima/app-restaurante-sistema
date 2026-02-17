-- Migration: Moeda do cardápio (Real ou Guaraní)
-- Data: 2026-02-17

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL'
CHECK (currency IN ('BRL', 'PYG'));

COMMENT ON COLUMN restaurants.currency IS 'Moeda de exibição dos valores: BRL (Real) ou PYG (Guaraní)';
