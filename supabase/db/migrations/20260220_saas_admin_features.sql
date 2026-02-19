-- =============================================================================
-- Migration: Fase 2 — Funcionalidades do Painel Super Admin (SaaS BI)
-- Data      : 2026-02-20
-- Depende de: 20260219_init_access_control.sql
--
-- Seções desta migration:
--   1. SOFT DELETE na tabela restaurants (coluna deleted_at)
--   2. RLS UPDATE para super_admin em subscription_plans
--   3. FUNCTION get_saas_metrics() — BI financeiro do SaaS
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1 — SOFT DELETE em `restaurants`
-- =============================================================================
--
-- Por que soft delete?
--   Apagar fisicamente um restaurante quebraria o histórico de pedidos, faturas
--   e métricas de BI (orders, restaurant_subscriptions, etc. referenciam o id).
--   Com soft delete, o sistema filtra WHERE deleted_at IS NULL nas queries de
--   listagem, mantendo integridade total dos dados históricos.
--
-- Como usar:
--   — Listar ativos:   SELECT * FROM restaurants WHERE deleted_at IS NULL;
--   — Deletar (app):   UPDATE restaurants SET deleted_at = NOW() WHERE id = $1;
--   — Restaurar:       UPDATE restaurants SET deleted_at = NULL WHERE id = $1;
--   — Ver todos:       SELECT * FROM restaurants;  (sem filtro — só Super Admin)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN restaurants.deleted_at IS
  'Soft delete: quando preenchido, o restaurante é tratado como excluído pelo sistema. '
  'Não remove dados históricos (pedidos, métricas, assinaturas).';

-- Índice parcial: acelera a query mais comum (listar restaurantes ativos).
-- Índice parcial só indexa linhas onde deleted_at IS NULL, custando menos espaço.
CREATE INDEX IF NOT EXISTS idx_restaurants_active
  ON restaurants (id)
  WHERE deleted_at IS NULL;

-- Índice para queries de auditoria/admin que filtram pela data de deleção.
CREATE INDEX IF NOT EXISTS idx_restaurants_deleted_at
  ON restaurants (deleted_at)
  WHERE deleted_at IS NOT NULL;


-- =============================================================================
-- SEÇÃO 2 — RLS: super_admin pode atualizar planos (preço, label, descrição)
-- =============================================================================
--
-- O arquivo 20260219_init_access_control.sql criou SELECT policies para todos
-- os usuários autenticados em subscription_plans. Esta seção adiciona a policy
-- de UPDATE exclusiva para super_admin, permitindo ajustar preços e rótulos
-- diretamente pelo painel administrativo do SaaS.
--
-- Nota sobre restrição de colunas:
--   O PostgreSQL não suporta restrição de colunas diretamente em policies RLS.
--   A restrição de quais colunas o super_admin pode alterar deve ser aplicada
--   no nível de código da aplicação. O nome técnico (slug) `name` não deve ser
--   alterado após o sistema estar em produção para não quebrar feature flags.

DROP POLICY IF EXISTS "Super admin can update subscription plans" ON subscription_plans;
CREATE POLICY "Super admin can update subscription plans"
  ON subscription_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Garante que INSERT e DELETE de planos também é exclusivo do super_admin
-- (evitar planos órfãos criados por bug ou acesso indevido).
DROP POLICY IF EXISTS "Super admin can insert subscription plans" ON subscription_plans;
CREATE POLICY "Super admin can insert subscription plans"
  ON subscription_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can delete subscription plans" ON subscription_plans;
CREATE POLICY "Super admin can delete subscription plans"
  ON subscription_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );


-- =============================================================================
-- SEÇÃO 3 — FUNCTION: get_saas_metrics()
-- =============================================================================
--
-- Retorna um JSON com as métricas financeiras (BI) do SaaS, consumido pelo
-- painel Super Admin para exibir MRR, crescimento e distribuição de planos.
--
-- Métricas calculadas:
--   total_mrr          — Receita Mensal Recorrente (R$): soma dos preços dos
--                        planos de todos os restaurantes ativos e não deletados
--                        com assinatura ativa ou em trial.
--   total_tenants      — Total de restaurantes ativos (deleted_at IS NULL).
--   new_tenants_7d     — Novos restaurantes criados nos últimos 7 dias.
--   revenue_by_plan    — Array JSON por plano: [{ plan_name, plan_label,
--                        tenant_count, monthly_revenue_brl }]
--
-- Segurança:
--   SECURITY DEFINER   — Executa com os privilégios do criador (superuser),
--                        contornando as RLS das tabelas subjacentes.
--                        A verificação de quem pode chamar fica no frontend
--                        (só exibido para usuários com role = 'super_admin').

