-- =============================================================================
-- Migration: restaurants — coluna menu_theme (tema pré-definido do cardápio)
-- Data: 2026-03-19
-- =============================================================================
-- ID do tema escolhido (ex: earthy_light, vibrant_dark, natal_light).
-- NULL = tema padrão do sistema.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS menu_theme VARCHAR(64);

COMMENT ON COLUMN public.restaurants.menu_theme IS 'ID do tema pré-definido do cardápio (earthy_light, natal_dark, etc). NULL = tema padrão';
