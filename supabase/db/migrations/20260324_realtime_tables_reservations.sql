-- =============================================================================
-- Migration: Realtime para Mesas, Zonas, Reservas e Fila de Espera
-- Data: 2026-03-24
-- Depende de: 20260321_reservations_waiting_queue_public.sql
--
-- Adiciona tabelas à publicação supabase_realtime para que as telas
-- Central de Mesas e Reservas atualizem em tempo real sem F5.
--
-- Tabelas: tables, hall_zones, waiter_calls, table_comanda_links, reservations, waiting_queue
-- =============================================================================

DO $$
BEGIN
  -- tables: mesas do restaurante (Central de Mesas)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
  END IF;

  -- hall_zones: zonas do salão (praças)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hall_zones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hall_zones;
  END IF;

  -- waiter_calls: chamados de garçom
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'waiter_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;
  END IF;

  -- table_comanda_links: vínculo mesa ↔ comanda física
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'table_comanda_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.table_comanda_links;
  END IF;

  -- reservations: reservas de mesas
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  END IF;

  -- waiting_queue: fila de espera (clientes sem reserva)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'waiting_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_queue;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: necessário para subscriptions filtradas (ex: restaurant_id=eq.xxx)
ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER TABLE public.hall_zones REPLICA IDENTITY FULL;
ALTER TABLE public.waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE public.table_comanda_links REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.waiting_queue REPLICA IDENTITY FULL;
