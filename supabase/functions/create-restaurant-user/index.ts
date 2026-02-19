// Edge Function: criar usuário de restaurante com cargo específico
//
// IMPORTANTE: usa supabaseAdmin.auth.admin.createUser() — API oficial do GoTrue.
// NÃO insere diretamente em auth.users via SQL (isso causa "Database error querying schema" no login).
//
// Cargos suportados (restaurant_role_type): owner | manager | waiter | cashier | kitchen
// Deploy: supabase functions deploy create-restaurant-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_RESTAURANT_ROLES = ['owner', 'manager', 'waiter', 'cashier', 'kitchen'] as const;
type RestaurantRole = typeof VALID_RESTAURANT_ROLES[number];

/**
 * Mapeia cargo do restaurante para system_role em public.users.
 * kitchen → 'kitchen'
 * demais  → 'restaurant_admin'
 */
function toSystemRole(restaurantRole: RestaurantRole): string {
  return restaurantRole === 'kitchen' ? 'kitchen' : 'restaurant_admin';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Cliente com service_role (ignora RLS para operações admin)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Cliente com JWT do caller para verificar autenticação
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ── Verifica autenticação e permissão ──────────────────────────────────────
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerRow?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas super_admin pode criar usuários de restaurante' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Valida body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      email,
      password,
      restaurant_id,
      login,
      restaurant_role = 'manager',
    } = body;

    if (!email || !password || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, password, restaurant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_RESTAURANT_ROLES.includes(restaurant_role)) {
      return new Response(
        JSON.stringify({ error: `Cargo inválido. Use: ${VALID_RESTAURANT_ROLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedLogin = login ? String(login).trim().toLowerCase().replace(/\s+/g, '_') : null;
    const systemRole = toSystemRole(restaurant_role as RestaurantRole);

    // ── Verifica duplicidade de login ─────────────────────────────────────────
    if (normalizedLogin) {
      const { data: existingLogin } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('login', normalizedLogin)
        .maybeSingle();

      if (existingLogin) {
        return new Response(
          JSON.stringify({ error: 'duplicate_login: já existe um usuário com este nome de usuário' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Cria usuário via API Admin do GoTrue (evita "Database error querying schema") ──
    // auth.admin.createUser() inicializa corretamente todo o estado interno do GoTrue.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,   // e-mail já confirmado — criado pelo super-admin
      user_metadata: {
        role: systemRole,
        restaurant_id,
        login: normalizedLogin ?? '',
      },
      app_metadata: {
        role: systemRole,
        restaurant_id,
      },
    });

    if (authError) {
      // Usuário já existe no auth → atualiza perfil
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find((u) => u.email === normalizedEmail);

        if (existing) {
          // Atualiza public.users
          const profileRow: Record<string, unknown> = {
            id: existing.id,
            email: normalizedEmail,
            role: systemRole,
            restaurant_id,
          };
          if (normalizedLogin) profileRow.login = normalizedLogin;
          await supabaseAdmin.from('users').upsert(profileRow, { onConflict: 'id' });

          // Upsert restaurant_user_roles
          await supabaseAdmin
            .from('restaurant_user_roles')
            .upsert(
              { user_id: existing.id, restaurant_id, role: restaurant_role },
              { onConflict: 'user_id,restaurant_id' }
            );

          return new Response(
            JSON.stringify({ message: 'Usuário já existia; perfil atualizado.', user_id: existing.id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user!.id;

    // ── Cria/atualiza perfil em public.users ──────────────────────────────────
    const profileRow: Record<string, unknown> = {
      id: userId,
      email: normalizedEmail,
      role: systemRole,
      restaurant_id,
    };
    if (normalizedLogin) profileRow.login = normalizedLogin;

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert(profileRow, { onConflict: 'id' });

    if (profileError) {
      // Auth criou, mas perfil falhou — retorna aviso ao invés de travar
      console.error('Perfil não criado:', profileError.message);
      return new Response(
        JSON.stringify({
          warning: 'Usuário criado no Auth, mas falha ao salvar perfil: ' + profileError.message,
          user_id: userId,
        }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Vincula cargo na tabela restaurant_user_roles ─────────────────────────
    await supabaseAdmin
      .from('restaurant_user_roles')
      .upsert(
        { user_id: userId, restaurant_id, role: restaurant_role },
        { onConflict: 'user_id,restaurant_id' }
      );

    return new Response(
      JSON.stringify({
        message: 'Usuário criado com sucesso.',
        user_id: userId,
        email: normalizedEmail,
        restaurant_role,
        system_role: systemRole,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('Erro interno:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
