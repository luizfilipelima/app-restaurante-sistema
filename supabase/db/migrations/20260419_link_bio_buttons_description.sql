-- =============================================================================
-- Migration: link_bio_buttons — coluna description (subtítulo do botão)
-- Data: 2026-04-19
-- =============================================================================

ALTER TABLE public.link_bio_buttons
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.link_bio_buttons.description IS
  'Subtítulo/descrição exibido abaixo do título do botão na página /bio. Opcional.';
