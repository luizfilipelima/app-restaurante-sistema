-- ─────────────────────────────────────────────────────────────────────────────
-- Super Admin: Configuração de câmbio para métricas em BRL
-- ─────────────────────────────────────────────────────────────────────────────
-- Permite ao super admin definir cotações (PYG→BRL, ARS→BRL) para visualizar
-- GMV e ticket médio convertidos em Real nos KPIs agregados.
-- Os cards de restaurantes continuam exibindo valores na moeda nativa de cada um.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.super_admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.super_admin_settings IS
  'Configurações globais do super admin (ex: câmbio para métricas em BRL)';

-- Valor inicial: cotações para conversão em BRL
INSERT INTO public.super_admin_settings (key, value)
VALUES (
  'exchange_rates',
  '{"pyg_per_brl": 3600, "ars_per_brl": 1150}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- RLS: somente super_admin pode ler e escrever
ALTER TABLE public.super_admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_settings_select" ON public.super_admin_settings;
CREATE POLICY "super_admin_settings_select"
  ON public.super_admin_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin_settings_insert" ON public.super_admin_settings;
CREATE POLICY "super_admin_settings_insert"
  ON public.super_admin_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin_settings_update" ON public.super_admin_settings;
CREATE POLICY "super_admin_settings_update"
  ON public.super_admin_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'));
