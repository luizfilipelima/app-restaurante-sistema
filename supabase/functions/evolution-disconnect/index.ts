// Edge Function: desconectar WhatsApp da instância Evolution API
// Chama instance/logout e atualiza whatsapp_connected = false no Supabase
// Deploy: npx supabase functions deploy evolution-disconnect

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('Token de autenticação ausente. Faça login novamente.', 401);

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail('Token inválido. Faça login novamente.', 401);

    const evolutionBase = Deno.env.get('EVOLUTION_API_BASE_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionBase || !evolutionKey) return fail('Evolution API não configurada', 500);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return fail('Sessão expirada ou inválida. Faça logout e login novamente.', 401);

    let restaurantId: string | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      restaurantId = (body?.restaurantId as string)?.trim();
    } catch {}
    if (!restaurantId) return fail('restaurantId obrigatório');

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('evolution_instance_name')
      .eq('id', restaurantId)
      .single();

    const instanceName = (restaurant as { evolution_instance_name?: string })?.evolution_instance_name;
    if (!instanceName) return fail('Instância não configurada para este restaurante', 404);

    const baseUrl = evolutionBase.replace(/\/$/, '');
    const logoutRes = await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: 'DELETE',
      headers: { 'apikey': evolutionKey },
    });

    await admin
      .from('restaurants')
      .update({ whatsapp_connected: false, updated_at: new Date().toISOString() })
      .eq('id', restaurantId);

    if (!logoutRes.ok) {
      const data = await logoutRes.json().catch(() => ({}));
      console.warn('[evolution-disconnect] Logout API:', logoutRes.status, data);
    }

    return ok({ message: 'WhatsApp desconectado' });
  } catch (e) {
    console.error('[evolution-disconnect]', e);
    return fail(e instanceof Error ? e.message : 'Erro interno', 500);
  }
});
