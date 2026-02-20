-- =====================================================
-- Migração: Sistema de Cartão Fidelidade Digital
-- =====================================================

-- 1. Configuração do programa por restaurante
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  orders_required INTEGER NOT NULL DEFAULT 10 CHECK (orders_required BETWEEN 2 AND 100),
  reward_description TEXT NOT NULL DEFAULT '1 produto grátis',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT loyalty_programs_restaurant_unique UNIQUE (restaurant_id)
);

-- 2. Pontuação por cliente (uma linha por telefone × restaurante)
CREATE TABLE IF NOT EXISTS loyalty_points (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_phone  TEXT NOT NULL,
  points          INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  redeemed_count  INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT loyalty_points_unique UNIQUE (restaurant_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant ON loyalty_points(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_phone      ON loyalty_points(customer_phone);

-- 3. Flags nos pedidos
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_redeemed       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_points_credited BOOLEAN NOT NULL DEFAULT false;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points   ENABLE ROW LEVEL SECURITY;

-- Admin pode ver/editar seu próprio programa
CREATE POLICY "loyalty_programs_owner" ON loyalty_programs
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid() OR id IN (
        SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()
      )
    )
  );

-- loyalty_points: leitura via RPC pública (SECURITY DEFINER abaixo)
CREATE POLICY "loyalty_points_owner" ON loyalty_points
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid() OR id IN (
        SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()
      )
    )
  );

-- ─── RPC: leitura pública de pontos (cliente não autenticado) ─────────────────
CREATE OR REPLACE FUNCTION get_loyalty_points(
  p_restaurant_id UUID,
  p_phone         TEXT
)
RETURNS TABLE(points INT, redeemed_count INT, orders_required INT, reward_description TEXT, enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(lp.points, 0)::INT,
    COALESCE(lp.redeemed_count, 0)::INT,
    COALESCE(prog.orders_required, 10)::INT,
    COALESCE(prog.reward_description, ''),
    COALESCE(prog.enabled, false)
  FROM loyalty_programs prog
  LEFT JOIN loyalty_points lp
    ON lp.restaurant_id = p_restaurant_id
   AND lp.customer_phone = p_phone
  WHERE prog.restaurant_id = p_restaurant_id;
END;
$$;

-- ─── RPC: creditar ponto ao concluir pedido (chamado pelo admin) ───────────────
CREATE OR REPLACE FUNCTION credit_loyalty_point(
  p_restaurant_id UUID,
  p_order_id      UUID,
  p_phone         TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_credited BOOLEAN;
  v_prog_enabled     BOOLEAN;
BEGIN
  -- Verificar se já foi creditado
  SELECT loyalty_points_credited INTO v_already_credited
  FROM orders WHERE id = p_order_id;

  IF v_already_credited THEN
    RETURN false;
  END IF;

  -- Verificar se programa está ativo
  SELECT enabled INTO v_prog_enabled
  FROM loyalty_programs WHERE restaurant_id = p_restaurant_id;

  IF NOT COALESCE(v_prog_enabled, false) THEN
    RETURN false;
  END IF;

  -- Upsert nos pontos
  INSERT INTO loyalty_points (restaurant_id, customer_phone, points, updated_at)
  VALUES (p_restaurant_id, p_phone, 1, NOW())
  ON CONFLICT (restaurant_id, customer_phone)
  DO UPDATE SET
    points     = loyalty_points.points + 1,
    updated_at = NOW();

  -- Marcar pedido como creditado
  UPDATE orders
  SET loyalty_points_credited = true
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

-- ─── RPC: resgatar prêmio (chamado pelo público no checkout) ──────────────────
CREATE OR REPLACE FUNCTION redeem_loyalty(
  p_restaurant_id UUID,
  p_phone         TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points     INT;
  v_req        INT;
  v_enabled    BOOLEAN;
BEGIN
  SELECT enabled, orders_required INTO v_enabled, v_req
  FROM loyalty_programs WHERE restaurant_id = p_restaurant_id;

  IF NOT COALESCE(v_enabled, false) THEN RETURN false; END IF;

  SELECT points INTO v_points
  FROM loyalty_points
  WHERE restaurant_id = p_restaurant_id AND customer_phone = p_phone;

  IF COALESCE(v_points, 0) < COALESCE(v_req, 10) THEN RETURN false; END IF;

  UPDATE loyalty_points
  SET
    points         = points - v_req,
    redeemed_count = redeemed_count + 1,
    updated_at     = NOW()
  WHERE restaurant_id = p_restaurant_id AND customer_phone = p_phone;

  RETURN true;
END;
$$;

SELECT 'Migração loyalty_program aplicada com sucesso.' AS mensagem;
