-- =============================================================================
-- Migration: restaurants — menu_theme_accent VARCHAR(64) para cores customizadas
-- Data: 2026-03-29
-- =============================================================================
-- Permite valores custom:H,S,L e custom#RRGGBB além dos presets (orange, blue, etc).
-- =============================================================================

ALTER TABLE public.restaurants
  ALTER COLUMN menu_theme_accent TYPE VARCHAR(64);
