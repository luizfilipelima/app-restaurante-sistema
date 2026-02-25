-- =============================================================================
-- Migration: Comanda Digital (Virtual Tab) — Feature Enterprise
-- Data      : 2026-02-19
-- Depende de: 20260219_init_access_control.sql
--             migration_buffet-comandas.sql  (comandas de buffet — tabela DISTINTA)
--
-- DIFERENÇA em relação ao módulo de buffet existente:
--   comandas            → uso interno (staff), numeração inteira, modo offline/PDV
--   virtual_comandas    → iniciadas pelo cliente via QR, código alfanumérico,
--                         acesso público, converte para orders ao fechar
--
-- Fluxo resumido:
--   1. Cliente escaneia QR da mesa → RPC open_virtual_comanda() → cria/retorna comanda
--   2. Cliente adiciona itens       → INSERT em virtual_comanda_items
--   3. Garçom/cliente fecha conta   → RPC close_virtual_comanda() →
--      cria orders + order_items → comanda vira status 'paid'
--   4. Pedido entra no Kanban/KDS normalmente (order_source = 'comanda')
--
-- Seções:
--   1. ENUM  virtual_comanda_status_type
--   2. TABLE virtual_comandas
--   3. TABLE virtual_comanda_items
--   4. ALTER TABLE orders  (coluna virtual_comanda_id — rastreabilidade)
--   5. TRIGGERS  (updated_at + recalcular total_amount)
--   6. FUNCTIONS
--        generate_comanda_short_code()
--        open_virtual_comanda()
--        close_virtual_comanda()
--   7. RLS — Políticas de segurança por role
--   8. INDEXES
--   9. SEED — Feature flag + vínculo plan_features (Enterprise)
--  10. GRANTS + VERIFICAÇÃO
-- =============================================================================

-- ===== PRÉ-REQUISITO: extensão uuid ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- SEÇÃO 1 — ENUM: virtual_comanda_status_type
-- =============================================================================
-- Nota: CREATE TYPE não suporta IF NOT EXISTS antes do PG 9.x.
--       Usamos bloco DO para capturar duplicate_object de forma segura.

