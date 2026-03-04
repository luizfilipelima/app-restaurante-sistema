-- =============================================================================
-- Migration: hall_zones — imagem da zona
-- Data: 2026-04-25
--
-- Permite associar uma imagem a cada zona do salão (ex: Varanda, Salão Principal).
-- =============================================================================

ALTER TABLE public.hall_zones
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.hall_zones.image_url IS 'URL da imagem da zona (exibida no painel de configuração do salão).';
