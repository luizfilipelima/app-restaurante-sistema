-- ============================================================
-- CRIAR SUPER ADMIN - Execute APENAS isto em uma NOVA query
-- ============================================================
-- No Supabase: SQL Editor → New query → Cole o bloco abaixo → Run
-- ============================================================

-- Opção 1: Se você NUNCA rodou create_super_admin para este usuário:
SELECT create_super_admin(
  'flxlima9@gmail.com',
  'f06291ab-08da-41a1-acfe-5d435eb17ee5'
);

-- ============================================================
-- Se der erro "duplicate key" (usuário já existe), use a Opção 2:
-- ============================================================

-- Opção 2: Inserir/atualizar direto na tabela users
INSERT INTO users (id, email, role)
VALUES (
  'f06291ab-08da-41a1-acfe-5d435eb17ee5',
  'flxlima9@gmail.com',
  'super_admin'
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin', email = EXCLUDED.email;

-- ============================================================
-- Depois, confira se deu certo:
-- ============================================================
-- SELECT * FROM users;