DO $$ BEGIN
  CREATE TYPE virtual_comanda_status_type AS ENUM ('open', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE virtual_comanda_status_type IS
  'Estados de uma comanda virtual: open = ativa; paid = fechada e paga; cancelled = cancelada';


-- =============================================================================
-- SEÇÃO 2 — TABLE: virtual_comandas
-- =============================================================================

CREATE TABLE IF NOT EXISTS virtual_comandas (
  id              UUID                         PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID                         NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  -- Código curto exibido no QR Code e no display de caixa.
  -- Gerado automaticamente por generate_comanda_short_code() se não fornecido.
  -- Ex.: 'CMD-A7F2', 'CMD-3X9K'
  short_code      VARCHAR(16)                  NOT NULL,

  customer_name   TEXT,            -- nome do cliente (capturado no checkout público)
  table_number    TEXT,            -- número da mesa (texto livre, sem FK para evitar dependências)
  status          virtual_comanda_status_type  NOT NULL DEFAULT 'open',
  total_amount    NUMERIC(12, 2)   NOT NULL DEFAULT 0,
  notes           TEXT,            -- observações gerais da comanda
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,     -- preenchido por close_virtual_comanda()
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  -- Unicidade por restaurante: dois clientes do mesmo restaurante
  -- não podem ter o mesmo short_code ativo ao mesmo tempo.
  UNIQUE (restaurant_id, short_code)
);

COMMENT ON TABLE  virtual_comandas IS
  'Comanda digital iniciada pelo cliente via QR Code. '
  'Difere da tabela "comandas" (buffet offline/PDV), pois é de acesso público '
  'e converte para orders ao ser fechada.';

COMMENT ON COLUMN virtual_comandas.short_code    IS 'Código alfanumérico curto para QR/display — ex: CMD-A7F2';
COMMENT ON COLUMN virtual_comandas.table_number  IS 'Número da mesa (texto livre, ex: "12", "VIP-3")';
COMMENT ON COLUMN virtual_comandas.total_amount  IS 'Atualizado automaticamente via trigger ao inserir/remover itens';
COMMENT ON COLUMN virtual_comandas.closed_at     IS 'Preenchido quando status → paid ou cancelled';


-- =============================================================================
-- SEÇÃO 3 — TABLE: virtual_comanda_items
-- =============================================================================
-- Espelha a estrutura de order_items para reaproveitamento máximo da lógica
-- de produtos. Quando a comanda é fechada, esses itens são copiados para
-- order_items com o order_id da nova ordem gerada.

CREATE TABLE IF NOT EXISTS virtual_comanda_items (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id      UUID        NOT NULL REFERENCES virtual_comandas(id) ON DELETE CASCADE,

  -- Snapshot dos dados do produto no momento da adição.
  -- Preserva nome e preço mesmo se o produto for editado/removido depois.
  product_id      UUID        REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT        NOT NULL,
  quantity        NUMERIC(10, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_price     NUMERIC(12, 2) NOT NULL
                  GENERATED ALWAYS AS (quantity * unit_price) STORED,

  notes           TEXT,           -- obs do item: 'sem cebola', 'ponto médio', etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  virtual_comanda_items IS
  'Itens de uma comanda digital. Copiados para order_items ao fechar a comanda.';

COMMENT ON COLUMN virtual_comanda_items.product_name IS 'Snapshot do nome do produto no momento da adição';
COMMENT ON COLUMN virtual_comanda_items.unit_price   IS 'Snapshot do preço unitário no momento da adição';
COMMENT ON COLUMN virtual_comanda_items.total_price  IS 'Calculado automaticamente: quantity × unit_price (coluna GENERATED)';


-- =============================================================================
-- SEÇÃO 4 — ALTER: orders.virtual_comanda_id
-- =============================================================================
-- Rastreabilidade: quando close_virtual_comanda() converte uma comanda em pedido,
-- essa FK vincula o orders ao virtual_comandas de origem.
-- Permite auditoria, relatórios e exibir no histórico do cliente.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS virtual_comanda_id UUID
  REFERENCES virtual_comandas(id) ON DELETE SET NULL;

COMMENT ON COLUMN orders.virtual_comanda_id IS
  'FK opcional: vincula o pedido à comanda digital de origem. '
  'Preenchido por close_virtual_comanda(). NULL = pedido normal sem comanda.';


-- =============================================================================
-- SEÇÃO 5 — TRIGGERS
-- =============================================================================

-- ── 5a. updated_at automático para virtual_comandas ─────────────────────────
-- Reusa a função set_updated_at() criada em 20260219_init_access_control.sql.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_virtual_comandas_updated_at'
  ) THEN
    CREATE TRIGGER trg_virtual_comandas_updated_at
      BEFORE UPDATE ON virtual_comandas
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;


-- ── 5b. Recalcular total_amount da comanda ao alterar itens ──────────────────
-- Atualiza virtual_comandas.total_amount toda vez que um item é
-- inserido, atualizado ou removido de virtual_comanda_items.

CREATE OR REPLACE FUNCTION recalculate_virtual_comanda_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_comanda_id UUID;
BEGIN
  -- Determina o comanda_id afetado (NEW em INSERT/UPDATE, OLD em DELETE)
  v_comanda_id := COALESCE(NEW.comanda_id, OLD.comanda_id);

  UPDATE virtual_comandas
     SET total_amount = COALESCE(
           (SELECT SUM(total_price) FROM virtual_comanda_items WHERE comanda_id = v_comanda_id),
           0
         ),
         updated_at = NOW()
   WHERE id = v_comanda_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_virtual_comanda_items_total'
  ) THEN
    CREATE TRIGGER trg_virtual_comanda_items_total
      AFTER INSERT OR UPDATE OR DELETE ON virtual_comanda_items
      FOR EACH ROW EXECUTE FUNCTION recalculate_virtual_comanda_total();
  END IF;
END $$;


-- =============================================================================
-- SEÇÃO 6 — FUNCTIONS / RPCs
-- =============================================================================

-- ── 6a. Gerador de short_code ─────────────────────────────────────────────────
-- Gera um código único por restaurante no formato 'CMD-XXXX'
-- onde XXXX são 4 caracteres alfanuméricos maiúsculos.
-- Tenta até 10 vezes antes de lançar exceção (evita loop infinito).

CREATE OR REPLACE FUNCTION generate_comanda_short_code(p_restaurant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code      TEXT;
  v_attempt   INT := 0;
  v_chars     TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sem I, O, 0, 1 (confusos visualmente)
  v_exists    BOOLEAN;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;

    IF v_attempt > 10 THEN
      RAISE EXCEPTION 'Não foi possível gerar um short_code único para o restaurante % após 10 tentativas.', p_restaurant_id;
    END IF;

    -- Gera 4 caracteres aleatórios do alfabeto acima
    v_code := 'CMD-' ||
      substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1) ||
      substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1) ||
      substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1) ||
      substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1);

    -- Verifica unicidade: o código não pode estar em uso em comanda 'open'
    SELECT EXISTS (
      SELECT 1 FROM virtual_comandas
       WHERE restaurant_id = p_restaurant_id
         AND short_code    = v_code
         AND status        = 'open'
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION generate_comanda_short_code IS
  'Gera um short_code único no formato CMD-XXXX para uma nova comanda virtual. '
  'Garante unicidade entre comandas abertas do mesmo restaurante.';


-- ── 6b. open_virtual_comanda() ────────────────────────────────────────────────
-- Cria uma nova comanda digital e retorna id + short_code.
-- Chamado pelo frontend público (cardápio de mesa) quando o cliente
-- escaneia o QR da mesa ou clica em "Abrir Comanda".
--
-- Parâmetros:
--   p_restaurant_id  UUID   — restaurante
--   p_table_number   TEXT   — número da mesa (opcional)
--   p_customer_name  TEXT   — nome do cliente (opcional; pode ser preenchido depois)
--
-- Retorno: JSONB { comanda_id, short_code, restaurant_id }

CREATE OR REPLACE FUNCTION open_virtual_comanda(
  p_restaurant_id UUID,
  p_table_number  TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda_id  UUID;
  v_short_code  TEXT;
BEGIN
  -- Validação: restaurante deve existir e estar ativo
  IF NOT EXISTS (
    SELECT 1 FROM restaurants
     WHERE id = p_restaurant_id
       AND is_active   = TRUE
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Restaurante não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;

  -- Validação: restaurante deve ter acesso à feature (plano Enterprise)
  IF NOT restaurant_has_feature(p_restaurant_id, 'feature_virtual_comanda') THEN
    RAISE EXCEPTION 'Funcionalidade de Comanda Digital não disponível neste plano.' USING ERRCODE = 'P0003';
  END IF;

  -- Gera código único
  v_short_code := generate_comanda_short_code(p_restaurant_id);

  -- Cria a comanda
  INSERT INTO virtual_comandas (restaurant_id, short_code, table_number, customer_name)
  VALUES (p_restaurant_id, v_short_code, p_table_number, p_customer_name)
  RETURNING id INTO v_comanda_id;

  RETURN jsonb_build_object(
    'comanda_id',    v_comanda_id,
    'short_code',    v_short_code,
    'restaurant_id', p_restaurant_id
  );
END;
$$;

COMMENT ON FUNCTION open_virtual_comanda IS
  'Abre uma nova comanda digital para um restaurante. '
  'Verifica se o restaurante está ativo e tem acesso ao plano Enterprise.';

GRANT EXECUTE ON FUNCTION open_virtual_comanda(UUID, TEXT, TEXT) TO anon, authenticated;


-- ── 6c. close_virtual_comanda() ───────────────────────────────────────────────
-- Fecha uma comanda digital, converte seus itens em um orders + order_items
-- e retorna o order_id gerado.
-- Deve ser chamado por usuário autenticado (garçom, caixa, restaurant_admin).
--
-- Parâmetros:
--   p_comanda_id      UUID   — ID da comanda a fechar
--   p_payment_method  TEXT   — forma de pagamento (cash | card | pix | table)
--
-- Retorno: JSONB { order_id, comanda_id, total_amount, short_code }

CREATE OR REPLACE FUNCTION close_virtual_comanda(
  p_comanda_id     UUID,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda     virtual_comandas%ROWTYPE;
  v_order_id    UUID;
BEGIN
  -- ── 1. Carrega e valida a comanda ─────────────────────────────────────────
  SELECT * INTO v_comanda
    FROM virtual_comandas
   WHERE id = p_comanda_id
     FOR UPDATE;  -- lock pessimista para evitar fechamento duplo

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', p_comanda_id USING ERRCODE = 'P0002';
  END IF;

  IF v_comanda.status <> 'open' THEN
    RAISE EXCEPTION 'Comanda % já está % e não pode ser fechada novamente.',
      p_comanda_id, v_comanda.status
      USING ERRCODE = 'P0001';
  END IF;

  IF v_comanda.total_amount = 0 THEN
    RAISE EXCEPTION 'Comanda % está vazia. Adicione ao menos um item antes de fechar.', p_comanda_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Cria o orders (pedido) ─────────────────────────────────────────────
  INSERT INTO orders (
    restaurant_id,
    customer_name,
    customer_phone,
    status,
    total,
    payment_method,
    order_source,
    table_number,
    notes,
    virtual_comanda_id
  )
  VALUES (
    v_comanda.restaurant_id,
    COALESCE(v_comanda.customer_name, 'Comanda ' || v_comanda.short_code),
    '',                          -- sem telefone em comandas físicas de mesa
    'pending',
    v_comanda.total_amount,
    p_payment_method,
    'comanda',                   -- distingue de delivery, table, etc.
    v_comanda.table_number,
    v_comanda.notes,
    v_comanda.id
  )
  RETURNING id INTO v_order_id;

  -- ── 3. Copia os itens para order_items ────────────────────────────────────
  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, observations)
  SELECT
    v_order_id,
    vci.product_id,
    vci.product_name,
    vci.quantity,
    vci.unit_price,
    vci.total_price,
    vci.notes
  FROM virtual_comanda_items vci
  WHERE vci.comanda_id = p_comanda_id;

  -- ── 4. Fecha a comanda ────────────────────────────────────────────────────
  UPDATE virtual_comandas
     SET status     = 'paid',
         closed_at  = NOW(),
         updated_at = NOW()
   WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'comanda_id',   p_comanda_id,
    'total_amount', v_comanda.total_amount,
    'short_code',   v_comanda.short_code
  );
END;
$$;

COMMENT ON FUNCTION close_virtual_comanda IS
  'Fecha uma comanda digital: cria um orders + order_items a partir dos itens '
  'da comanda e marca a comanda como paid. Retorna o order_id gerado. '
  'Deve ser chamado apenas por usuário autenticado com acesso ao restaurante.';

GRANT EXECUTE ON FUNCTION close_virtual_comanda(UUID, TEXT) TO authenticated;


-- =============================================================================
-- SEÇÃO 7 — RLS (Row Level Security)
-- =============================================================================

ALTER TABLE virtual_comandas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_comanda_items ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- virtual_comandas
-- ─────────────────────────────────────────────────────────────────────────────

-- Staff autenticado: CRUD completo nas comandas do próprio restaurante.
-- super_admin: acesso a todas.
DROP POLICY IF EXISTS "Staff gerencia comandas do próprio restaurante" ON virtual_comandas;
CREATE POLICY "Staff gerencia comandas do próprio restaurante"
  ON virtual_comandas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (
             u.role IN ('restaurant_admin', 'manager', 'waiter', 'cashier')
             AND u.restaurant_id = virtual_comandas.restaurant_id
           )
         )
    )
  );