CREATE OR REPLACE FUNCTION get_saas_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_mrr        NUMERIC(12, 2);
  v_total_tenants    BIGINT;
  v_new_tenants_7d   BIGINT;
  v_revenue_by_plan  JSONB;
BEGIN

  -- ── 1. MRR (Monthly Recurring Revenue) ──────────────────────────────────
  -- Soma o preço do plano de cada restaurante ativo com assinatura 'active'
  -- ou 'trial'. Restaurantes sem assinatura cadastrada não contribuem com MRR.
  SELECT COALESCE(SUM(sp.price_brl), 0)
    INTO v_total_mrr
    FROM restaurant_subscriptions rs
    JOIN subscription_plans sp ON sp.id = rs.plan_id
    JOIN restaurants         r  ON r.id  = rs.restaurant_id
   WHERE r.deleted_at IS NULL
     AND r.is_active   = TRUE
     AND rs.status    IN ('active', 'trial');

  -- ── 2. Total de tenants ativos ───────────────────────────────────────────
  -- Conta todos os restaurantes não deletados (independente de assinatura).
  SELECT COUNT(*)
    INTO v_total_tenants
    FROM restaurants
   WHERE deleted_at IS NULL;

  -- ── 3. Novos tenants nos últimos 7 dias ──────────────────────────────────
  SELECT COUNT(*)
    INTO v_new_tenants_7d
    FROM restaurants
   WHERE deleted_at IS NULL
     AND created_at >= (NOW() - INTERVAL '7 days');

  -- ── 4. Receita e contagem por plano ──────────────────────────────────────
  -- Para cada plano ativo (mesmo sem nenhum assinante), exibe:
  --   tenant_count          — número de restaurantes ativos neste plano
  --   monthly_revenue_brl   — tenant_count × price_brl (receita bruta estimada)
  -- Ordena pelo sort_order do plano (Core → Standard → Enterprise).
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'plan_name',           sp.name,
        'plan_label',          sp.label,
        'tenant_count',        COALESCE(stats.cnt, 0),
        'monthly_revenue_brl', ROUND(COALESCE(stats.cnt, 0) * sp.price_brl, 2)
      )
      ORDER BY sp.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_revenue_by_plan
    FROM subscription_plans sp
    LEFT JOIN (
      -- Subquery: contagem de assinantes ativos por plano
      SELECT rs.plan_id,
             COUNT(*) AS cnt
        FROM restaurant_subscriptions rs
        JOIN restaurants r ON r.id = rs.restaurant_id
       WHERE r.deleted_at IS NULL
         AND r.is_active   = TRUE
         AND rs.status    IN ('active', 'trial')
       GROUP BY rs.plan_id
    ) stats ON stats.plan_id = sp.id
   WHERE sp.is_active = TRUE;

  -- ── Retorno ──────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'total_mrr',       v_total_mrr,
    'total_tenants',   v_total_tenants,
    'new_tenants_7d',  v_new_tenants_7d,
    'revenue_by_plan', v_revenue_by_plan
  );

END;
$$;

COMMENT ON FUNCTION get_saas_metrics IS
  'Retorna métricas financeiras do SaaS (MRR, tenants ativos, crescimento 7d, '
  'receita por plano). Deve ser chamada apenas por usuários super_admin.';


-- =============================================================================
-- SEÇÃO 4 — GRANT de execução da RPC
-- =============================================================================
--
-- Permite que usuários autenticados (authenticated) chamem a função via Supabase.
-- O controle de "quem deve ver" o resultado é feito no frontend (verificando
-- se user.role === 'super_admin' antes de exibir os dados).

REVOKE ALL ON FUNCTION get_saas_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_saas_metrics() TO authenticated;


-- =============================================================================
-- CONFIRMAÇÃO
-- =============================================================================

SELECT jsonb_build_object(
  'secao_1_soft_delete',        'deleted_at adicionado em restaurants',
  'secao_2_rls_plans',          'Policies UPDATE/INSERT/DELETE para super_admin em subscription_plans',
  'secao_3_rpc_saas_metrics',   'Função get_saas_metrics() criada',
  'idempotente',                true,
  'aplicado_em',                NOW()
) AS migration_status;
