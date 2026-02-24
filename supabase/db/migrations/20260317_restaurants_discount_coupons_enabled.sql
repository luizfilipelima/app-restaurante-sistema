-- =============================================================================
-- Migration: restaurants — adiciona discount_coupons_enabled (alternador global)
-- Data: 2026-03-17
-- =============================================================================
-- Quando false: esconde a seção de cupom no checkout.
-- Quando true: cupons ficam disponíveis normalmente.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS discount_coupons_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.restaurants.discount_coupons_enabled IS 'Alternador global: false = esconde cupom no checkout; true = cupons disponíveis';
