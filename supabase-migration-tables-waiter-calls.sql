-- Migration: Mesas, chamados de garçom e pedidos por mesa
-- Data: 2026-02-17
-- Descrição: Sistema de mesas, pedidos por mesa e chamados de garçom

-- 1. Tabela de mesas
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, number)
);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_active ON tables(restaurant_id, is_active);

-- 2. Tabela de chamados de garçom
CREATE TABLE IF NOT EXISTS waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  table_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  attended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant ON waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON waiter_calls(restaurant_id, status);

-- 3. Adicionar order_source e table_id em orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR(20) DEFAULT 'delivery' CHECK (order_source IN ('delivery', 'pickup', 'table', 'buffet'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id) ON DELETE SET NULL;

-- Backfill: definir order_source a partir de delivery_type para pedidos existentes
UPDATE orders SET order_source = delivery_type;

CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(restaurant_id, order_source);

-- 4. RLS para tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant admins can manage own tables"
  ON tables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = tables.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

CREATE POLICY "Public can read active restaurant tables"
  ON tables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = tables.restaurant_id
      AND restaurants.is_active = true
    )
  );

-- 5. RLS para waiter_calls
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant admins can manage own waiter_calls"
  ON waiter_calls FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = waiter_calls.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Público pode inserir chamados (cliente na mesa)
CREATE POLICY "Public can insert waiter_calls for active restaurants"
  ON waiter_calls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = waiter_calls.restaurant_id
      AND restaurants.is_active = true
    )
  );

-- Habilitar Realtime em waiter_calls para admin ver chamados em tempo real
-- (Execute no painel Supabase: Database > Replication > waiter_calls)

COMMENT ON TABLE tables IS 'Mesas do restaurante para pedidos no local';
COMMENT ON TABLE waiter_calls IS 'Chamados de garçom solicitados pelas mesas';
COMMENT ON COLUMN orders.order_source IS 'Origem do pedido: delivery, pickup, table, buffet';
COMMENT ON COLUMN orders.table_id IS 'Mesa associada (quando order_source=table)';
