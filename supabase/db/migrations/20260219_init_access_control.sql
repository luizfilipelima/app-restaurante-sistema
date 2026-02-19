-- =============================================================================
-- Migration: Controle de Acesso (RBAC) + Feature Flags + Planos SaaS
-- Data: 2026-02-19
-- Referência: ARQUITETURA_PRODUTO_E_PLANOS.md
--
-- Estrutura criada:
--   1. ENUM  restaurant_role_type
--   2. TABLE subscription_plans
--   3. TABLE features
--   4. TABLE plan_features           (join table: plano <-> feature)
--   5. TABLE restaurant_subscriptions
--   6. TABLE restaurant_feature_overrides
--   7. TABLE restaurant_user_roles
--   8. FUNCTION + TRIGGERS updated_at
--   9. INDEXES
--  10. RLS (Row Level Security)
--  11. SEED: planos, features e vínculos plan_features
-- =============================================================================

-- ===== HELPER: garante que a extensão uuid está disponível ===================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- SEÇÃO 1 — TIPOS / ENUMs
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE restaurant_role_type AS ENUM (
    'owner',     -- Proprietário (acesso total ao restaurante, equivale ao restaurant_admin atual)
    'manager',   -- Gerente operacional (sem acesso a dados financeiros sensíveis/reset)
    'waiter',    -- Garçom (pedidos + mesas, sem editar cardápio)
    'kitchen',   -- Cozinheiro (apenas KDS)
    'cashier'    -- Operador de caixa / buffet
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- SEÇÃO 2 — TABELA: subscription_plans
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,   -- identificador técnico: 'core' | 'standard' | 'enterprise'
  label       TEXT        NOT NULL,          -- nome de exibição: 'Básico', 'Standard', 'Enterprise'
  description TEXT,
  price_brl   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_pyg   NUMERIC(12, 0) NOT NULL DEFAULT 0,
  sort_order  INTEGER     NOT NULL DEFAULT 0, -- ordem de exibição na landing page
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  subscription_plans              IS 'Planos de assinatura disponíveis no SaaS';
COMMENT ON COLUMN subscription_plans.name         IS 'Slug único do plano (core, standard, enterprise)';
COMMENT ON COLUMN subscription_plans.price_brl    IS 'Preço mensal em Reais (BRL)';
COMMENT ON COLUMN subscription_plans.price_pyg    IS 'Preço mensal em Guaraníes (PYG) — mercado paraguaio';


-- =============================================================================
-- SEÇÃO 3 — TABELA: features
-- =============================================================================

CREATE TABLE IF NOT EXISTS features (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag        TEXT        NOT NULL UNIQUE,  -- ex: 'feature_bcg_matrix'
  label       TEXT        NOT NULL,         -- nome legível para o Super Admin
  description TEXT,
  module      TEXT        NOT NULL,         -- agrupador: 'menu_publico', 'pedidos', 'dashboard', etc.
  min_plan    TEXT        NOT NULL DEFAULT 'core'  -- plan.name mínimo necessário (denormalização para consultas rápidas)
                          CHECK (min_plan IN ('core', 'standard', 'enterprise')),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  features          IS 'Catálogo de todas as features controláveis por flag';
COMMENT ON COLUMN features.flag     IS 'Identificador único da feature (usado no código frontend)';
COMMENT ON COLUMN features.module   IS 'Módulo funcional ao qual a feature pertence';
COMMENT ON COLUMN features.min_plan IS 'Plano mínimo para acesso (denormalizado para query direta)';


-- =============================================================================
-- SEÇÃO 4 — TABELA: plan_features  (join: plano <-> feature)
-- =============================================================================
-- Garante flexibilidade total para criar bundles personalizados no futuro.
-- Um plano inclui múltiplas features; a tabela diz explicitamente quais.

CREATE TABLE IF NOT EXISTS plan_features (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id     UUID        NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_id  UUID        NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, feature_id)
);

COMMENT ON TABLE plan_features IS 'Vínculo explícito entre planos e features incluídas';

CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id    ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature_id ON plan_features(feature_id);


-- =============================================================================
-- SEÇÃO 5 — TABELA: restaurant_subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS restaurant_subscriptions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id     UUID        NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id           UUID        NOT NULL REFERENCES subscription_plans(id),
  status            TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'trial', 'suspended', 'cancelled')),
  trial_ends_at     TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  notes             TEXT,        -- anotações internas do Super Admin
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  restaurant_subscriptions                  IS 'Assinatura ativa de cada restaurante';
COMMENT ON COLUMN restaurant_subscriptions.status           IS 'active | trial | suspended | cancelled';
COMMENT ON COLUMN restaurant_subscriptions.trial_ends_at    IS 'Data de expiração do período trial (nullable)';

CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_restaurant ON restaurant_subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_plan       ON restaurant_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_status     ON restaurant_subscriptions(status);


-- =============================================================================
-- SEÇÃO 6 — TABELA: restaurant_feature_overrides
-- =============================================================================
-- Permite ao Super Admin habilitar ou desabilitar features individualmente
-- para um restaurante, independentemente do plano contratado (add-ons / bloqueios).

CREATE TABLE IF NOT EXISTS restaurant_feature_overrides (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  feature_id    UUID        NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  is_enabled    BOOLEAN     NOT NULL DEFAULT true,  -- true = forçar ON; false = forçar OFF
  reason        TEXT,         -- nota interna explicando o motivo do override
  expires_at    TIMESTAMPTZ, -- opcional: override com data de expiração
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, feature_id)
);

COMMENT ON TABLE  restaurant_feature_overrides            IS 'Exceções manuais de features por restaurante (add-ons ou bloqueios)';
COMMENT ON COLUMN restaurant_feature_overrides.is_enabled IS 'true = habilitar mesmo sem plano; false = bloquear mesmo com plano';
COMMENT ON COLUMN restaurant_feature_overrides.expires_at IS 'Se preenchido, o override expira automaticamente nesta data';

CREATE INDEX IF NOT EXISTS idx_feature_overrides_restaurant ON restaurant_feature_overrides(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_feature_overrides_feature    ON restaurant_feature_overrides(feature_id);


-- =============================================================================
-- SEÇÃO 7 — TABELA: restaurant_user_roles
-- =============================================================================
-- Vínculos de usuários da plataforma com cargos dentro de um restaurante.
-- Separa o role SaaS (users.role) do cargo operacional (restaurant_user_roles.role).

CREATE TABLE IF NOT EXISTS restaurant_user_roles (
  id            UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID                 NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       UUID                 NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          restaurant_role_type NOT NULL,
  is_active     BOOLEAN              NOT NULL DEFAULT true,
  invited_by    UUID                 REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, user_id)  -- um usuário tem apenas um cargo por restaurante
);

COMMENT ON TABLE  restaurant_user_roles           IS 'Cargo operacional de cada usuário dentro de um restaurante';
COMMENT ON COLUMN restaurant_user_roles.role      IS 'owner | manager | waiter | kitchen | cashier';
COMMENT ON COLUMN restaurant_user_roles.is_active IS 'Permite revogar acesso sem deletar o registro';

CREATE INDEX IF NOT EXISTS idx_restaurant_user_roles_restaurant ON restaurant_user_roles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_user_roles_user       ON restaurant_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_user_roles_role       ON restaurant_user_roles(role);


-- =============================================================================
-- SEÇÃO 8 — TRIGGER: updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subscription_plans',
    'features',
    'restaurant_subscriptions',
    'restaurant_feature_overrides',
    'restaurant_user_roles'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || t || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END $$;


-- =============================================================================
-- SEÇÃO 9 — RLS (Row Level Security)
-- =============================================================================

ALTER TABLE subscription_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE features                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_feature_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_user_roles           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER VIEW (inline): resolve o restaurante do usuário autenticado
-- Usada nas políticas abaixo para evitar repetição.
-- ---------------------------------------------------------------------------

-- subscription_plans: leitura pública para qualquer autenticado
DROP POLICY IF EXISTS "Autenticados podem ler planos" ON subscription_plans;
CREATE POLICY "Autenticados podem ler planos"
  ON subscription_plans FOR SELECT
  USING (auth.role() = 'authenticated');

-- subscription_plans: somente super_admin gerencia
DROP POLICY IF EXISTS "Super admin gerencia planos" ON subscription_plans;
CREATE POLICY "Super admin gerencia planos"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- features: leitura pública para autenticados; escrita apenas super_admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ler features" ON features;
CREATE POLICY "Autenticados podem ler features"
  ON features FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admin gerencia features" ON features;
