/**
 * Webhook Evolution API — CONNECTION_UPDATE
 *
 * Recebe POST da Evolution API quando o status da conexão muda.
 * - state === 'open'  → whatsapp_connected = true
 * - state === 'close' → whatsapp_connected = false (desconexão no WhatsApp)
 *
 * Payload típico:
 * - event: "CONNECTION_UPDATE"
 * - instance ou instanceName: nome da instância (ex: rest_550e8400_e29b_41d4_a716_446655440000)
 * - state ou data.state: "open" | "close" | etc.
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function toRestaurantId(instanceName: string): string | null {
  if (!instanceName || typeof instanceName !== 'string') return null;
  const trimmed = instanceName.trim();
  if (!trimmed.startsWith('rest_')) return null;
  const uuidPart = trimmed.slice(5).replace(/_/g, '-');
  // UUID v4: 8-4-4-4-12
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuidPart) ? uuidPart : null;
}

function getState(payload: Record<string, unknown>): string | null {
  const data = payload.data as Record<string, unknown> | undefined;
  const instance = payload.instance as Record<string, unknown> | string | undefined;
  const state =
    (data?.state as string) ??
    (typeof instance === 'object' && instance && 'state' in instance ? (instance.state as string) : null) ??
    (payload.state as string);
  return state && typeof state === 'string' ? state.toLowerCase() : null;
}

function getInstanceName(payload: Record<string, unknown>): string | null {
  const instance = payload.instance;
  if (typeof instance === 'string' && instance) return instance;
  if (instance && typeof instance === 'object' && 'instanceName' in instance) {
    const v = (instance as Record<string, unknown>).instanceName;
    return typeof v === 'string' ? v : null;
  }
  return (payload.instanceName as string) ?? null;
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (n: number) => { json: (o: object) => void; end: () => void }; setHeader: (k: string, v: string) => void; end: () => void }
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const payload = body && typeof body === 'object' ? body : {};

    const ev = payload.event as string | undefined;
    const event = (ev ?? '').toString().toUpperCase().replace(/\./g, '_');
    if (event !== 'CONNECTION_UPDATE') {
      return res.status(200).json({ ok: true, ignored: true, reason: 'event_not_connection_update', event });
    }

    const state = getState(payload);
    const isOpen = state === 'open';
    const isClose = state === 'close';

    if (!isOpen && !isClose) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'state_not_open_or_close', state });
    }

    const instanceName = getInstanceName(payload);
    const restaurantId = instanceName ? toRestaurantId(instanceName) : null;
    if (!restaurantId) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'instance_not_rest', instanceName });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('[webhooks/evolution] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes');
      return res.status(500).json({ ok: false, error: 'Configuração do servidor incompleta' });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const updatePayload: Record<string, unknown> = {
      whatsapp_connected: isOpen,
      updated_at: new Date().toISOString(),
    };
    if (isOpen && instanceName) {
      updatePayload.evolution_instance_name = instanceName;
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update(updatePayload)
      .eq('id', restaurantId)
      .select('id')
      .single();

    if (error) {
      console.error('[webhooks/evolution] Supabase update error:', error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data) {
      return res.status(200).json({ ok: true, updated: false, reason: 'restaurant_not_found', restaurantId });
    }

    return res.status(200).json({
      ok: true,
      updated: true,
      restaurantId,
      whatsapp_connected: isOpen,
    });
  } catch (e) {
    console.error('[webhooks/evolution]', e);
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Erro interno',
    });
  }
}
