-- Horários de funcionamento e status aberto/fechado
-- Execute no SQL Editor do Supabase se já tiver a tabela restaurants criada.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE;

-- opening_hours: chaves "mon", "tue", "wed", "thu", "fri", "sat", "sun"
-- cada valor: { "open": "11:00", "close": "23:00" } ou null para fechado
-- Exemplo: { "mon": { "open": "11:00", "close": "23:00" }, "tue": { "open": "11:00", "close": "23:00" }, ... }
