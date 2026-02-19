-- =============================================================================
-- Migration: Onboarding Self-Service — setup_new_tenant()
-- Data      : 2026-02-21
-- Depende de: 20260219_init_access_control.sql
--             (tabelas: restaurants, restaurant_user_roles, subscription_plans,
--                       restaurant_subscriptions, users)
--
-- Objetivo:
--   Criar um RPC atômico chamado pelo frontend logo após o registro do usuário.
--   Em uma única chamada, provisiona o restaurante, vincula o proprietário,
--   inicia o período trial no plano Core e atualiza o perfil do usuário.
--
-- Design de Segurança:
--   • SECURITY DEFINER: a função executa com privilégios do owner do banco,
--     permitindo INSERT em tabelas com RLS sem precisar abrir políticas ao usuário
--     recém-criado (que ainda não tem restaurant_id).
--   • SET search_path = public, auth: previne ataques de injeção de schema.
--   • Verificação explícita de auth.uid() IS NOT NULL: rejeita chamadas anônimas.
--   • Re-raise de exceções: preserva errcode e message originais para o cliente.
--   • Proteção contra rebaixamento: não altera a role se o usuário for super_admin.
--
-- Uso no frontend:
--   const { data, error } = await supabase.rpc('setup_new_tenant', {
--     p_restaurant_name: 'Pizzaria do João',
--     p_slug:            'pizzaria-do-joao',
--     p_phone:           '+55 11 99999-9999',
--   });
--   // data = { restaurant_id: '...uuid...', slug: 'pizzaria-do-joao' }
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1 — FUNÇÃO AUXILIAR: normalizar e validar slug
-- =============================================================================
-- Remove espaços, converte para minúsculas e rejeita caracteres inválidos.
-- Slugs válidos: letras a-z, dígitos 0-9, hifens. Ex: "pizzaria-do-joao".

