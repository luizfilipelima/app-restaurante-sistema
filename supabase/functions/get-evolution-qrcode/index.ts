// Edge Function: obter QR Code da Evolution API
// Fluxo: 1) GET /instance/connect — se 200, retorna QR; se 404, cria instância e depois obtém QR
// Evita POST /instance/create quando a instância já existe (403).
// Deploy: npx supabase functions deploy get-evolution-qrcode
// Secrets: EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY, WEBHOOK_BASE_URL (opcional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Headers para chamadas à Evolution API */
function evolutionHeaders(evolutionKey: string, contentType = false): Record<string, string> {
  const h: Record<string, string> = { apikey: evolutionKey };
  if (contentType) h['Content-Type'] = 'application/json';
  return h;
}

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
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader || typeof authHeader !== 'string') return fail('Token de autenticação ausente. Faça login novamente.', 401);

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail('Token inválido. Faça login novamente.', 401);

    const evolutionBase = Deno.env.get('EVOLUTION_API_BASE_URL')?.trim();
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')?.trim();
    const webhookBase = Deno.env.get('WEBHOOK_BASE_URL')?.trim();

    if (!evolutionBase || !evolutionKey) {
      console.error('[get-evolution-qrcode] EVOLUTION_API_BASE_URL ou EVOLUTION_API_KEY não configurados');
      return fail('Evolution API não configurada', 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr) {
      console.warn('[get-evolution-qrcode] Auth error:', authErr.message);
      return fail('Sessão expirada ou inválida. Faça logout e login novamente.', 401);
    }
    if (!user) return fail('Sessão expirada ou inválida. Faça logout e login novamente.', 401);

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
      .select('id, whatsapp_evolution_enabled, evolution_instance_name, whatsapp, phone')
      .eq('id', restaurantId)
      .single();

    if (restErr || !restaurant) return fail('Restaurante não encontrado', 404);
    if (!(restaurant as { whatsapp_evolution_enabled?: boolean }).whatsapp_evolution_enabled) {
      return fail('WhatsApp Evolution não habilitado para este restaurante', 403);
    }

    const instanceName = toInstanceName(restaurantId);
    const baseUrl = evolutionBase.replace(/\/$/, '');

    const whatsapp = (restaurant as { whatsapp?: string; phone?: string })?.whatsapp?.trim();
    const phone = (restaurant as { phone?: string })?.phone?.trim();
    let numberParam = (whatsapp || phone || '').replace(/\D/g, '');
    if (numberParam.length >= 10 && numberParam.length <= 11 && !numberParam.startsWith('55') && !numberParam.startsWith('595') && !numberParam.startsWith('54')) {
      numberParam = '55' + numberParam;
    }
    const qs = numberParam ? `?number=${encodeURIComponent(numberParam)}` : '';

    // 1. Tentar GET /instance/connect primeiro (instância já existe?)
    const firstConnectRes = await fetch(
      `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}${qs}`,
      { method: 'GET', headers: evolutionHeaders(evolutionKey) }
    );
    const firstConnectData = await firstConnectRes.json().catch(() => ({}));

    if (firstConnectRes.status === 404 || firstConnectRes.status === 400) {
      const msg = String((firstConnectData as { message?: string })?.message ?? '').toLowerCase();
      const isNotFound = firstConnectRes.status === 404 || msg.includes('not found') || msg.includes('não encontrad') || msg.includes('does not exist') || msg.includes('não existe');
      if (!isNotFound) {
        console.error('[get-evolution-qrcode] Connect erro inesperado:', firstConnectRes.status, firstConnectData);
        return fail(
          (firstConnectData as { message?: string })?.message || `Erro ao obter instância: ${firstConnectRes.status}`,
          502
        );
      }
      // 2. Instância não existe — criar
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
        headers: evolutionHeaders(evolutionKey, true),
        body: JSON.stringify(createBody),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        const createMsg = (createData as { message?: string })?.message || '';
        console.error('[get-evolution-qrcode] Create instance erro:', createRes.status, createData);
        return fail(createMsg || `Erro ao criar instância: ${createRes.status}`, 502);
      }
      await admin
        .from('restaurants')
        .update({ evolution_instance_name: instanceName, updated_at: new Date().toISOString() })
        .eq('id', restaurantId);
    } else if (!firstConnectRes.ok) {
      console.error('[get-evolution-qrcode] Connect erro:', firstConnectRes.status, firstConnectData);
      return fail(
        (firstConnectData as { message?: string })?.message || `Erro ao obter QR: ${firstConnectRes.status}`,
        502
      );
    } else {
      await admin
        .from('restaurants')
        .update({ evolution_instance_name: instanceName, updated_at: new Date().toISOString() })
        .eq('id', restaurantId);
    }

    // 3. Obter QR Code (retry quando count=0 — Evolution API pode demorar para gerar)
    let connectData: Record<string, unknown> = firstConnectRes.ok ? firstConnectData : {};
    const hasValidQr = (d: Record<string, unknown>) => {
      const hasCode = !!(d?.code as string);
      const hasBase64 = !!(d?.base64 as string);
      const count = d?.count as number | undefined;
      const hasPairing = !!(d?.pairingCode as string) && (count ?? 0) > 0;
      return hasCode || hasBase64 || hasPairing;
    };
    if (hasValidQr(connectData)) {
      return ok({ data: connectData, instanceName });
    }
    const maxRetries = 4;
    const retryDelayMs = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const connectRes = await fetch(
        `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}${qs}`,
        { method: 'GET', headers: evolutionHeaders(evolutionKey) }
      );

      connectData = await connectRes.json().catch(() => ({}));

      if (!connectRes.ok) {
        console.error('[get-evolution-qrcode] Connect erro:', connectRes.status, connectData);
        return fail(
          (connectData as { message?: string })?.message || `Erro ao obter QR: ${connectRes.status}`,
          502
        );
      }

      const count = (connectData as { count?: number }).count;
      const hasCode = !!(connectData as { code?: string }).code;
      const hasBase64 = !!(connectData as { base64?: string }).base64;
      const hasPairingCode = !!(connectData as { pairingCode?: string }).pairingCode;

      if (hasCode || hasBase64 || (hasPairingCode && count > 0)) {
        break;
      }

      if (attempt < maxRetries && (count === 0 || !hasCode) && !hasBase64) {
        console.warn(`[get-evolution-qrcode] Tentativa ${attempt}/${maxRetries}, count=${count ?? '?'}, aguardando ${retryDelayMs}ms...`);
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }

    const finalCount = (connectData as { count?: number }).count;
    const finalCode = (connectData as { code?: string }).code;
    const finalBase64 = (connectData as { base64?: string }).base64;
    if ((finalCount === 0 || (!finalCode && !finalBase64)) && maxRetries > 1) {
      console.warn('[get-evolution-qrcode] QR não disponível após retries. Resposta:', JSON.stringify(connectData));
    }

    return ok({ data: connectData, instanceName });
  } catch (e) {
    console.error('[get-evolution-qrcode]', e);
    return fail(e instanceof Error ? e.message : 'Erro interno', 500);
  }
});