CREATE POLICY "Super admin gerencia features"
  ON features FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- plan_features: leitura pública para autenticados; escrita apenas super_admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ler plan_features" ON plan_features;
CREATE POLICY "Autenticados podem ler plan_features"
  ON plan_features FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admin gerencia plan_features" ON plan_features;
CREATE POLICY "Super admin gerencia plan_features"
  ON plan_features FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- restaurant_subscriptions: restaurante vê a própria; super_admin vê todas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Restaurante lê própria assinatura" ON restaurant_subscriptions;
CREATE POLICY "Restaurante lê própria assinatura"
  ON restaurant_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_subscriptions.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Super admin gerencia assinaturas" ON restaurant_subscriptions;
CREATE POLICY "Super admin gerencia assinaturas"
  ON restaurant_subscriptions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- restaurant_feature_overrides: restaurante lê os próprios; super_admin gerencia
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Restaurante lê próprios overrides" ON restaurant_feature_overrides;
CREATE POLICY "Restaurante lê próprios overrides"
  ON restaurant_feature_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_feature_overrides.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Super admin gerencia overrides" ON restaurant_feature_overrides;
CREATE POLICY "Super admin gerencia overrides"
  ON restaurant_feature_overrides FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- restaurant_user_roles: usuários do restaurante lêem; admin/super gerenciam
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários lêem roles do próprio restaurante" ON restaurant_user_roles;
CREATE POLICY "Usuários lêem roles do próprio restaurante"
  ON restaurant_user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id)
        OR u.role = 'super_admin'
        OR u.id = restaurant_user_roles.user_id  -- o próprio usuário vê seu cargo
      )
    )
  );

DROP POLICY IF EXISTS "Admin ou super_admin gerenciam roles" ON restaurant_user_roles;
CREATE POLICY "Admin ou super_admin gerenciam roles"
  ON restaurant_user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );


-- =============================================================================
-- SEÇÃO 10 — FUNÇÃO RPC: restaurant_has_feature(restaurant_id, flag)
-- =============================================================================
-- Usada pelo frontend (via supabase.rpc) para verificar se um restaurante
-- tem acesso a uma feature específica, considerando plano + overrides.
-- Lógica: override_off > override_on > plano contratado

CREATE OR REPLACE FUNCTION restaurant_has_feature(
  p_restaurant_id UUID,
  p_flag          TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- 1) Verifica override manual para este restaurante (tem prioridade sobre o plano)
    (
      SELECT rfo.is_enabled
      FROM   restaurant_feature_overrides rfo
      JOIN   features f ON f.id = rfo.feature_id
      WHERE  rfo.restaurant_id = p_restaurant_id
      AND    f.flag            = p_flag
      AND    (rfo.expires_at IS NULL OR rfo.expires_at > NOW())
      LIMIT  1
    ),
    -- 2) Verifica se a feature está incluída no plano contratado
    (
      SELECT true
      FROM   restaurant_subscriptions rs
      JOIN   plan_features            pf ON pf.plan_id    = rs.plan_id
      JOIN   features                 f  ON f.id          = pf.feature_id
      WHERE  rs.restaurant_id = p_restaurant_id
      AND    f.flag           = p_flag
      AND    rs.status        IN ('active', 'trial')
      LIMIT  1
    ),
    -- 3) Default: sem acesso
    false
  );
$$;

COMMENT ON FUNCTION restaurant_has_feature IS
  'Verifica se um restaurante tem acesso a uma feature. Leva em conta overrides manuais com prioridade sobre o plano.';


-- =============================================================================
-- SEÇÃO 11 — SEED: PLANOS
-- =============================================================================

INSERT INTO subscription_plans (name, label, description, price_brl, price_pyg, sort_order)
VALUES
  (
    'core',
    'Core',
    'Cardápio digital, recebimento de pedidos, KDS e KPIs essenciais. Ideal para começar.',
    0.00,
    0,
    1
  ),
  (
    'standard',
    'Standard',
    'Tudo do Core + mesas com QR, delivery, entregadores, WhatsApp, analytics e impressão térmica.',
    149.90,
    390000,
    2
  ),
  (
    'enterprise',
    'Enterprise',
    'Tudo do Standard + BI avançado (BCG, Churn), Buffet offline, inventário com CMV e RBAC completo.',
    349.90,
    900000,
    3
  )
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- SEÇÃO 12 — SEED: FEATURES
-- =============================================================================
-- Formato: (flag, label, description, module, min_plan)

