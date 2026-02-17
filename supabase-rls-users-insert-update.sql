-- ============================================================
-- RLS em public.users: permitir super_admin INSERT e UPDATE
-- ============================================================
-- Use este script quando o cadastro de usuários (admin/cozinha) falhar
-- com RLS ativo. A Edge Function create-restaurant-user usa service_role
-- (ignora RLS); este script cobre outros fluxos e garante permissões.
-- Requer que is_super_admin() e as políticas de SELECT já existam
-- (rode supabase-rls-users-reativar.sql antes, se ainda não rodou).
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================

-- Garantir que a função exista (se você só rodar este arquivo)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Super admin pode inserir novos usuários (ex.: cadastro pelo painel)
DROP POLICY IF EXISTS "Super admin can insert users" ON public.users;
CREATE POLICY "Super admin can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Super admin pode atualizar usuários (ex.: alterar role ou restaurant_id)
DROP POLICY IF EXISTS "Super admin can update users" ON public.users;
CREATE POLICY "Super admin can update users"
  ON public.users FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
SELECT 'Políticas de INSERT e UPDATE para super_admin aplicadas.' AS mensagem;
