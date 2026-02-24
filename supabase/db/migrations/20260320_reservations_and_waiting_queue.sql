-- =============================================================================
-- Migration: Sistema de Reservas e Fila de Espera
-- Data      : 2026-03-20
-- Depende de: 20260219_virtual_comandas.sql, 20260307_hall_zones_and_table_comanda_links.sql
--
-- Gestão de Reservas via Comanda Digital:
--   - Ao fazer reserva: cria virtual_comanda com short_code (código de barras) vinculada a uma mesa
--   - Na recepção (/cashier): bip do código → exibe dados da reserva → ativar ou cancelar
--
-- Fila de Espera Digital:
--   - Clientes sem reserva entram na fila (nome, WhatsApp)
--   - Painel em tempo real; ao liberar mesa, vincular comanda e notificar
--
-- =============================================================================

-- =============================================================================
-- SEÇÃO 1 — ENUMs
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE reservation_status_type AS ENUM ('pending', 'confirmed', 'activated', 'cancelled', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE waiting_queue_status_type AS ENUM ('waiting', 'notified', 'attended', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- SEÇÃO 2 — TABLE: reservations
-- =============================================================================

CREATE TABLE IF NOT EXISTS reservations (
  id                    UUID                         PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id         UUID                         NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  virtual_comanda_id    UUID                         NOT NULL REFERENCES virtual_comandas(id) ON DELETE CASCADE,
  table_id              UUID                         NOT NULL REFERENCES tables(id) ON DELETE CASCADE,

  customer_name         TEXT                         NOT NULL,
  customer_phone        TEXT,
  scheduled_at          TIMESTAMPTZ                  NOT NULL,
  late_tolerance_minutes INTEGER                     NOT NULL DEFAULT 15,
  notes                 TEXT,

  status                reservation_status_type      NOT NULL DEFAULT 'pending',
  activated_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),

  UNIQUE (virtual_comanda_id)
);

COMMENT ON TABLE reservations IS 'Reservas vinculadas a comandas digitais. Cliente recebe código de barras na reserva; na chegada o caixa bipa e ativa ou cancela.';

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_status ON reservations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_scheduled_at ON reservations(restaurant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_reservations_virtual_comanda ON reservations(virtual_comanda_id);


-- =============================================================================
-- SEÇÃO 3 — TABLE: waiting_queue
-- =============================================================================

CREATE TABLE IF NOT EXISTS waiting_queue (
  id                    UUID                         PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id         UUID                         NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  customer_name         TEXT                         NOT NULL,
  customer_phone        TEXT,
  position              INTEGER                      NOT NULL DEFAULT 0,
  status                waiting_queue_status_type    NOT NULL DEFAULT 'waiting',

  virtual_comanda_id    UUID                         REFERENCES virtual_comandas(id) ON DELETE SET NULL,
  table_id              UUID                         REFERENCES tables(id) ON DELETE SET NULL,
  notified_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE waiting_queue IS 'Fila de espera para clientes sem reserva. Ao liberar mesa, staff vincula comanda e notifica (WhatsApp ou interface).';

CREATE INDEX IF NOT EXISTS idx_waiting_queue_restaurant_status ON waiting_queue(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_waiting_queue_position ON waiting_queue(restaurant_id, position) WHERE status = 'waiting';


-- =============================================================================
-- SEÇÃO 4 — TRIGGERS (updated_at)
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reservations_updated_at') THEN
    CREATE TRIGGER trg_reservations_updated_at
      BEFORE UPDATE ON reservations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_waiting_queue_updated_at') THEN
    CREATE TRIGGER trg_waiting_queue_updated_at
      BEFORE UPDATE ON waiting_queue
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;


-- =============================================================================
-- SEÇÃO 5 — RLS
-- =============================================================================

ALTER TABLE reservations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_queue   ENABLE ROW LEVEL SECURITY;

-- reservations: staff do restaurante
DROP POLICY IF EXISTS "Staff gerencia reservas do restaurante" ON reservations;
CREATE POLICY "Staff gerencia reservas do restaurante"
  ON reservations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (u.role IN ('restaurant_admin', 'manager', 'waiter', 'cashier') AND u.restaurant_id = reservations.restaurant_id)
         )
    )
  );

-- waiting_queue: staff do restaurante
DROP POLICY IF EXISTS "Staff gerencia fila de espera do restaurante" ON waiting_queue;
CREATE POLICY "Staff gerencia fila de espera do restaurante"
  ON waiting_queue FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (u.role IN ('restaurant_admin', 'manager', 'waiter', 'cashier') AND u.restaurant_id = waiting_queue.restaurant_id)
         )
    )
  );


