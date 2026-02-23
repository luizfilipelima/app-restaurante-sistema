-- Migration: Habilitar Realtime para order_items
-- Data: 2026-03-11
--
-- Motivo: Quando o cliente adiciona itens a um pedido de mesa existente,
-- order_items é atualizado. A Central de Mesas precisa reagir em tempo real.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;

ALTER TABLE public.order_items REPLICA IDENTITY FULL;
