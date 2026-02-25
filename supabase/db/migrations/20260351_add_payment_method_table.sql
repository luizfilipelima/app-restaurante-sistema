-- Permite payment_method 'table' para pedidos de mesa (cliente paga posteriormente)
-- Executar no Supabase SQL Editor

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('pix', 'card', 'cash', 'table'));
