-- Migration: products.available_for_delivery — se o item está disponível para pedidos delivery
-- Data: 2026-04-23
--
-- Permite que super_admin, owner e manager definam por produto se ele aparece no cardápio delivery

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_for_delivery boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.available_for_delivery IS 'Se true, o item aparece no cardápio para pedidos delivery. Editável por super_admin, owner e manager.';
