-- ============================================================
-- Criar usuário específico para um restaurante (public.users)
-- ============================================================
-- A senha NÃO é gravada aqui: defina-a ao criar o usuário no Auth.
-- Passo 1: Supabase → Authentication → Users → Add user (e-mail e senha) → copie o UID.
-- Passo 2: Substitua os valores abaixo e execute este script no SQL Editor.
--
-- Ordem dos campos: id, email, login (usuário), role, restaurant_id
-- ============================================================

-- Obter IDs dos restaurantes (rode antes para copiar o restaurant_id):
-- SELECT id, name, slug FROM public.restaurants ORDER BY name;

INSERT INTO public.users (id, email, login, role, restaurant_id)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- id: UID do usuário (Authentication → Users → copie o UUID)
  'email@restaurante.com',                   -- email
  'usuario_login',                           -- login (opcional; para entrar com usuário em vez de email)
  'restaurant_admin',                        -- role: use 'restaurant_admin' para admin do restaurante
  '00000000-0000-0000-0000-000000000000'   -- restaurant_id: UUID do restaurante (SELECT id FROM restaurants)
)
ON CONFLICT (id) DO UPDATE SET
  email       = EXCLUDED.email,
  login       = EXCLUDED.login,
  role        = EXCLUDED.role,
  restaurant_id = EXCLUDED.restaurant_id,
  updated_at  = NOW();

-- ============================================================
-- Exemplo com vários usuários (um por restaurante):
-- ============================================================
/*
INSERT INTO public.users (id, email, login, role, restaurant_id)
VALUES
  ('uid-usuario-1-aqui', 'admin@pizzaria.com', 'admin_pizzaria', 'restaurant_admin', 'uuid-restaurante-pizzaria'),
  ('uid-usuario-2-aqui', 'admin@lanchonete.com', 'admin_lanche', 'restaurant_admin', 'uuid-restaurante-lanchonete')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  login = EXCLUDED.login,
  role = EXCLUDED.role,
  restaurant_id = EXCLUDED.restaurant_id,
  updated_at = NOW();
*/

-- ============================================================
-- Senha: defina em Authentication → Users → Add user (e-mail + senha).
-- Depois use o UID desse usuário no campo id acima.
-- ============================================================
