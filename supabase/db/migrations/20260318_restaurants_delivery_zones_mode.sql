-- =============================================================================
-- Migration: restaurants — adiciona delivery_zones_mode (Desativado | Zonas | Modo Quilometragem)
-- Data: 2026-03-18
-- =============================================================================
-- Valores: 'disabled' | 'zones' | 'kilometers'
-- - disabled: desativa zonas no checkout (card WhatsApp)
-- - zones: cliente escolhe zona por bairro/região
-- - kilometers: modo quilometragem (feature futura)
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_zones_mode TEXT DEFAULT 'zones'
  CHECK (delivery_zones_mode IN ('disabled', 'zones', 'kilometers'));

COMMENT ON COLUMN public.restaurants.delivery_zones_mode IS 'Modo de zonas: disabled | zones | kilometers';

-- Migrar dados existentes de delivery_zones_enabled
UPDATE public.restaurants
SET delivery_zones_mode = CASE
  WHEN delivery_zones_enabled = false THEN 'disabled'
  ELSE 'zones'
END
WHERE delivery_zones_mode IS NULL;
