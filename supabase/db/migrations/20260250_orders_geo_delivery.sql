-- =====================================================
-- Migração: Sistema de entrega por coordenadas
-- Adiciona latitude, longitude e address_details na tabela orders
-- =====================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_details TEXT;

COMMENT ON COLUMN orders.latitude IS 'Latitude do endereço de entrega (Geolocalização)';
COMMENT ON COLUMN orders.longitude IS 'Longitude do endereço de entrega (Geolocalização)';
COMMENT ON COLUMN orders.address_details IS 'Detalhes da entrega: Apto, Bloco, Referência';

CREATE INDEX IF NOT EXISTS idx_orders_lat_lng ON orders(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

SELECT 'Colunas geo orders criadas.' AS mensagem;
