-- =============================================================================
-- Migration: Novos métodos de pagamento no checkout
-- - Adiciona: qrcode, bank_transfer
-- - Cartão e QR Code: apenas na entrega (regra de UI)
-- - Dinheiro, PIX, Transferência: sempre disponíveis
-- - Colunas opcionais para chave PIX e conta bancária do cliente
-- =============================================================================

-- Atualiza constraint de payment_method
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('pix', 'card', 'cash', 'table', 'qrcode', 'bank_transfer'));

-- Colunas opcionais para dados de pagamento do cliente
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_bank_account JSONB;

COMMENT ON COLUMN public.orders.payment_pix_key IS 'Chave PIX do cliente (quando pagamento PIX)';
COMMENT ON COLUMN public.orders.payment_bank_account IS 'Dados da conta bancária do cliente para transferência (PYG/ARS): {bank_name, agency, account, holder}';