CREATE OR REPLACE FUNCTION normalize_slug(p_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_slug TEXT;
BEGIN
  -- Trim, lower, troca espaços internos por hifen
  v_slug := REGEXP_REPLACE(
    LOWER(TRIM(COALESCE(p_slug, ''))),
    '\s+', '-', 'g'
  );

  -- Remove caracteres que não sejam alfanuméricos ou hifens
  v_slug := REGEXP_REPLACE(v_slug, '[^a-z0-9\-]', '', 'g');

  -- Colapsa hifens duplos
  v_slug := REGEXP_REPLACE(v_slug, '-{2,}', '-', 'g');

  -- Remove hifens nas extremidades
  v_slug := TRIM(BOTH '-' FROM v_slug);

  RETURN v_slug;
END;
$$;

COMMENT ON FUNCTION normalize_slug IS
  'Normaliza um slug: lowercase, troca espaços por hifens, remove caracteres especiais.';


-- =============================================================================
-- SEÇÃO 2 — FUNÇÃO RPC: setup_new_tenant()
-- =============================================================================

CREATE OR REPLACE FUNCTION setup_new_tenant(
  p_restaurant_name TEXT,
  p_slug            TEXT,
  p_phone           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- Previne search_path injection: garante que 'public' e 'auth' são os únicos schemas
SET search_path = public, auth
AS $$
DECLARE
  v_user_id       UUID;
  v_restaurant_id UUID;
  v_plan_id       UUID;
  v_slug_final    TEXT;
  v_name_clean    TEXT;
BEGIN

  -- ────────────────────────────────────────────────────────────────────────────
  -- GUARDA DE SEGURANÇA: rejeitar chamadas anônimas
  -- ────────────────────────────────────────────────────────────────────────────
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'Não autorizado: usuário não autenticado. Faça login antes de criar um restaurante.'
    USING ERRCODE = 'insufficient_privilege';
  END IF;


  -- ────────────────────────────────────────────────────────────────────────────
  -- VALIDAÇÃO: nome do restaurante
  -- ────────────────────────────────────────────────────────────────────────────
  v_name_clean := TRIM(p_restaurant_name);

  IF v_name_clean IS NULL OR v_name_clean = '' THEN
    RAISE EXCEPTION
      'O nome do restaurante não pode ser vazio.'
    USING ERRCODE = 'invalid_parameter_value';
  END IF;


  -- ────────────────────────────────────────────────────────────────────────────
  -- VALIDAÇÃO: slug
  -- ────────────────────────────────────────────────────────────────────────────
  v_slug_final := normalize_slug(p_slug);

  IF v_slug_final = '' THEN
    RAISE EXCEPTION
      'Slug inválido: use apenas letras, números e hifens (ex: meu-restaurante).'
    USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF LENGTH(v_slug_final) < 3 THEN
    RAISE EXCEPTION
      'Slug muito curto: precisa ter ao menos 3 caracteres.'
    USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Verifica unicidade: slug não pode pertencer a um restaurante ativo
  IF EXISTS (
    SELECT 1 FROM restaurants
    WHERE slug = v_slug_final
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'O link personalizado "%" já está em uso. Escolha um nome diferente para a sua URL.',
      v_slug_final
    USING ERRCODE = 'unique_violation';
  END IF;


  -- ────────────────────────────────────────────────────────────────────────────
  -- PASSO A — Criar o restaurante
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO restaurants (
    name,
    slug,
    phone,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    v_name_clean,
    v_slug_final,
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),  -- armazena NULL se telefone vazio
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_restaurant_id;


  -- ────────────────────────────────────────────────────────────────────────────
  -- PASSO B — Vincular o usuário como 'owner' do restaurante
  --
  -- Nota sobre o ENUM restaurant_role_type:
  --   O cargo 'owner' equivale funcionalmente ao 'restaurant_admin' do sistema
  --   legado (users.role). Ele concede acesso total ao restaurante dentro do
  --   contexto RBAC granular (restaurant_user_roles).
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO restaurant_user_roles (
    restaurant_id,
    user_id,
    role,
    is_active,
    invited_by,
    created_at,
    updated_at
  )
  VALUES (
    v_restaurant_id,
    v_user_id,
    'owner'::restaurant_role_type,
    true,
    v_user_id,   -- auto-convidado: o próprio usuário criou o restaurante
    NOW(),
    NOW()
  );


  -- ────────────────────────────────────────────────────────────────────────────
  -- PASSO C — Buscar o plano Core (plano básico padrão)
  --
  -- Usa o slug técnico 'core' que não muda (mesmo que o label/label mude).
  -- Fallback: se por algum motivo não houver plano 'core', usa o de menor preço.
  -- ────────────────────────────────────────────────────────────────────────────
  SELECT id INTO v_plan_id
  FROM   subscription_plans
  WHERE  name      = 'core'
    AND  is_active = true
  LIMIT  1;

  -- Fallback: primeiro plano ativo disponível (ordenado pelo menor preço)
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM   subscription_plans
    WHERE  is_active = true
    ORDER  BY price_brl ASC, sort_order ASC
    LIMIT  1;
  END IF;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION
      'Nenhum plano de assinatura ativo encontrado. Execute a migration de seed de planos antes de criar restaurantes.'
    USING ERRCODE = 'no_data_found';
  END IF;


  -- ────────────────────────────────────────────────────────────────────────────
  -- PASSO D — Criar assinatura em período de trial (7 dias)
  --
  -- status = 'trial'  (valor aceito pelo CHECK constraint: active|trial|suspended|cancelled)
  -- trial_ends_at     = 7 dias a partir de agora
  -- current_period_end = mesmo valor por ora (pode ser ajustado ao ativar)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO restaurant_subscriptions (
    restaurant_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  )
  VALUES (
    v_restaurant_id,
    v_plan_id,
    'trial',
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
  );


  -- ────────────────────────────────────────────────────────────────────────────
  -- PASSO E — Atualizar perfil do usuário na tabela pública `users`
  --
  -- Define restaurant_id e eleva a role para 'restaurant_admin' no sistema legado.
  -- Guarda: não rebaixa um super_admin para restaurant_admin.
  --
  -- Por que UPDATE e não INSERT?
  --   A tabela `users` é tipicamente populada pelo trigger `on_auth_user_created`
  --   quando o usuário se registra em auth.users. Esta função apenas completa
  --   os campos ainda não preenchidos (restaurant_id, role).
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE users
  SET
    restaurant_id = v_restaurant_id,
    role          = CASE
                      WHEN role = 'super_admin' THEN role  -- não rebaixar super_admin
                      ELSE 'restaurant_admin'
                    END,
    updated_at    = NOW()
  WHERE id = v_user_id;

  -- Aviso não-fatal: se o registro ainda não existe em `users` (trigger atrasado),
  -- a assinatura e o restaurante já foram criados. O trigger cuidará do restante.
  -- A aplicação deve re-chamar após o trigger propagar caso precise do role.


  -- ────────────────────────────────────────────────────────────────────────────
  -- RETORNO — restaurant_id e slug para o frontend redirecionar
  -- ────────────────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant_id::TEXT,
    'slug',          v_slug_final,
    'trial_ends_at', (NOW() + INTERVAL '7 days')::TEXT,
    'plan_name',     'core'
  );

EXCEPTION
  -- Re-raise: preserva ERRCODE e message originais para o cliente Supabase.
  -- PostgreSQL reverte automaticamente toda a transação em caso de erro,
  -- garantindo atomicidade (nenhuma inserção parcial).
  WHEN OTHERS THEN
    RAISE;

END;
$$;

COMMENT ON FUNCTION setup_new_tenant IS
  'RPC de onboarding self-service: provisiona restaurante, vínculo RBAC (owner), '
  'assinatura trial de 7 dias no plano Core e atualiza o perfil do usuário. '
  'Deve ser chamado logo após o registro do usuário. Retorna restaurant_id e slug.';


-- =============================================================================
-- SEÇÃO 3 — PERMISSÕES
-- =============================================================================
--
-- SECURITY DEFINER já protege a execução interna.
-- REVOKE bloqueia chamadas de usuários não autenticados (anon role).
-- GRANT permite que usuários logados (authenticated) chamem a função.

REVOKE ALL    ON FUNCTION setup_new_tenant(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION setup_new_tenant(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL    ON FUNCTION normalize_slug(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION normalize_slug(TEXT) TO authenticated;


-- =============================================================================
-- SEÇÃO 4 — TESTES INLINE (comentados; execute manualmente no SQL Editor)
-- =============================================================================
--
-- Teste 1: chamada de sucesso
-- SELECT setup_new_tenant('Pizzaria do João', 'pizzaria-do-joao', '+55 11 99999-9999');
-- Esperado: { restaurant_id: "...", slug: "pizzaria-do-joao", trial_ends_at: "...", plan_name: "core" }
--
-- Teste 2: slug duplicado
-- SELECT setup_new_tenant('Outro João', 'pizzaria-do-joao', NULL);
-- Esperado: ERROR unique_violation "O link personalizado 'pizzaria-do-joao' já está em uso..."
--
-- Teste 3: nome vazio
-- SELECT setup_new_tenant('', 'qualquer-slug', NULL);
-- Esperado: ERROR invalid_parameter_value "O nome do restaurante não pode ser vazio."
--
-- Teste 4: slug com caracteres especiais (será sanitizado)
-- SELECT normalize_slug('  Café & Bar!! ');
-- Esperado: "caf-bar"
-- =============================================================================
