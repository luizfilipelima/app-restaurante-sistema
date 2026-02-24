-- =============================================================================
-- Migration: restaurants — adiciona delivery_zones_enabled (alternador global)
-- Data: 2026-03-16
-- =============================================================================
-- Quando false: desativa todas as zonas (checkout mostra card WhatsApp).
-- Quando true: usa o is_active de cada zona individualmente.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_zones_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.restaurants.delivery_zones_enabled IS 'Alternador global: false = todas zonas desativadas no checkout; true = respeita is_active de cada zona';
