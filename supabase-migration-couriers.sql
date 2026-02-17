-- =====================================================
-- MIGRAÇÃO: Tabela couriers (entregadores / motoboys)
-- Multi-tenant: cada restaurante gerencia seus próprios entregadores
-- =====================================================

-- Tabela couriers
CREATE TABLE IF NOT EXISTS couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'offline')),
  vehicle_plate TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_couriers_restaurant ON couriers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON couriers(restaurant_id, status) WHERE active = true;

COMMENT ON TABLE couriers IS 'Entregadores/motoboys por restaurante para atribuição a pedidos';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_couriers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_couriers_updated_at ON couriers;
CREATE TRIGGER update_couriers_updated_at
  BEFORE UPDATE ON couriers
  FOR EACH ROW
  EXECUTE FUNCTION update_couriers_updated_at();

-- RLS
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant staff can read their couriers" ON couriers;
CREATE POLICY "Restaurant staff can read their couriers"
  ON couriers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = couriers.restaurant_id
    )
  );

DROP POLICY IF EXISTS "Restaurant staff can insert their couriers" ON couriers;
CREATE POLICY "Restaurant staff can insert their couriers"
  ON couriers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = couriers.restaurant_id
    )
  );

DROP POLICY IF EXISTS "Restaurant staff can update their couriers" ON couriers;
CREATE POLICY "Restaurant staff can update their couriers"
  ON couriers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = couriers.restaurant_id
    )
  );

DROP POLICY IF EXISTS "Restaurant staff can delete their couriers" ON couriers;
CREATE POLICY "Restaurant staff can delete their couriers"
  ON couriers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = couriers.restaurant_id
    )
  );

-- Super admin: se existir política por role, descomente e adapte conforme seu supabase-rls-completo.sql
-- Por exemplo: (users.restaurant_id = couriers.restaurant_id OR (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin')

SELECT 'Migração couriers aplicada.' AS mensagem;
