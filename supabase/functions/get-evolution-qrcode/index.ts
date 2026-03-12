// Edge Function: criar instância (se não existir) + obter QR Code da Evolution API
// Nome da instância: rest_${restaurantId} (UUID com _ no lugar de -)
// Deploy: npx supabase functions deploy get-evolution-qrcode
// Secrets: EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY, WEBHOOK_BASE_URL (opcional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Gera nome da instância: rest_xxx a partir do restaurantId */
export function toInstanceName(restaurantId: string): string {
  return `rest_${restaurantId.replace(/-/g, '_')}`;
}

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
    if (!authHeader) return fail('Token de autenticação ausente');

    const evolutionBase = Deno.env.get('EVOLUTION_API_BASE_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const webhookBase = Deno.env.get('WEBHOOK_BASE_URL');

    if (!evolutionBase || !evolutionKey) {
      console.error('[get-evolution-qrcode] EVOLUTION_API_BASE_URL ou EVOLUTION_API_KEY não configurados');
      return fail('Evolution API não configurada', 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return fail('Não autenticado', 401);

    let restaurantId: string | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      restaurantId = (body?.restaurantId as string)?.trim();
    } catch {
      // body vazio
    }
    if (!restaurantId) return fail('Parâmetro restaurantId obrigatório');

    // Verifica se restaurante existe e se usuário tem acesso
    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .select('id, whatsapp_evolution_enabled, evolution_instance_name')
      .eq('id', restaurantId)
      .single();

    if (restErr || !restaurant) return fail('Restaurante não encontrado', 404);
    if (!(restaurant as { whatsapp_evolution_enabled?: boolean }).whatsapp_evolution_enabled) {
      return fail('WhatsApp Evolution não habilitado para este restaurante', 403);
    }

    const instanceName = toInstanceName(restaurantId);
    const baseUrl = evolutionBase.replace(/\/$/, '');

    // 1. Criar instância se não existir
    const createBody: Record<string, unknown> = {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    };
    if (webhookBase) {
      const webhookUrl = `${webhookBase.replace(/\/$/, '')}/api/webhooks/evolution`;
      createBody.webhook = {
        enabled: true,
        url: webhookUrl,
        webhook_by_events: false,
        events: ['CONNECTION_UPDATE'],
      };
    }

    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    });

    const createData = await createRes.json().catch(() => ({}));

    if (!createRes.ok) {
      const msg = (createData as { message?: string })?.message || '';
      if (createRes.status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exist')) {
        // Instância já existe — continua para obter QR
      } else {
        console.error('[get-evolution-qrcode] Create instance erro:', createRes.status, createData);
        return fail(msg || `Erro ao criar instância: ${createRes.status}`, 502);
      }
    }

    // 2. Salvar evolution_instance_name no banco
    await admin
      .from('restaurants')
      .update({
        evolution_instance_name: instanceName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId);

    // 3. Obter QR Code
    const connectRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
      headers: { 'apikey': evolutionKey },
    });

    const connectData = await connectRes.json().catch(() => ({}));

    if (!connectRes.ok) {
      console.error('[get-evolution-qrcode] Connect erro:', connectRes.status, connectData);
      return fail(
        (connectData as { message?: string })?.message || `Erro ao obter QR: ${connectRes.status}`,
        502
      );
    }

    return ok({ data: connectData, instanceName });
  } catch (e) {
    console.error('[get-evolution-qrcode]', e);
    return fail(e instanceof Error ? e.message : 'Erro interno', 500);
  }
});
