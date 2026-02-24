-- =============================================================================
-- Migration: restaurants — coluna menu_theme_accent (cor dos detalhes em temas minimalistas)
-- Data: 2026-03-27
-- =============================================================================
-- Usado quando menu_theme é 'minimal_light' ou 'minimal_dark'.
-- Valores: orange, blue, emerald, violet, rose, amber (ou NULL = orange).
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS menu_theme_accent VARCHAR(32);

COMMENT ON COLUMN public.restaurants.menu_theme_accent IS 'Cor dos detalhes/ícones nos temas minimalistas (minimal_light/minimal_dark). Ex: orange, blue, emerald. NULL = orange.';

-- Migra tema antigo default_dark para minimal_dark (accent laranja)
UPDATE public.restaurants
SET menu_theme = 'minimal_dark', menu_theme_accent = 'orange'
WHERE menu_theme = 'default_dark';
