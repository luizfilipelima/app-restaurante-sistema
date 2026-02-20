-- =============================================================================
-- Migration: Adiciona phone_country aos entregadores (couriers)
-- Permite escolher Brasil, Paraguai ou Argentina para o contato do entregador
-- =============================================================================

ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS phone_country VARCHAR(2) DEFAULT 'BR'
  CHECK (phone_country IS NULL OR phone_country IN ('BR', 'PY', 'AR'));

COMMENT ON COLUMN public.couriers.phone_country IS 'País do número de telefone: BR (Brasil), PY (Paraguai), AR (Argentina)';
