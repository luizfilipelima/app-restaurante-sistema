-- =============================================================================
-- Migration: Tabela link_bio_buttons para configuração da página Links e Bio
-- Data: 2026-04-17
--
-- Botões customizáveis exibidos na página pública /:slug/bio.
-- Tipos: url (link externo), menu, whatsapp, reserve, about.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.link_bio_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  url TEXT,
  icon TEXT NOT NULL DEFAULT '🔗',
  button_type TEXT NOT NULL DEFAULT 'url'
    CHECK (button_type IN ('url', 'menu', 'whatsapp', 'reserve', 'about')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.link_bio_buttons IS
  'Botões da página Links e Bio por restaurante. Ordenados por sort_order.';
COMMENT ON COLUMN public.link_bio_buttons.button_type IS
  'url=link externo (usa url), menu=cardápio, whatsapp=WhatsApp, reserve=reservas, about=página sobre.';

CREATE INDEX IF NOT EXISTS idx_link_bio_buttons_restaurant_order
  ON public.link_bio_buttons (restaurant_id, sort_order);

ALTER TABLE public.link_bio_buttons ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer um pode ver os botões (página bio é pública)
CREATE POLICY "link_bio_buttons_select_public"
  ON public.link_bio_buttons FOR SELECT
  USING (true);

-- Inserir/atualizar/remover apenas quem administra o restaurante
CREATE POLICY "link_bio_buttons_insert"
  ON public.link_bio_buttons FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(restaurant_id)));

CREATE POLICY "link_bio_buttons_update"
  ON public.link_bio_buttons FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(restaurant_id)));

CREATE POLICY "link_bio_buttons_delete"
  ON public.link_bio_buttons FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(restaurant_id)));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_link_bio_buttons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_link_bio_buttons_updated_at ON public.link_bio_buttons;
CREATE TRIGGER trigger_link_bio_buttons_updated_at
  BEFORE UPDATE ON public.link_bio_buttons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_link_bio_buttons_updated_at();