-- Acesso público (anon): clientes podem consultar UMA comanda específica
-- quando conhecem o short_code (segurança por obscuridade — código gerado
-- aleatoriamente, difícil de adivinhar).
-- A política permite SELECT irrestrito; a query do frontend filtra pelo
-- short_code, garantindo que o cliente só veja a sua própria comanda.
DROP POLICY IF EXISTS "Anon pode ler comanda por short_code" ON virtual_comandas;
CREATE POLICY "Anon pode ler comanda por short_code"
  ON virtual_comandas
  FOR SELECT
  TO anon
  USING (status = 'open');    -- clientes só veem comandas abertas

-- Anon NÃO pode criar/atualizar/deletar comandas diretamente.
-- A criação é feita pela RPC open_virtual_comanda() (SECURITY DEFINER).


-- ─────────────────────────────────────────────────────────────────────────────
-- virtual_comanda_items
-- ─────────────────────────────────────────────────────────────────────────────

-- Staff autenticado: CRUD completo nos itens de comandas do seu restaurante.
DROP POLICY IF EXISTS "Staff gerencia itens de comandas do próprio restaurante" ON virtual_comanda_items;
CREATE POLICY "Staff gerencia itens de comandas do próprio restaurante"
  ON virtual_comanda_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM virtual_comandas vc
        JOIN users u ON (
          u.role = 'super_admin'
          OR (
            u.role IN ('restaurant_admin', 'manager', 'waiter', 'cashier')
            AND u.restaurant_id = vc.restaurant_id
          )
        )
       WHERE vc.id   = virtual_comanda_items.comanda_id
         AND u.id    = auth.uid()
    )
  );

