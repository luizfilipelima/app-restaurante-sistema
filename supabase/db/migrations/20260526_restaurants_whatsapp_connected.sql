-- =============================================================================
-- Migration: restaurants — whatsapp_connected (status de conexão Evolution API)
-- Data: 2026-05-26
--
-- Atualizado via webhook CONNECTION_UPDATE quando state = 'open'.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.restaurants.whatsapp_connected IS
  'Indica se o WhatsApp está conectado na instância Evolution API. Atualizado via webhook CONNECTION_UPDATE.';
