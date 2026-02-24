-- =============================================================================
-- Migration: menu_theme — apenas default_light e default_dark
-- Data: 2026-03-26
-- =============================================================================
-- Migra temas antigos para os dois temas oficiais:
--   *_dark  -> default_dark
--   outros  -> default_light (incluindo NULL continua válido como "padrão claro")
-- =============================================================================

UPDATE public.restaurants
SET menu_theme = 'default_dark'
WHERE menu_theme IS NOT NULL
  AND menu_theme LIKE '%_dark';

UPDATE public.restaurants
SET menu_theme = 'default_light'
WHERE menu_theme IS NOT NULL
  AND menu_theme NOT IN ('default_light', 'default_dark');

COMMENT ON COLUMN public.restaurants.menu_theme IS 'Tema do cardápio: default_light (padrão), default_dark ou NULL (= default_light)';
