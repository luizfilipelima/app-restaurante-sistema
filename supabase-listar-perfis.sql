-- ============================================================
-- Ver quais perfis existem e quem tem Auth mas não tem perfil
-- ============================================================
-- Execute no Supabase: SQL Editor → Cole → Run
-- ============================================================

-- 1) Todos os perfis em public.users
SELECT id, email, role, restaurant_id, created_at
FROM public.users
ORDER BY created_at DESC;

-- 2) Usuários do Auth e se têm perfil (tem_perfil = Não → causa "perfil não encontrado")
SELECT
  au.id,
  au.email AS auth_email,
  u.email AS profile_email,
  u.role,
  u.restaurant_id,
  CASE WHEN u.id IS NOT NULL THEN 'Sim' ELSE 'Não' END AS tem_perfil
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
ORDER BY au.created_at DESC;
