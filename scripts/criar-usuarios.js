/**
 * Script para criar usuários no Supabase (Auth + tabela public.users)
 *
 * Uso:
 * 1. No Supabase: Settings → API → copie "Project URL" e "service_role" (secret)
 * 2. Crie .env.script na raiz (veja scripts/.env.script.example)
 * 3. Edite USUARIOS_CRIAR abaixo (emails, senhas, roles, restaurant_id)
 * 4. ID do restaurante: no Supabase SQL Editor: SELECT id, name FROM restaurants;
 * 5. Execute (Node 20+ carrega .env.script automaticamente):
 *    node --env-file=.env.script scripts/criar-usuarios.js
 *    Ou: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=yyy node scripts/criar-usuarios.js
 */

import { createClient } from '@supabase/supabase-js';

// ========== CONFIGURAÇÃO (edite aqui) ==========

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Exemplo: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=yyy node scripts/criar-usuarios.js\n');
  process.exit(1);
}

/**
 * Lista de usuários a criar.
 * - role: 'super_admin' | 'restaurant_admin' | 'kitchen'
 * - restaurant_id: obrigatório para restaurant_admin e kitchen (UUID do restaurante)
 *   Para obter: no Supabase SQL Editor: SELECT id, name FROM restaurants;
 */
const USUARIOS_CRIAR = [
  {
    email: 'admin@meurestaurante.com',
    password: 'TroqueEstaSenha123!',
    role: 'restaurant_admin',
    restaurant_id: 'COLE_O_RESTAURANT_ID_AQUI', // UUID do restaurante
  },
  {
    email: 'cozinha@meurestaurante.com',
    password: 'TroqueEstaSenha123!',
    role: 'kitchen',
    restaurant_id: 'COLE_O_RESTAURANT_ID_AQUI',
  },
  // Adicione mais usuários conforme necessário:
  // {
  //   email: 'outro@email.com',
  //   password: 'SenhaSegura123!',
  //   role: 'kitchen',
  //   restaurant_id: 'uuid-do-restaurante',
  // },
];

// ========== EXECUÇÃO ==========

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function criarUsuario({ email, password, role, restaurant_id }) {
  if ((role === 'restaurant_admin' || role === 'kitchen') && !restaurant_id) {
    throw new Error(`Usuário ${email}: restaurant_id é obrigatório para role ${role}`);
  }
  if (restaurant_id === 'COLE_O_RESTAURANT_ID_AQUI') {
    throw new Error(`Usuário ${email}: substitua COLE_O_RESTAURANT_ID_AQUI pelo UUID real do restaurante`);
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log(`⚠️  ${email} já existe no Auth. Tentando apenas atualizar public.users...`);
      const { data: existing } = await supabase.auth.admin.listUsers();
      const user = existing?.users?.find((u) => u.email === email);
      if (!user) {
        throw new Error(`Não foi possível encontrar o usuário ${email} no Auth.`);
      }
      await inserirNaTabelaUsers(user.id, email, role, restaurant_id);
      return { email, id: user.id, status: 'users_updated' };
    }
    throw authError;
  }

  const userId = authData.user.id;
  await inserirNaTabelaUsers(userId, email, role, restaurant_id);
  return { email, id: userId, status: 'created' };
}

async function inserirNaTabelaUsers(id, email, role, restaurant_id) {
  const row = {
    id,
    email,
    role,
    ...(restaurant_id && restaurant_id !== 'COLE_O_RESTAURANT_ID_AQUI' ? { restaurant_id } : {}),
  };
  const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

async function main() {
  console.log('\n🔐 Criando usuários no Supabase...\n');

  for (const u of USUARIOS_CRIAR) {
    try {
      const result = await criarUsuario(u);
      console.log(`✅ ${u.email} (${u.role}) – ${result.status}`);
    } catch (err) {
      console.error(`❌ ${u.email}: ${err.message}`);
    }
  }

  console.log('\n✨ Concluído. Faça login no app com os emails e senhas definidos.\n');
}

main();
