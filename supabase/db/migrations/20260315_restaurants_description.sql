-- =============================================================================
-- Migration: restaurants — adiciona coluna description (breve descrição da loja)
-- Data: 2026-03-15
-- =============================================================================
-- Descrição exibida no cardápio público para o cliente.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.restaurants.description IS 'Breve descrição da loja exibida no cardápio para o cliente';
