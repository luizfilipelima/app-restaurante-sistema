-- =============================================================================
-- Migration: restaurants — garçom pode fechar pagamento diretamente
-- Data: 2026-04-22
--
-- waiter_can_close_payment: quando true, o garçom vê o botão "Fechar conta"
-- na aba lateral da mesa no Terminal do Garçom. Quando false, o botão é
-- removido (apenas Caixa/Admin podem fechar). Configurável na aba Garçom
-- do modal Configurar Salão.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS waiter_can_close_payment BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.restaurants.waiter_can_close_payment IS
  'Se true, o garçom pode fechar o pagamento diretamente na mesa (Terminal do Garçom). Se false, apenas Caixa/Admin fecham.';
