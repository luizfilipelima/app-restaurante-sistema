-- =============================================================================
-- Migration: Tipo de impressora e nome (Bluetooth, USB, Rede)
-- Data: 2026-05-07
--
-- Permite ao usuário indicar o tipo de conexão da impressora (Bluetooth, USB ou Rede)
-- e um nome opcional para referência. Útil para dicas de configuração e impressão.
-- =============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS print_printer_type TEXT DEFAULT 'usb'
  CHECK (print_printer_type IN ('bluetooth', 'usb', 'network'));

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS print_printer_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.print_printer_type IS
  'Tipo de conexão da impressora: bluetooth, usb ou network. Usado para exibir dicas de impressão.';

COMMENT ON COLUMN public.restaurants.print_printer_name IS
  'Nome opcional da impressora para referência do usuário (ex: Impressora Cozinha 58mm).';
