-- =============================================================================
-- Migration: Ativar/desativar formas de pagamento por modo (Delivery / Local)
-- Data: 2026-05-06
--
-- Permite ao restaurante habilitar ou desabilitar cada forma de pagamento
-- separadamente para Delivery e para Local (retirada).
-- NULL = todas habilitadas (retrocompatibilidade). Array = só os listados.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payment_methods_enabled_delivery TEXT[] DEFAULT NULL;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payment_methods_enabled_local TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.payment_methods_enabled_delivery IS
  'Formas de pagamento ativas no checkout Delivery. NULL = todas; array = só pix, card, cash, bank_transfer, qrcode';

COMMENT ON COLUMN public.restaurants.payment_methods_enabled_local IS
  'Formas de pagamento ativas no checkout Local/Retirada. NULL = todas; array = só as listadas';
