-- =============================================================================
-- Migration: orders.bill_requested — Solicitar Fechamento (Pedir a Conta)
-- Quando o garçom pressiona "Pedir a Conta", marca o pedido da mesa e sinaliza
-- para o Caixa/PDV. Bloqueia novos pedidos nessa mesa.
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bill_requested BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.bill_requested IS 'Se true, conta solicitada (Pedir a Conta); bloqueia novos pedidos na mesa e sinaliza para o Caixa.';
