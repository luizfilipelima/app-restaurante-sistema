// Edge Function: criar usuário de restaurante com cargo específico
//
// Usa supabaseAdmin.auth.admin.createUser() — API oficial do GoTrue.
// Sempre retorna HTTP 200; erros são comunicados via { ok: false, error: string }.
//
// Deploy: supabase functions deploy create-restaurant-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = ['owner', 'manager', 'waiter', 'cashier', 'kitchen'] as const;
type RestaurantRole = typeof VALID_ROLES[number];

function toSystemRole(r: RestaurantRole) {
  return r === 'kitchen' ? 'kitchen' : 'restaurant_admin';
}

function ok(data: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ ok: true, ...data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function fail(error: string, detail?: string) {
  console.error('[create-restaurant-user] FAIL:', error, detail ?? '');
  return new Response(
    JSON.stringify({ ok: false, error, detail: detail ?? null }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth header ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('Token de autenticação ausente');

    const supabaseUrl            = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return fail('Variáveis de ambiente da Edge Function não configuradas');
    }

    // Admin client (bypassa RLS)
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Client com JWT do caller
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ── Verifica autenticação ──────────────────────────────────────────────────
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return fail('Não autenticado', callerErr?.message);
    }

    // ── Parse body (necessário antes da verificação de permissão) ───────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail('Body JSON inválido');
    }

    const restaurant_id = body.restaurant_id as string;
    if (!restaurant_id) return fail('restaurant_id é obrigatório');

    // ── Verifica permissão: super_admin OU proprietário do restaurante ──────────
    const { data: callerRow, error: roleErr } = await admin
      .from('users')
      .select('role, restaurant_id')
      .eq('id', caller.id)
      .single();

    if (roleErr) return fail('Erro ao verificar permissões', roleErr.message);

    const isSuperAdmin = callerRow?.role === 'super_admin';
    const isOwnerOfRestaurant =
      callerRow?.role === 'restaurant_admin' && callerRow?.restaurant_id === restaurant_id;

    let isOwnerViaRur = false;
    if (!isSuperAdmin && !isOwnerOfRestaurant) {
      const { data: rur } = await admin
        .from('restaurant_user_roles')
        .select('role')
        .eq('user_id', caller.id)
        .eq('restaurant_id', restaurant_id)
        .eq('is_active', true)
        .maybeSingle();
      isOwnerViaRur = rur?.role === 'owner';
    }

    if (!isSuperAdmin && !isOwnerOfRestaurant && !isOwnerViaRur) {
      return fail('Apenas super_admin ou proprietário do restaurante pode criar usuários');
    }

    // ── Valida demais campos do body ────────────────────────────────────────────
    const {
      email,
      password,
      login,
      restaurant_role = 'manager',
    } = body as Record<string, string>;

    if (!email || !password || !restaurant_id) {
      return fail('Campos obrigatórios: email, password, restaurant_id');
    }
    if ((password as string).length < 6) {
      return fail('Senha deve ter no mínimo 6 caracteres');
    }
    if (!VALID_ROLES.includes(restaurant_role as RestaurantRole)) {
      return fail(`Cargo inválido. Use: ${VALID_ROLES.join(', ')}`);
    }

    const normEmail = email.trim().toLowerCase();
    const normLogin = login ? String(login).trim().toLowerCase().replace(/\s+/g, '_') : null;
    const sysRole   = toSystemRole(restaurant_role as RestaurantRole);

    // ── Verifica duplicidade de login ─────────────────────────────────────────
    if (normLogin) {
      const { data: existingLogin } = await admin
        .from('users')
        .select('id')
        .eq('login', normLogin)
        .maybeSingle();

      if (existingLogin) return fail('duplicate_login: já existe um usuário com este nome de usuário');
    }

    // ── Cria usuário via GoTrue Admin API ─────────────────────────────────────
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true,
      user_metadata: { role: sysRole, restaurant_id, login: normLogin ?? '' },
      app_metadata:  { role: sysRole, restaurant_id },
    });

    if (authErr) {
      const msg = authErr.message ?? '';
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        // Usuário já existe no auth → atualiza perfil
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find((u) => u.email === normEmail);
        if (existing) {
          const row: Record<string, unknown> = { id: existing.id, email: normEmail, role: sysRole, restaurant_id };
          if (normLogin) row.login = normLogin;
          await admin.from('users').upsert(row, { onConflict: 'id' });
          await admin.from('restaurant_user_roles').upsert(
            { user_id: existing.id, restaurant_id, role: restaurant_role },
            { onConflict: 'user_id,restaurant_id' }
          );
          return ok({ message: 'Usuário já existia; perfil atualizado.', user_id: existing.id });
        }
      }
      return fail('Erro ao criar usuário no auth', msg);
    }

    const userId = authData.user!.id;

    // ── Cria perfil em public.users ───────────────────────────────────────────
    const profileRow: Record<string, unknown> = { id: userId, email: normEmail, role: sysRole, restaurant_id };
    if (normLogin) profileRow.login = normLogin;

    const { error: profileErr } = await admin.from('users').upsert(profileRow, { onConflict: 'id' });
    if (profileErr) {
      console.warn('[create-restaurant-user] Perfil não salvo:', profileErr.message);
    }

    // ── Vincula cargo em restaurant_user_roles ────────────────────────────────
    await admin.from('restaurant_user_roles').upsert(
      { user_id: userId, restaurant_id, role: restaurant_role },
      { onConflict: 'user_id,restaurant_id' }
    );

    return ok({ message: 'Usuário criado com sucesso.', user_id: userId, restaurant_role, system_role: sysRole });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[create-restaurant-user] EXCEPTION:', msg);
    return fail('Erro interno na Edge Function', msg);
  }
});
