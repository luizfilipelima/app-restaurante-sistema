-- =============================================================================
-- Migration: feature_custom_domain (Enterprise) + RPC get_restaurant_slug_by_hostname
-- Data: 2026-04-27
--
-- Feature flag para controle de acesso e RPC para resolução de hostname → slug.
-- =============================================================================

-- 1. Inserir feature no catálogo
INSERT INTO public.features (flag, label, description, module, min_plan)
VALUES (
  'feature_custom_domain',
  'Domínio Personalizado',
  'Usar domínio próprio para o cardápio (ex: cardapio.seudominio.com.br)',
  'configuracoes',
  'enterprise'
)
ON CONFLICT (flag) DO NOTHING;

-- 2. Vincular ao plano Enterprise
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT sp.id, f.id
FROM public.subscription_plans sp
CROSS JOIN public.features f
WHERE sp.name = 'enterprise'
  AND f.flag = 'feature_custom_domain'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- 3. RPC pública: resolve hostname → slug do restaurante
-- Usada no client para saber qual tenant exibir quando o visitante acessa via domínio custom
CREATE OR REPLACE FUNCTION public.get_restaurant_slug_by_hostname(p_hostname TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_host_clean TEXT;
BEGIN
  v_host_clean := LOWER(TRIM(p_hostname));
  IF v_host_clean = '' OR v_host_clean IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1) Busca por custom_domain (domínio personalizado)
  SELECT slug INTO v_slug
  FROM restaurants
  WHERE LOWER(TRIM(custom_domain)) = v_host_clean
    AND is_active = true
  LIMIT 1;

  IF v_slug IS NOT NULL THEN
    RETURN v_slug;
  END IF;

  -- 2) Subdomínio do quiero.food: slug.quiero.food
  IF v_host_clean LIKE '%.quiero.food' THEN
    v_slug := SPLIT_PART(v_host_clean, '.', 1);
    IF v_slug NOT IN ('app', 'admin', 'www', 'kds') AND v_slug != '' THEN
      IF EXISTS (SELECT 1 FROM restaurants WHERE slug = v_slug AND is_active = true) THEN
        RETURN v_slug;
      END IF;
    END IF;
  END IF;

  -- 3) Em dev: slug.localhost
  IF v_host_clean LIKE '%.localhost' THEN
    v_slug := SPLIT_PART(v_host_clean, '.', 1);
    IF v_slug NOT IN ('app', 'admin', 'www', 'kds') AND v_slug != '' THEN
      IF EXISTS (SELECT 1 FROM restaurants WHERE slug = v_slug AND is_active = true) THEN
        RETURN v_slug;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_restaurant_slug_by_hostname(TEXT) IS
  'Resolve hostname para o slug do restaurante. Suporta custom_domain, slug.quiero.food e slug.localhost. Retorna NULL se não encontrar.';

-- Permitir que visitantes anônimos (custom domain) e autenticados chamem a RPC
GRANT EXECUTE ON FUNCTION public.get_restaurant_slug_by_hostname(TEXT) TO anon, authenticated;
