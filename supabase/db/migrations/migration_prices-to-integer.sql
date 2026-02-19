-- ============================================================
-- Migração: Converter preços de DECIMAL para INTEGER
-- Estratégia: BRL em centavos, PYG em inteiros
-- ============================================================
-- Esta migração converte todas as colunas de preço de DECIMAL(10,2) para INTEGER,
-- aplicando a estratégia:
--   - BRL: multiplica por 100 (converte reais para centavos)
--   - PYG: mantém valor inteiro (arredonda se necessário)
-- ============================================================

BEGIN;

-- Função auxiliar para obter a moeda de um restaurante
CREATE OR REPLACE FUNCTION get_restaurant_currency(rest_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(currency, 'BRL') FROM restaurants WHERE id = rest_id;
$$ LANGUAGE SQL;

-- ============================================================
-- 1. PRODUCTS
-- ============================================================
-- Adicionar coluna temporária INTEGER
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_int INTEGER;

-- Migrar dados: BRL multiplica por 100, PYG mantém inteiro
UPDATE products
SET price_int = CASE
  WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(price)::INTEGER
  ELSE ROUND(price * 100)::INTEGER
END;

-- Remover coluna antiga e renomear nova
ALTER TABLE products DROP COLUMN price;
ALTER TABLE products RENAME COLUMN price_int TO price;
ALTER TABLE products ALTER COLUMN price SET NOT NULL;

-- price_sale e price_cost (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price_sale') THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS price_sale_int INTEGER;
    UPDATE products
    SET price_sale_int = CASE
      WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(COALESCE(price_sale, price))::INTEGER
      ELSE ROUND(COALESCE(price_sale, price) * 100)::INTEGER
    END;
    ALTER TABLE products DROP COLUMN price_sale;
    ALTER TABLE products RENAME COLUMN price_sale_int TO price_sale;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price_cost') THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS price_cost_int INTEGER;
    UPDATE products
    SET price_cost_int = CASE
      WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(COALESCE(price_cost, 0))::INTEGER
      ELSE ROUND(COALESCE(price_cost, 0) * 100)::INTEGER
    END
    WHERE price_cost IS NOT NULL;
    ALTER TABLE products DROP COLUMN price_cost;
    ALTER TABLE products RENAME COLUMN price_cost_int TO price_cost;
  END IF;
END $$;

-- ============================================================
-- 2. PIZZA_FLAVORS
-- ============================================================
ALTER TABLE pizza_flavors ADD COLUMN IF NOT EXISTS price_int INTEGER;
UPDATE pizza_flavors
SET price_int = CASE
  WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(price)::INTEGER
  ELSE ROUND(price * 100)::INTEGER
END;
ALTER TABLE pizza_flavors DROP COLUMN price;
ALTER TABLE pizza_flavors RENAME COLUMN price_int TO price;
ALTER TABLE pizza_flavors ALTER COLUMN price SET NOT NULL;

-- ============================================================
-- 3. PIZZA_DOUGHS (extra_price)
-- ============================================================
ALTER TABLE pizza_doughs ADD COLUMN IF NOT EXISTS extra_price_int INTEGER;
UPDATE pizza_doughs
SET extra_price_int = CASE
  WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(COALESCE(extra_price, 0))::INTEGER
  ELSE ROUND(COALESCE(extra_price, 0) * 100)::INTEGER
END;
ALTER TABLE pizza_doughs DROP COLUMN extra_price;
ALTER TABLE pizza_doughs RENAME COLUMN extra_price_int TO extra_price;
ALTER TABLE pizza_doughs ALTER COLUMN extra_price SET DEFAULT 0;

-- ============================================================
-- 4. PIZZA_EDGES
-- ============================================================
ALTER TABLE pizza_edges ADD COLUMN IF NOT EXISTS price_int INTEGER;
UPDATE pizza_edges
SET price_int = CASE
  WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(price)::INTEGER
  ELSE ROUND(price * 100)::INTEGER
END;
ALTER TABLE pizza_edges DROP COLUMN price;
ALTER TABLE pizza_edges RENAME COLUMN price_int TO price;
ALTER TABLE pizza_edges ALTER COLUMN price SET NOT NULL;

-- ============================================================
-- 5. DELIVERY_ZONES (fee)
-- ============================================================
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS fee_int INTEGER;
UPDATE delivery_zones
SET fee_int = CASE
  WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(fee)::INTEGER
  ELSE ROUND(fee * 100)::INTEGER
END;
ALTER TABLE delivery_zones DROP COLUMN fee;
ALTER TABLE delivery_zones RENAME COLUMN fee_int TO fee;
ALTER TABLE delivery_zones ALTER COLUMN fee SET DEFAULT 0;

-- ============================================================
-- 6. ORDERS (subtotal, total, delivery_fee, payment_change_for)
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_int INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_int INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_int INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_change_for_int INTEGER;

UPDATE orders
SET 
  subtotal_int = CASE
    WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(subtotal)::INTEGER
    ELSE ROUND(subtotal * 100)::INTEGER
  END,
  total_int = CASE
    WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(total)::INTEGER
    ELSE ROUND(total * 100)::INTEGER
  END,
  delivery_fee_int = CASE
    WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(COALESCE(delivery_fee, 0))::INTEGER
    ELSE ROUND(COALESCE(delivery_fee, 0) * 100)::INTEGER
  END,
  payment_change_for_int = CASE
    WHEN payment_change_for IS NULL THEN NULL
    WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(payment_change_for)::INTEGER
    ELSE ROUND(payment_change_for * 100)::INTEGER
  END;

ALTER TABLE orders DROP COLUMN subtotal;
ALTER TABLE orders DROP COLUMN total;
ALTER TABLE orders DROP COLUMN delivery_fee;
ALTER TABLE orders DROP COLUMN payment_change_for;

ALTER TABLE orders RENAME COLUMN subtotal_int TO subtotal;
ALTER TABLE orders RENAME COLUMN total_int TO total;
ALTER TABLE orders RENAME COLUMN delivery_fee_int TO delivery_fee;
ALTER TABLE orders RENAME COLUMN payment_change_for_int TO payment_change_for;

ALTER TABLE orders ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE orders ALTER COLUMN total SET NOT NULL;
ALTER TABLE orders ALTER COLUMN delivery_fee SET DEFAULT 0;

-- ============================================================
-- 7. ORDER_ITEMS (unit_price, total_price)
-- ============================================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price_int INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price_int INTEGER;

-- Obter currency do restaurante através do order
UPDATE order_items oi
SET 
  unit_price_int = CASE
    WHEN get_restaurant_currency((SELECT restaurant_id FROM orders WHERE id = oi.order_id)) = 'PYG' 
    THEN ROUND(oi.unit_price)::INTEGER
    ELSE ROUND(oi.unit_price * 100)::INTEGER
  END,
  total_price_int = CASE
    WHEN get_restaurant_currency((SELECT restaurant_id FROM orders WHERE id = oi.order_id)) = 'PYG' 
    THEN ROUND(oi.total_price)::INTEGER
    ELSE ROUND(oi.total_price * 100)::INTEGER
  END;

ALTER TABLE order_items DROP COLUMN unit_price;
ALTER TABLE order_items DROP COLUMN total_price;

ALTER TABLE order_items RENAME COLUMN unit_price_int TO unit_price;
ALTER TABLE order_items RENAME COLUMN total_price_int TO total_price;

ALTER TABLE order_items ALTER COLUMN unit_price SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN total_price SET NOT NULL;

-- ============================================================
-- 8. MARMITA_SIZES (base_price apenas; price_per_gram mantém DECIMAL)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marmita_sizes') THEN
    ALTER TABLE marmita_sizes ADD COLUMN IF NOT EXISTS base_price_int INTEGER;
    
    UPDATE marmita_sizes
    SET base_price_int = CASE
      WHEN get_restaurant_currency(restaurant_id) = 'PYG' THEN ROUND(base_price)::INTEGER
      ELSE ROUND(base_price * 100)::INTEGER
    END;
    
    ALTER TABLE marmita_sizes DROP COLUMN base_price;
    ALTER TABLE marmita_sizes RENAME COLUMN base_price_int TO base_price;
    ALTER TABLE marmita_sizes ALTER COLUMN base_price SET NOT NULL;
    
    -- price_per_gram mantém DECIMAL(10,4) por ser valor muito pequeno (ex: 0.0005)
    -- Será tratado separadamente se necessário
  END IF;
END $$;

-- ============================================================
-- NOTA: price_per_gram (marmitas)
-- ============================================================
-- As colunas price_per_gram em marmita_sizes, marmita_proteins e marmita_sides
-- permanecem como DECIMAL(10,4) por serem valores muito pequenos (centésimos de centavo por grama).
-- Se necessário migrar no futuro, usar estratégia de multiplicação por 100000 (BRL) ou 1000 (PYG).

-- Remover função auxiliar
DROP FUNCTION IF EXISTS get_restaurant_currency(UUID);

COMMIT;