INSERT INTO features (flag, label, description, module, min_plan) VALUES

  -- ── MÓDULO: CARDÁPIO PÚBLICO ───────────────────────────────────────────────
  ('feature_public_menu',       'Cardápio Interativo Público',   'Exibir produtos e adicionar ao carrinho no cardápio online',              'menu_publico',   'core'),
  ('feature_menu_view_only',    'Cardápio Somente Leitura',      'Versão vitrine do cardápio sem opção de compra',                          'menu_publico',   'core'),
  ('feature_table_menu',        'Cardápio por Mesa (QR)',        'Cardápio acessado via QR individual por mesa com chamada de garçom',      'menu_publico',   'standard'),
  ('feature_brand_colors',      'Personalização de Cores',       'Cor primária e secundária no cardápio público',                          'menu_publico',   'standard'),
  ('feature_multilanguage',     'Múltiplos Idiomas (pt/es)',     'Interface do cardápio em português e espanhol',                          'menu_publico',   'standard'),
  ('feature_multicurrency',     'Múltiplas Moedas (BRL/PYG)',   'Exibir preços em Real ou Guaraní',                                       'menu_publico',   'standard'),
  ('feature_qr_codes',          'Geração de QR Codes',          'Gerar e baixar QR Code para cardápio geral e por mesa',                  'menu_publico',   'standard'),
  ('feature_custom_logo',       'Logo Personalizado',            'Upload da logo própria exibida no cardápio público',                     'menu_publico',   'standard'),

  -- ── MÓDULO: PEDIDOS ────────────────────────────────────────────────────────
  ('feature_orders_kanban',         'Kanban de Pedidos',                 'Visualização kanban de pedidos ativos (Pendente, Preparo, Pronto, Entrega)',  'pedidos', 'core'),
  ('feature_order_status_update',   'Atualizar Status de Pedido',        'Avançar ou retroceder o status de um pedido manualmente',                    'pedidos', 'core'),
  ('feature_order_cancel',          'Cancelar Pedido',                   'Cancelamento manual de pedidos com diálogo de confirmação',                  'pedidos', 'core'),
  ('feature_table_orders',          'Pedidos de Mesa',                   'Receber pedidos registrados diretamente (sem WhatsApp) via modo mesa',       'pedidos', 'standard'),
  ('feature_delivery_orders',       'Canal Delivery',                    'Canal de pedidos com entrega em domicílio',                                  'pedidos', 'standard'),
  ('feature_courier_assignment',    'Atribuição de Entregador',          'Vincular um entregador a um pedido de delivery no kanban',                   'pedidos', 'standard'),
  ('feature_whatsapp_notifications','Notificação WhatsApp ao Cliente',   'Enviar link de atualização de status do pedido via WhatsApp',                'pedidos', 'standard'),
  ('feature_thermal_print',         'Impressão Térmica Automática',      'Auto-imprimir cupom térmico ao receber novo pedido',                         'pedidos', 'standard'),
  ('feature_orders_export',         'Exportar Pedidos (CSV)',            'Download do histórico de pedidos concluídos em CSV',                         'pedidos', 'standard'),

  -- ── MÓDULO: CARDÁPIO ADMINISTRATIVO (MENU) ────────────────────────────────
  ('feature_product_management',  'CRUD Básico de Produtos',           'Criar, editar e excluir produtos do cardápio',                     'cardapio_admin', 'core'),
  ('feature_product_toggle',      'Ativar/Desativar Produto',          'Alternar disponibilidade de produto em tempo real no cardápio',   'cardapio_admin', 'core'),
  ('feature_categories',          'Gerenciamento de Categorias',       'CRUD de categorias do cardápio',                                  'cardapio_admin', 'core'),
  ('feature_subcategories',       'Subcategorias',                     'Agrupamento de produtos em subcategorias dentro de uma categoria','cardapio_admin', 'standard'),
  ('feature_drag_drop_reorder',   'Reordenamento Drag & Drop',         'Arrastar e soltar para reordenar produtos e categorias',          'cardapio_admin', 'standard'),
  ('feature_product_duplicate',   'Duplicar Produto',                  'Criar cópia de um produto existente com um clique',              'cardapio_admin', 'standard'),
  ('feature_pizza_config',        'Configuração de Pizza',             'Gerenciar tamanhos, massas e bordas recheadas',                  'cardapio_admin', 'standard'),
  ('feature_marmita_config',      'Configuração de Marmita',          'Gerenciar tamanhos, proteínas e acompanhamentos de marmita',     'cardapio_admin', 'standard'),
  ('feature_product_images',      'Upload de Imagem de Produto',       'Subir foto do produto (converte automaticamente para WebP)',     'cardapio_admin', 'standard'),

  -- ── MÓDULO: BUFFET / COMANDAS ──────────────────────────────────────────────
  ('feature_buffet_module',    'Módulo Buffet Completo',          'Comandas, scanner, produtos por peso e fechamento de comanda',    'buffet', 'enterprise'),
  ('feature_offline_sync',     'Operação Offline (IndexedDB)',    'Funciona sem internet e sincroniza ao reconectar',                'buffet', 'enterprise'),
  ('feature_barcode_scanner',  'Scanner de Código de Barras',    'Leitura de SKU de produtos via leitor de código de barras',      'buffet', 'enterprise'),
  ('feature_weight_products',  'Produtos por Peso',              'Venda com cálculo automático por grama',                         'buffet', 'enterprise'),

  -- ── MÓDULO: MESAS ──────────────────────────────────────────────────────────
  ('feature_tables',               'Gerenciamento de Mesas',         'CRUD de mesas do restaurante',                                         'mesas', 'standard'),
  ('feature_table_qr',             'QR Code por Mesa',               'Gerar QR individual para cada mesa',                                   'mesas', 'standard'),
  ('feature_waiter_call',          'Chamada de Garçom',              'Cliente chama o atendimento pelo celular via cardápio de mesa',         'mesas', 'standard'),
  ('feature_waiter_call_history',  'Histórico de Chamadas',          'Log de todas as chamadas de garçom realizadas',                        'mesas', 'standard'),

  -- ── MÓDULO: ENTREGADORES (COURIERS) ───────────────────────────────────────
  ('feature_couriers',         'Gestão de Entregadores',        'CRUD de entregadores (nome, telefone, placa)',     'entregadores', 'standard'),
  ('feature_courier_status',   'Status do Entregador',          'Disponível / Ocupado / Offline por entregador',   'entregadores', 'standard'),

  -- ── MÓDULO: ZONAS DE ENTREGA ───────────────────────────────────────────────
  ('feature_delivery_zones',        'Zonas de Entrega com Taxa',         'CRUD de regiões/bairros com taxa de entrega',                          'delivery', 'standard'),
  ('feature_delivery_zone_select',  'Seleção de Zona no Checkout',       'Cliente seleciona o bairro no checkout e recebe a taxa automaticamente','delivery', 'standard'),

  -- ── MÓDULO: INVENTÁRIO E FINANCEIRO ───────────────────────────────────────
  ('feature_inventory_cost',        'Inventário com Preço de Custo',    'Visualizar e gerenciar preço de custo, CMV e margem de lucro',  'inventario', 'enterprise'),
  ('feature_products_csv_import',   'Importar Produtos via CSV',         'Upload em massa de produtos via planilha CSV',                  'inventario', 'enterprise'),
  ('feature_products_csv_export',   'Exportar Produtos via CSV',         'Download da base de produtos em CSV',                          'inventario', 'enterprise'),

  -- ── MÓDULO: BI E ANALYTICS (DASHBOARD) ────────────────────────────────────
  ('feature_kpis_basic',           'KPIs Básicos',                       'Total de pedidos, faturamento e ticket médio',                            'dashboard', 'core'),
  ('feature_revenue_chart',        'Gráfico de Faturamento Diário',      'Tendência de receita ao longo do tempo selecionado',                     'dashboard', 'standard'),
  ('feature_channel_analytics',    'Análise por Canal',                  'Métricas segmentadas por Delivery, Mesa, Retirada e Buffet',             'dashboard', 'standard'),
  ('feature_payment_analytics',    'Análise de Métodos de Pagamento',    'Distribuição do faturamento por forma de pagamento',                     'dashboard', 'standard'),
  ('feature_dashboard_export',     'Exportar Relatórios (CSV/XLSX)',     'Download dos dados do dashboard em CSV e Excel',                         'dashboard', 'standard'),
  ('feature_retention_analytics',  'Análise de Retenção de Clientes',   'Clientes recorrentes vs. novos e taxa de retenção',                      'dashboard', 'enterprise'),
  ('feature_churn_recovery',       'Risco de Churn + Recuperação',      'Lista de clientes com risco de abandono com link WhatsApp direto',       'dashboard', 'enterprise'),
  ('feature_bcg_matrix',           'Matriz BCG de Produtos',            'Classificação estratégica do cardápio em Estrelas, Vacas, Interrogações e Abacaxis', 'dashboard', 'enterprise'),
  ('feature_buffet_analytics',     'Métricas de Buffet no Dashboard',   'KPIs específicos do módulo buffet integrados ao dashboard',              'dashboard', 'enterprise'),
  ('feature_advanced_date_filter', 'Filtros Avançados de Período',      'Filtrar por 365 dias ou histórico total (max)',                          'dashboard', 'enterprise'),

  -- ── MÓDULO: COZINHA (KDS) ──────────────────────────────────────────────────
  ('feature_kitchen_display',  'Display de Cozinha (KDS)',      'Tela de preparação em tempo real com cards de pedidos',    'cozinha', 'core'),
  ('feature_realtime_orders',  'Atualização em Tempo Real',     'Supabase Realtime — pedidos aparecem imediatamente na tela','cozinha', 'core'),

  -- ── MÓDULO: CONFIGURAÇÕES ──────────────────────────────────────────────────
  ('feature_settings_basic',      'Configurações Básicas',          'Nome, telefone, WhatsApp e horários de funcionamento',        'configuracoes', 'core'),
  ('feature_print_settings',      'Configuração de Impressão',      'Definir papel 58mm/80mm e auto-imprimir',                     'configuracoes', 'standard'),
  ('feature_brand_customization', 'Personalização de Marca',        'Logo, cor primária e secundária do cardápio público',         'configuracoes', 'standard'),
  ('feature_locale_settings',     'Configurações de Localidade',    'Moeda (BRL/PYG) e idioma (pt/es) do cardápio',               'configuracoes', 'standard')

