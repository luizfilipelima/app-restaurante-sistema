-- =====================================================
-- MIGRAÇÃO: Coluna courier_id na tabela orders
-- Permite atribuir um entregador (motoboy) ao pedido
-- =====================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);

COMMENT ON COLUMN orders.courier_id IS 'Entregador atribuído ao pedido (opcional)';

SELECT 'Coluna orders.courier_id criada.' AS mensagem;
