-- =============================================================================
-- Migration: product_offers — coluna always_active
-- Quando true, a oferta fica sempre visível no cardápio (ignora período).
-- O Status (Ativa) na Gestão de Ofertas reflete a visibilidade no cardápio.
-- =============================================================================

ALTER TABLE public.product_offers
  ADD COLUMN IF NOT EXISTS always_active BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_offers.always_active IS
  'Se true, a oferta fica sempre visível no cardápio, independente de starts_at/ends_at.';