ON CONFLICT (flag) DO NOTHING;


-- =============================================================================
-- SEÇÃO 13 — SEED: plan_features  (vínculo plano <-> feature)
-- =============================================================================
-- Regra: Core recebe features core; Standard recebe core+standard; Enterprise recebe tudo.

INSERT INTO plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM   subscription_plans p
CROSS JOIN features f
WHERE
  -- Plano Core: apenas features 'core'
  (p.name = 'core'       AND f.min_plan = 'core')
  OR
  -- Plano Standard: features 'core' + 'standard'
  (p.name = 'standard'   AND f.min_plan IN ('core', 'standard'))
  OR
  -- Plano Enterprise: todas as features
  (p.name = 'enterprise' AND f.min_plan IN ('core', 'standard', 'enterprise'))
ON CONFLICT (plan_id, feature_id) DO NOTHING;


-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================

DO $$
DECLARE
  v_plans    INT;
  v_features INT;
  v_links    INT;
BEGIN
  SELECT COUNT(*) INTO v_plans    FROM subscription_plans;
  SELECT COUNT(*) INTO v_features FROM features;
  SELECT COUNT(*) INTO v_links    FROM plan_features;

  RAISE NOTICE '=== Migration 20260219_init_access_control concluída ===';
  RAISE NOTICE '  subscription_plans  : % registros', v_plans;
  RAISE NOTICE '  features            : % registros', v_features;
  RAISE NOTICE '  plan_features       : % vínculos',  v_links;
  RAISE NOTICE '  RBAC enum           : restaurant_role_type criado';
  RAISE NOTICE '  Tabelas RLS         : habilitadas em 6 tabelas';
  RAISE NOTICE '  RPC                 : restaurant_has_feature() disponível';
END $$;
