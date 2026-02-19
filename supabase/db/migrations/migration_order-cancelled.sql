-- Permite status 'cancelled' em pedidos (remover/cancelar pedido)
-- Execute no SQL Editor do Supabase.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'));
