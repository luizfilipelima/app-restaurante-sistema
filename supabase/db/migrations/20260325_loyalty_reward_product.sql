-- =============================================================================
-- Migration: Programa de Fidelidade — prêmio = item do cardápio
-- Permite ao restaurante escolher um produto que será dado grátis ao resgatar.
-- No checkout, o cliente vê a opção de adicionar esse item ao pedido quando
-- completar o plano.
-- =============================================================================

ALTER TABLE loyalty_programs
  ADD COLUMN IF NOT EXISTS reward_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

COMMENT ON COLUMN loyalty_programs.reward_product_id IS
  'Produto do cardápio dado grátis ao resgatar o prêmio. NULL = apenas descrição textual.';

-- Atualizar RPC get_loyalty_points para retornar reward_product_id e reward_product_name
-- (é necessário DROP antes porque o tipo de retorno mudou)
DROP FUNCTION IF EXISTS get_loyalty_points(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_loyalty_points(
  p_restaurant_id UUID,
  p_phone         TEXT
)
RETURNS TABLE(
  points INT,
  redeemed_count INT,
  orders_required INT,
  reward_description TEXT,
  enabled BOOLEAN,
  reward_product_id UUID,
  reward_product_name TEXT
)
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
    COALESCE(prog.reward_description, '1 produto grátis'),
    COALESCE(prog.enabled, false),
    prog.reward_product_id,
    p.name::TEXT
  FROM loyalty_programs prog
  LEFT JOIN loyalty_points lp
    ON lp.restaurant_id = p_restaurant_id
   AND lp.customer_phone = p_phone
  LEFT JOIN products p ON p.id = prog.reward_product_id AND p.restaurant_id = prog.restaurant_id
  WHERE prog.restaurant_id = p_restaurant_id;
END;
$$;
