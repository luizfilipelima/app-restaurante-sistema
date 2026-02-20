-- =============================================================================
-- Migration: restaurants — adiciona pix_key_type para tipo da chave (CPF, email, aleatória)
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20);

COMMENT ON COLUMN public.restaurants.pix_key_type IS 'Tipo da chave PIX: cpf, email ou random (chave aleatória)';
