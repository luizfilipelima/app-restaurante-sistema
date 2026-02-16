-- País do telefone/WhatsApp (BR ou PY) e link do Instagram
-- Execute no SQL Editor do Supabase se já tiver a tabela restaurants criada.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS phone_country VARCHAR(2) DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;
