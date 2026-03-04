-- =============================================================================
-- Migration: restaurants — valor mínimo do pedido para delivery
-- Data: 2026-04-24
--
-- delivery_min_order_enabled: quando true, aplica o valor mínimo no checkout
-- delivery_min_order_value: valor em moeda base do restaurante (centavos BRL, guaranís PYG)
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_min_order_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_min_order_value integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.restaurants.delivery_min_order_enabled IS 'Se true, bloqueia checkout de delivery quando subtotal < delivery_min_order_value';
COMMENT ON COLUMN public.restaurants.delivery_min_order_value IS 'Valor mínimo do pedido para delivery (centavos BRL, guaranís PYG, centavos ARS). Usado quando delivery_min_order_enabled = true';
