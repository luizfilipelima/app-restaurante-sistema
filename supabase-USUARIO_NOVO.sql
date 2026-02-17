-- ============================================================
-- Criar usuário contato@luizfilipe.com.br como admin de um restaurante
-- ============================================================
-- Sempre: email = contato@luizfilipe.com.br, role = restaurant_admin.
-- Você define: id (UID do Auth), usuario_login, restaurant_id.
--
-- Passo 1: Supabase → Authentication → Users → Add user
--          E-mail: contato@luizfilipe.com.br
--          Senha: (a que você quiser)
--          Copie o UID do usuário criado.
--
-- Passo 2: Obtenha o UUID do restaurante (se ainda não tiver):
--          SELECT id, name, slug FROM public.restaurants ORDER BY name;
--
-- Passo 3: Substitua abaixo:
--          - ID_DO_USUARIO_NO_AUTH = UID copiado no passo 1
--          - SEU_USUARIO_LOGIN = login para entrar no sistema (ex: contato ou luizfilipe)
--          - UUID_DO_RESTAURANTE = id do restaurante (passo 2)
--
-- Passo 4: Execute este script no SQL Editor.
-- ============================================================

INSERT INTO public.users (id, email, login, role, restaurant_id)
VALUES (
  '151b6126-df3d-4b4a-a953-298f140c679b',     -- id: UID do usuário (Authentication → Users, após criar com contato@luizfilipe.com.br)
  'fagues@quiero.food',  -- email (fixo)
  'fagues',          -- login: nome de usuário para entrar (ex: contato, luizfilipe)
  'restaurant_admin',           -- role (sempre restaurant_admin)
  'bfc8c758-d05e-42d6-a86f-9bbe76833ff6'         -- restaurant_id: UUID do restaurante desejado
)
ON CONFLICT (id) DO UPDATE SET
  email        = EXCLUDED.email,
  login        = EXCLUDED.login,
  role         = EXCLUDED.role,
  restaurant_id = EXCLUDED.restaurant_id,
  updated_at   = NOW();

-- ============================================================
-- Exemplo preenchido (troque pelos seus valores reais):
-- ============================================================
/*
INSERT INTO public.users (id, email, login, role, restaurant_id)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-111111111111',
  'contato@luizfilipe.com.br',
  'contato',
  'restaurant_admin',
  'a1b2c3d4-e5f6-7890-abcd-222222222222'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  login = EXCLUDED.login,
  role = EXCLUDED.role,
  restaurant_id = EXCLUDED.restaurant_id,
  updated_at = NOW();
*/
