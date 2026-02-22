-- =============================================================================
-- Migration: Cupons de desconto
-- Tabela discount_coupons + colunas em orders
-- =============================================================================

-- 1. Tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_discount_coupons_restaurant ON discount_coupons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_restaurant_code ON discount_coupons(restaurant_id, LOWER(code));

COMMENT ON TABLE discount_coupons IS 'Cupons de desconto configurados pelo restaurante';
COMMENT ON COLUMN discount_coupons.discount_type IS 'percent = porcentagem (ex: 10 = 10%), fixed = valor fixo';
COMMENT ON COLUMN discount_coupons.discount_value IS 'Valor do desconto: % (0-100) ou valor em moeda base';

-- 2. Colunas em orders para registrar uso de cupom
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_coupon_id UUID REFERENCES discount_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN orders.discount_coupon_id IS 'Cupom aplicado no pedido';
COMMENT ON COLUMN orders.discount_amount IS 'Valor do desconto aplicado';

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION discount_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discount_coupons_updated_at ON discount_coupons;
CREATE TRIGGER discount_coupons_updated_at
  BEFORE UPDATE ON discount_coupons
  FOR EACH ROW EXECUTE FUNCTION discount_coupons_updated_at();

-- 4. RLS (mesmo padrão de product_offers)
ALTER TABLE discount_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discount_coupons_select ON discount_coupons;
CREATE POLICY discount_coupons_select ON discount_coupons
  FOR SELECT USING (
    is_active = true
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = discount_coupons.restaurant_id))
    OR EXISTS (SELECT 1 FROM restaurant_user_roles rur WHERE rur.restaurant_id = discount_coupons.restaurant_id AND rur.user_id = auth.uid() AND rur.is_active)
  );

DROP POLICY IF EXISTS discount_coupons_insert ON discount_coupons;
CREATE POLICY discount_coupons_insert ON discount_coupons
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = discount_coupons.restaurant_id))
    OR EXISTS (SELECT 1 FROM restaurant_user_roles rur WHERE rur.restaurant_id = discount_coupons.restaurant_id AND rur.user_id = auth.uid() AND rur.is_active AND rur.role IN ('owner', 'manager'))
  );

DROP POLICY IF EXISTS discount_coupons_update ON discount_coupons;
CREATE POLICY discount_coupons_update ON discount_coupons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = discount_coupons.restaurant_id))
    OR EXISTS (SELECT 1 FROM restaurant_user_roles rur WHERE rur.restaurant_id = discount_coupons.restaurant_id AND rur.user_id = auth.uid() AND rur.is_active AND rur.role IN ('owner', 'manager'))
  );

DROP POLICY IF EXISTS discount_coupons_delete ON discount_coupons;
CREATE POLICY discount_coupons_delete ON discount_coupons
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = discount_coupons.restaurant_id))
    OR EXISTS (SELECT 1 FROM restaurant_user_roles rur WHERE rur.restaurant_id = discount_coupons.restaurant_id AND rur.user_id = auth.uid() AND rur.is_active AND rur.role IN ('owner', 'manager'))
  );
