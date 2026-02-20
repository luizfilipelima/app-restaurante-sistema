-- Migration: whatsapp_templates
-- Adiciona coluna JSONB à tabela restaurants para armazenar templates
-- personalizáveis das mensagens enviadas via WhatsApp.
--
-- Estrutura do JSONB:
-- {
--   "new_order":              "<template>",   -- Restaurante recebe ao fechar pedido (Checkout)
--   "delivery_notification":  "<template>",   -- Cliente recebe quando pedido sai p/ entrega
--   "courier_dispatch":       "<template>"    -- Entregador recebe ao ser despachado
-- }

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_templates JSONB DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.whatsapp_templates IS
  'Templates personalizáveis de mensagens WhatsApp. Null = usar padrão do sistema.';
