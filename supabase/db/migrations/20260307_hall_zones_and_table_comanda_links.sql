-- =============================================================================
-- Migration: Zonas do Salão + Vínculo de Comandas Físicas às Mesas
-- Diferente de delivery_zones (entrega). Zonas do Salão = setores/praças (Varanda, Salão Principal, etc.)
-- =============================================================================

-- 1. Tabela hall_zones (Zonas do Salão)
CREATE TABLE IF NOT EXISTS hall_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hall_zones_restaurant ON hall_zones(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hall_zones_restaurant_name ON hall_zones(restaurant_id, LOWER(TRIM(name)));

COMMENT ON TABLE hall_zones IS 'Zonas/setores do salão (Varanda, Salão Principal, Piso Superior). Diferente de delivery_zones.';

-- 2. Adicionar hall_zone_id em tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS hall_zone_id UUID REFERENCES hall_zones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tables_hall_zone ON tables(hall_zone_id);

-- 3. Tabela table_comanda_links (vínculo mesa ↔ comanda física)
CREATE TABLE IF NOT EXISTS table_comanda_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  comanda_id UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comanda_id)
);

CREATE INDEX IF NOT EXISTS idx_table_comanda_links_table ON table_comanda_links(table_id);
CREATE INDEX IF NOT EXISTS idx_table_comanda_links_restaurant ON table_comanda_links(restaurant_id);

COMMENT ON TABLE table_comanda_links IS 'Vínculo entre mesa e comanda física (buffet). Uma comanda só pode estar vinculada a uma mesa por vez.';

-- 4. RLS para hall_zones
ALTER TABLE hall_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant admins can manage own hall_zones" ON hall_zones;
CREATE POLICY "Restaurant admins can manage own hall_zones"
  ON hall_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = hall_zones.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- 5. RLS para table_comanda_links
ALTER TABLE table_comanda_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant admins can manage own table_comanda_links" ON table_comanda_links;
CREATE POLICY "Restaurant admins can manage own table_comanda_links"
  ON table_comanda_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = table_comanda_links.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Realtime (opcional): em Supabase Dashboard > Database > Replication,
-- habilite hall_zones e table_comanda_links para sync entre dispositivos.
