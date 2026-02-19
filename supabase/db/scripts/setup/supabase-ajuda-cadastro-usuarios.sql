-- ============================================================
-- CADASTRO DE USUÁRIOS – Preparar banco e habilitar função
-- ============================================================
-- O cadastro na aba "Usuários" usa a EDGE FUNCTION "create-restaurant-user".
-- Edge Functions NÃO são ativadas pelo SQL Editor: elas precisam ser
-- PUBLICADAS no projeto (Dashboard ou CLI).
--
-- Este script:
-- 1) Prepara o banco (garante que a tabela users está ok para receber novos usuários).
-- 2) Não substitui a necessidade de publicar a Edge Function (veja instruções abaixo).
-- ============================================================

-- Garantir que a tabela public.users existe e tem as colunas necessárias
-- (se já criou pelo schema principal, estes comandos não alteram nada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'Tabela public.users não existe. Execute primeiro o supabase-schema.sql';
  END IF;
END $$;

-- Verificar colunas esperadas pela Edge Function (id, email, role, restaurant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'restaurant_id'
  ) THEN
    RAISE EXCEPTION 'Coluna users.restaurant_id não existe. Execute o schema completo.';
  END IF;
END $$;

-- Opcional: policy para super_admin conseguir LER todos os usuários (para listar na tela).
-- A INSERÇÃO de novos usuários é feita pela Edge Function com service_role (ignora RLS).
DROP POLICY IF EXISTS "Super admin can read all users" ON users;
CREATE POLICY "Super admin can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- ============================================================
-- COMO PUBLICAR A EDGE FUNCTION (obrigatório para o cadastro funcionar)
-- ============================================================
-- 1) No Supabase: Project Settings → Edge Functions (ou "Functions").
-- 2) Clique em "Create a new function" / "New Function".
-- 3) Nome da função: create-restaurant-user
-- 4) Cole o código que está em: supabase/functions/create-restaurant-user/index.ts
--    (Ou use "Deploy from CLI": supabase functions deploy create-restaurant-user)
-- 5) As variáveis SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY
--    já são injetadas automaticamente pelo Supabase na Edge Function; não precisa configurar.
--
-- Alternativa sem Edge Function (cadastro pelo terminal):
--    node --env-file=.env.script scripts/criar-usuarios.js
--    (Configure .env.script com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY;
--     edite USUARIOS_CRIAR em scripts/criar-usuarios.js)
-- ============================================================

SELECT 'Banco preparado. Agora publique a Edge Function create-restaurant-user no Dashboard do Supabase.' AS mensagem;
