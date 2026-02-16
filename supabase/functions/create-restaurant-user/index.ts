// Edge Function: criar usuário de restaurante (admin ou cozinha)
// Só pode ser chamada por um usuário com role super_admin.
// Deploy: supabase functions deploy create-restaurant-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

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
        JSON.stringify({ error: 'Apenas super admin pode criar usuários de restaurante' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { email, password, role, restaurant_id } = body;

    if (!email || !password || !role || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, password, role, restaurant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedRoles = ['restaurant_admin', 'kitchen'];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'role deve ser restaurant_admin ou kitchen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === email);
        if (existing) {
          await supabaseAdmin.from('users').upsert(
            { id: existing.id, email, role, restaurant_id },
            { onConflict: 'id' }
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
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .upsert({ id: userId, email, role, restaurant_id }, { onConflict: 'id' });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Usuário criado no Auth, mas falha ao salvar perfil: ' + insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Usuário criado.', user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
