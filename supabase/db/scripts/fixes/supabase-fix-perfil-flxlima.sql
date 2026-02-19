-- ============================================================
-- Corrigir perfil para flxlima9@gmail.com (UID já conhecido)
-- ============================================================
-- Execute no Supabase: SQL Editor → Cole TUDO → Run
-- Isso insere/atualiza seu perfil e garante a política de leitura.
-- ============================================================

-- 1) Inserir ou atualizar seu perfil com o UID exato do Auth
INSERT INTO public.users (id, email, role, restaurant_id)
VALUES (
  'f06291ab-08da-41a1-acfe-5d435eb17ee5',
  'flxlima9@gmail.com',
  'super_admin',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  restaurant_id = EXCLUDED.restaurant_id,
  updated_at = NOW();

-- 2) Garantir que você consegue LER o próprio perfil ao fazer login (RLS)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- 3) Super admin pode ler todos (para a aba Usuários)
DROP POLICY IF EXISTS "Super admin can read all users" ON public.users;
CREATE POLICY "Super admin can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Confirmação
SELECT id, email, role, restaurant_id FROM public.users WHERE id = 'f06291ab-08da-41a1-acfe-5d435eb17ee5';