-- =============================================================================
-- SEÇÃO 6 — RPCs
-- =============================================================================

-- 6a. create_reservation: cria reserva + virtual_comanda vinculada
-- Parâmetros obrigatórios primeiro; opcionais (com DEFAULT) por último
CREATE OR REPLACE FUNCTION create_reservation(
  p_restaurant_id       UUID,
  p_table_id            UUID,
  p_customer_name       TEXT,
  p_scheduled_at        TIMESTAMPTZ,
  p_customer_phone      TEXT DEFAULT NULL,
  p_late_tolerance_mins INTEGER DEFAULT 15,
  p_notes               TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_number TEXT;
  v_comanda_res  JSONB;
  v_comanda_id   UUID;
  v_short_code   TEXT;
  v_reservation_id UUID;
BEGIN
  IF NOT restaurant_has_feature(p_restaurant_id, 'feature_virtual_comanda') THEN
    RAISE EXCEPTION 'Funcionalidade de Comanda Digital não disponível.' USING ERRCODE = 'P0003';
  END IF;
  IF NOT restaurant_has_feature(p_restaurant_id, 'feature_tables') THEN
    RAISE EXCEPTION 'Funcionalidade de Mesas não disponível.' USING ERRCODE = 'P0003';
  END IF;

  SELECT number::TEXT INTO v_table_number FROM tables WHERE id = p_table_id AND restaurant_id = p_restaurant_id AND is_active = TRUE;
  IF v_table_number IS NULL THEN
    RAISE EXCEPTION 'Mesa não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  -- Cria virtual_comanda (usa mesma lógica de open_virtual_comanda)
  v_short_code := generate_comanda_short_code(p_restaurant_id);
  INSERT INTO virtual_comandas (restaurant_id, short_code, table_number, customer_name)
  VALUES (p_restaurant_id, v_short_code, v_table_number, p_customer_name)
  RETURNING id, short_code INTO v_comanda_id, v_short_code;

  INSERT INTO reservations (
    restaurant_id, virtual_comanda_id, table_id,
    customer_name, customer_phone, scheduled_at, late_tolerance_minutes, notes
  )
  VALUES (
    p_restaurant_id, v_comanda_id, p_table_id,
    p_customer_name, p_customer_phone, p_scheduled_at, COALESCE(p_late_tolerance_mins, 15), p_notes
  )
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'reservation_id',   v_reservation_id,
    'comanda_id',       v_comanda_id,
    'short_code',       v_short_code,
    'table_number',     v_table_number,
    'scheduled_at',     p_scheduled_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_reservation(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, INTEGER, TEXT) TO authenticated;


-- 6b. activate_reservation: marca reserva como ativada (cliente chegou no horário)
CREATE OR REPLACE FUNCTION activate_reservation(p_reservation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Reserva já foi % e não pode ser ativada.', v_row.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE reservations SET status = 'activated', activated_at = NOW(), updated_at = NOW() WHERE id = p_reservation_id;
  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'activated');
END;
$$;

GRANT EXECUTE ON FUNCTION activate_reservation(UUID) TO authenticated;


-- 6c. cancel_reservation: cancela reserva (ex: atraso além do limite)
CREATE OR REPLACE FUNCTION cancel_reservation(p_reservation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status IN ('cancelled', 'no_show', 'activated') THEN
    RAISE EXCEPTION 'Reserva já está % e não pode ser cancelada.', v_row.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE reservations SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = p_reservation_id;
  UPDATE virtual_comandas SET status = 'cancelled', updated_at = NOW() WHERE id = v_row.virtual_comanda_id;
  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_reservation(UUID) TO authenticated;


-- 6d. add_to_waiting_queue: adiciona cliente na fila de espera
CREATE OR REPLACE FUNCTION add_to_waiting_queue(
  p_restaurant_id  UUID,
  p_customer_name  TEXT,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos   INTEGER;
  v_id    UUID;
BEGIN
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_pos
  FROM waiting_queue
  WHERE restaurant_id = p_restaurant_id AND status = 'waiting';

  INSERT INTO waiting_queue (restaurant_id, customer_name, customer_phone, position)
  VALUES (p_restaurant_id, p_customer_name, p_customer_phone, v_pos)
  RETURNING id, position INTO v_id, v_pos;

  RETURN jsonb_build_object('id', v_id, 'position', v_pos);
END;
$$;

GRANT EXECUTE ON FUNCTION add_to_waiting_queue(UUID, TEXT, TEXT) TO authenticated;


-- 6e. notify_queue_item: chama próximo da fila, cria comanda, associa mesa
CREATE OR REPLACE FUNCTION notify_queue_item(
  p_queue_id   UUID,
  p_table_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   waiting_queue%ROWTYPE;
  v_table_number TEXT;
  v_comanda_id UUID;
  v_short_code TEXT;
BEGIN
  SELECT * INTO v_row FROM waiting_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da fila não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'waiting' THEN
    RAISE EXCEPTION 'Item da fila já foi atendido.' USING ERRCODE = 'P0001';
  END IF;

  SELECT number::TEXT INTO v_table_number FROM tables WHERE id = p_table_id AND restaurant_id = v_row.restaurant_id AND is_active = TRUE;
  IF v_table_number IS NULL THEN
    RAISE EXCEPTION 'Mesa não encontrada ou inativa.' USING ERRCODE = 'P0002';
  END IF;

  v_short_code := generate_comanda_short_code(v_row.restaurant_id);
  INSERT INTO virtual_comandas (restaurant_id, short_code, table_number, customer_name)
  VALUES (v_row.restaurant_id, v_short_code, v_table_number, v_row.customer_name)
  RETURNING id, short_code INTO v_comanda_id, v_short_code;

  UPDATE waiting_queue
  SET status = 'notified', virtual_comanda_id = v_comanda_id, table_id = p_table_id, notified_at = NOW(), updated_at = NOW()
  WHERE id = p_queue_id;

  RETURN jsonb_build_object(
    'queue_id',     p_queue_id,
    'comanda_id',   v_comanda_id,
    'short_code',   v_short_code,
    'table_number', v_table_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION notify_queue_item(UUID, UUID) TO authenticated;


-- 6f. cancel_waiting_queue_item
CREATE OR REPLACE FUNCTION cancel_waiting_queue_item(p_queue_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE waiting_queue SET status = 'cancelled', updated_at = NOW() WHERE id = p_queue_id AND status = 'waiting';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da fila não encontrado ou já atendido.' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('queue_id', p_queue_id, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_waiting_queue_item(UUID) TO authenticated;


-- =============================================================================
-- SEÇÃO 7 — Feature flag + plan_features
-- =============================================================================

INSERT INTO features (flag, label, description, module, min_plan)
VALUES (
  'feature_reservations',
  'Reservas e Fila de Espera',
  'Reservas via comanda digital com código de barras. Fila de espera em tempo real. Integrado ao Caixa e Mesas.',
  'mesas',
  'enterprise'
)
ON CONFLICT (flag) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_id)
SELECT p.id, f.id
  FROM subscription_plans p
  JOIN features f ON f.flag = 'feature_reservations'
 WHERE p.name = 'enterprise'
ON CONFLICT (plan_id, feature_id) DO NOTHING;


-- =============================================================================
-- SEÇÃO 8 — Realtime (habilitar via Supabase Dashboard se necessário)
-- =============================================================================
-- As tabelas reservations e waiting_queue devem ser adicionadas à publicação
-- em Database > Replication para atualização em tempo real.


DO $$
BEGIN
  RAISE NOTICE '=== Migration 20260320_reservations_and_waiting_queue concluída ===';
  RAISE NOTICE '  TABLES: reservations, waiting_queue';
  RAISE NOTICE '  RPCs: create_reservation, activate_reservation, cancel_reservation';
  RAISE NOTICE '  RPCs: add_to_waiting_queue, notify_queue_item, cancel_waiting_queue_item';
  RAISE NOTICE '  FEATURE: feature_reservations (enterprise)';
END $$;