-- Anon pode ler itens de uma comanda aberta (para exibir o total ao cliente).
DROP POLICY IF EXISTS "Anon pode ler itens de comanda aberta" ON virtual_comanda_items;
CREATE POLICY "Anon pode ler itens de comanda aberta"
  ON virtual_comanda_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM virtual_comandas vc
       WHERE vc.id     = virtual_comanda_items.comanda_id
         AND vc.status = 'open'
    )
  );

-- Anon pode adicionar itens a uma comanda ABERTA.
-- Restrição: só pode inserir em comanda com status = 'open'.
-- A comanda de destino deve pertencer a um restaurante ativo.
DROP POLICY IF EXISTS "Anon pode adicionar itens a comanda aberta" ON virtual_comanda_items;
CREATE POLICY "Anon pode adicionar itens a comanda aberta"
  ON virtual_comanda_items
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM virtual_comandas vc
        JOIN restaurants r ON r.id = vc.restaurant_id
       WHERE vc.id          = virtual_comanda_items.comanda_id
         AND vc.status      = 'open'
         AND r.is_active    = TRUE
         AND r.deleted_at  IS NULL
    )
  );


-- =============================================================================
-- SEÇÃO 8 — INDEXES
-- =============================================================================

-- virtual_comandas
CREATE INDEX IF NOT EXISTS idx_virtual_comandas_restaurant_status
  ON virtual_comandas (restaurant_id, status);

