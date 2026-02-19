-- ============================================================
-- Inserir MEU usuário em public.users (para poder fazer login)
-- ============================================================
-- Use quando aparecer: "Login aceito, mas seu perfil não foi encontrado no sistema."
-- O usuário já existe no Auth; este script cria a linha em public.users.
--
-- 1) Troque 'flxlima9@gmail.com' pelo SEU email (o mesmo que você usa para entrar).
-- 2) Escolha a role: 'super_admin' (acesso total) ou 'restaurant_admin'/'kitchen' (aí preencha restaurant_id).
-- 3) Execute no Supabase: SQL Editor → Cole → Run
-- ============================================================

INSERT INTO public.users (id, email, role, restaurant_id)
SELECT
  au.id,
  au.email,
  'super_admin',           -- ou 'restaurant_admin' ou 'kitchen'
  NULL                     -- para super_admin use NULL; para outros, use o UUID do restaurante
FROM auth.users au
WHERE au.email = 'flxlima9@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id);

-- Se você quiser ser admin de UM restaurante em vez de super_admin:
-- 1) Descubra o ID do restaurante: SELECT id, name FROM restaurants;
-- 2) Troque 'super_admin' por 'restaurant_admin' (ou 'kitchen')
-- 3) Troque NULL por 'uuid-do-restaurante'
--
-- Exemplo para restaurant_admin:
-- INSERT INTO public.users (id, email, role, restaurant_id)
-- SELECT au.id, au.email, 'restaurant_admin', 'COLE-O-UUID-DO-RESTAURANTE'
-- FROM auth.users au WHERE au.email = 'flxlima9@gmail.com'
-- ON CONFLICT (id) DO NOTHING;

SELECT 'Perfil criado. Tente fazer login novamente.' AS mensagem;
