-- =====================================================
-- Migration: Configurações de impressão (cupom) por restaurante
-- Execute após supabase-schema.sql e políticas de restaurants
-- =====================================================

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS print_auto_on_new_order BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS print_paper_width TEXT DEFAULT '80mm' CHECK (print_paper_width IN ('58mm', '80mm'));

COMMENT ON COLUMN restaurants.print_auto_on_new_order IS 'Se true, imprime cupom automaticamente ao receber novo pedido (Realtime)';
COMMENT ON COLUMN restaurants.print_paper_width IS 'Largura do papel para impressoras térmicas: 58mm ou 80mm';
