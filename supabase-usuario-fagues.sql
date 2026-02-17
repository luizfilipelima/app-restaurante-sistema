-- ============================================================
-- Criar usuário fagues@quiero.food como admin do restaurante Fagues
-- ============================================================
-- Dados do usuário:
--   UID: 151b6126-df3d-4b4a-a953-298f140c679b
--   Email: fagues@quiero.food
--   Login: fagues
--   Role: restaurant_admin
--   Restaurant ID: bfc8c758-d05e-42d6-a86f-9bbe76833ff6
--
-- Passo 1: Supabase → Authentication → Users → Add user
--          E-mail: fagues@quiero.food
--          Senha: (defina a senha desejada)
--          Copie o UID do usuário criado (deve ser: 151b6126-df3d-4b4a-a953-298f140c679b)
--
-- Passo 2: Execute este script no SQL Editor.
-- ============================================================

INSERT INTO public.users (id, email, login, role, restaurant_id)
VALUES (
  '151b6126-df3d-4b4a-a953-298f140c679b',     -- id: UID do usuário (Authentication → Users)
  'fagues@quiero.food',                        -- email
  'fagues',                                     -- login: nome de usuário para entrar no sistema
  'restaurant_admin',                           -- role
  'bfc8c758-d05e-42d6-a86f-9bbe76833ff6'       -- restaurant_id: UUID do restaurante Fagues
)
ON CONFLICT (id) DO UPDATE SET
  email        = EXCLUDED.email,
  login        = EXCLUDED.login,
  role         = EXCLUDED.role,
  restaurant_id = EXCLUDED.restaurant_id,
  updated_at   = NOW();

-- Verificar se o usuário foi criado corretamente
SELECT 
  u.id,
  u.email,
  u.login,
  u.role,
  r.name as restaurant_name,
  r.slug as restaurant_slug
FROM public.users u
LEFT JOIN public.restaurants r ON u.restaurant_id = r.id
WHERE u.id = '151b6126-df3d-4b4a-a953-298f140c679b';
