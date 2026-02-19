-- =============================================================================
-- MIGRATION: Habilitar Realtime para tabelas críticas
-- Data: 2026-02-26
-- =============================================================================
--
-- Motivo: O Supabase Realtime (postgres_changes) só recebe eventos de tabelas
-- que estão na publicação supabase_realtime. Sem isso, as subscriptions no
-- frontend nunca recebem INSERT/UPDATE/DELETE e o usuário precisa dar F5.
--
-- Tabelas afetadas:
--   • orders             — tela de Pedidos (Gestão de Pedidos)
--   • virtual_comandas   — tela Caixa / Comanda Digital (comandas virtuais)
--   • virtual_comanda_items — itens das comandas virtuais ( atualização em tempo real)
--
-- Referência: https://supabase.com/docs/guides/realtime/postgres-changes
-- =============================================================================

-- Adiciona tabelas à publicação supabase_realtime de forma idempotente.
-- Se a tabela já estiver na publicação, o bloco ignora o erro.
DO $$
BEGIN
  -- orders: para a tela de Gestão de Pedidos
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  -- virtual_comandas: para a tela Caixa / Comanda Digital (lista de comandas)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'virtual_comandas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_comandas;
  END IF;

  -- virtual_comanda_items: para atualização em tempo real dos itens da comanda selecionada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'virtual_comanda_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_comanda_items;
  END IF;
END $$;

-- Para subscriptions filtradas em restaurant_id/comanda_id, o PostgreSQL precisa
-- incluir as colunas no WAL. REPLICA IDENTITY FULL garante isso.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.virtual_comandas REPLICA IDENTITY FULL;
ALTER TABLE public.virtual_comanda_items REPLICA IDENTITY FULL;
