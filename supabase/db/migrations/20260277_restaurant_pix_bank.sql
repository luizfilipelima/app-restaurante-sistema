-- =============================================================================
-- Dados de pagamento do restaurante (PIX e Transferência)
-- Onde o cliente envia o pagamento quando escolhe PIX ou transferência bancária
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS bank_account JSONB;

COMMENT ON COLUMN public.restaurants.pix_key IS 'Chave PIX do restaurante — onde o cliente envia o pagamento';
COMMENT ON COLUMN public.restaurants.bank_account IS 'Dados bancários para transferência (PYG/ARS): {bank_name, agency, account, holder}';
