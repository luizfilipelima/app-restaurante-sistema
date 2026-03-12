-- =============================================================================
-- Migration: restaurants — WhatsApp Evolution API (notificações automáticas Kanban)
-- Data: 2026-05-25
--
-- Permite super-admin habilitar notificações WhatsApp via Evolution API por restaurante.
-- Quando habilitado: ao mudar status para "preparando" ou "entregando",
-- o sistema envia mensagem automática ao cliente.
-- =============================================================================

-- 1. Toggle habilitado pelo super-admin (somente ele pode ativar)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_evolution_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.restaurants.whatsapp_evolution_enabled IS
  'Habilitado pelo super-admin: envia notificações WhatsApp automáticas (preparando/entregando) via Evolution API.';

-- 2. Nome da instância na Evolution API (ex: restaurante-principal)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT;

COMMENT ON COLUMN public.restaurants.evolution_instance_name IS
  'Nome da instância WhatsApp na Evolution API. Configurado pelo admin do restaurante quando habilitado.';