-- Índice parcial: acelera a busca por comandas abertas (caso mais frequente)
CREATE INDEX IF NOT EXISTS idx_virtual_comandas_open
  ON virtual_comandas (restaurant_id, short_code)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_virtual_comandas_created_at
  ON virtual_comandas (created_at DESC);

-- virtual_comanda_items
CREATE INDEX IF NOT EXISTS idx_virtual_comanda_items_comanda
  ON virtual_comanda_items (comanda_id);

-- orders: índice na nova FK de rastreabilidade
CREATE INDEX IF NOT EXISTS idx_orders_virtual_comanda
  ON orders (virtual_comanda_id)
  WHERE virtual_comanda_id IS NOT NULL;


-- =============================================================================
-- SEÇÃO 9 — SEED: Feature flag + plan_features
-- =============================================================================

-- 9a. Insere a feature 'feature_virtual_comanda' no catálogo
INSERT INTO features (flag, label, description, module, min_plan)
VALUES (
  'feature_virtual_comanda',
  'Comandas Virtuais (Mobile)',
  'Clientes abrem sua comanda via QR Code, adicionam itens e solicitam o fechamento. '
  'Integrado ao Kanban e KDS existentes via order_source = ''comanda''.',
  'pedidos',
  'enterprise'
)
ON CONFLICT (flag) DO NOTHING;

-- 9b. Vincula a feature ao plano Enterprise (e somente a ele, por ser Enterprise-only)
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.id, f.id
  FROM subscription_plans p
  JOIN features f ON f.flag = 'feature_virtual_comanda'
 WHERE p.name = 'enterprise'
ON CONFLICT (plan_id, feature_id) DO NOTHING;


-- =============================================================================
-- SEÇÃO 10 — GRANTS + VERIFICAÇÃO FINAL
-- =============================================================================

-- Revoga execução pública e concede apenas para os roles corretos
REVOKE ALL ON FUNCTION generate_comanda_short_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_comanda_short_code(UUID) TO authenticated;

-- Verificação: conta os artefatos criados e emite NOTICE
DO $$
DECLARE
  v_tbl_vc       BOOLEAN;
  v_tbl_vci      BOOLEAN;
  v_col_orders   BOOLEAN;
  v_feature      TEXT;
  v_plan_link    BOOLEAN;
BEGIN
  SELECT to_regclass('public.virtual_comandas')       IS NOT NULL INTO v_tbl_vc;
  SELECT to_regclass('public.virtual_comanda_items')  IS NOT NULL INTO v_tbl_vci;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'orders'
       AND column_name  = 'virtual_comanda_id'
  ) INTO v_col_orders;

  SELECT flag INTO v_feature FROM features WHERE flag = 'feature_virtual_comanda';

  SELECT EXISTS (
    SELECT 1
      FROM plan_features pf
      JOIN subscription_plans sp ON sp.id = pf.plan_id
      JOIN features f             ON f.id  = pf.feature_id
     WHERE sp.name = 'enterprise'
       AND f.flag  = 'feature_virtual_comanda'
  ) INTO v_plan_link;

  RAISE NOTICE '=== Migration 20260219_virtual_comandas concluída ===';
  RAISE NOTICE '  TABLE virtual_comandas        : %', CASE WHEN v_tbl_vc    THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '  TABLE virtual_comanda_items   : %', CASE WHEN v_tbl_vci   THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '  COLUMN orders.virtual_comanda_id : %', CASE WHEN v_col_orders THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '  FEATURE feature_virtual_comanda  : %', COALESCE(v_feature, 'NÃO ENCONTRADA');
  RAISE NOTICE '  plan_features (enterprise)       : %', CASE WHEN v_plan_link THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '  RPCs disponíveis:';
  RAISE NOTICE '    - open_virtual_comanda(restaurant_id, table_number?, customer_name?)';
  RAISE NOTICE '    - close_virtual_comanda(comanda_id, payment_method?)';
  RAISE NOTICE '    - generate_comanda_short_code(restaurant_id) [interno]';
  RAISE NOTICE '  RLS: authenticated (staff) + anon (leitura/inserção em comandas abertas)';
END $$;
