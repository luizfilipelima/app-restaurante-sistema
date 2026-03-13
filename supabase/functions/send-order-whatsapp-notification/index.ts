// Edge Function: enviar notificação WhatsApp ao cliente quando status do pedido muda
// (preparando ou entregando) via Evolution API.
//
// Deploy: npx supabase functions deploy send-order-whatsapp-notification
// Secrets: EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY (além dos padrões Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_TEMPLATES = {
  delivery_notification: `Olá {{cliente_nome}}! 🛵 Seu pedido acabou de sair para entrega. Em breve estará na sua porta! 😊`,
  preparing_notification: `Olá {{cliente_nome}}! ✅ Seu pedido foi confirmado e já está em preparo no {{restaurante_nome}}. Em breve você receberá a confirmação de envio para entrega! 😊`,
  courier_dispatch: `🛵 *Novo pedido para entrega*\n\n*Pedido:* #{{codigo_pedido}}\n*Cliente:* {{cliente_nome}}\n*WhatsApp:* {{cliente_telefone}}\n\n*Endereço:* {{detalhes_endereco}}\n🗺️ {{mapa}}\n\n*Itens:*\n{{itens}}\n\n*Subtotal:* {{subtotal}}\n*Taxa de entrega:* {{taxa_entrega}}\n*Total:* {{total}}`,
};

const DEFAULT_TEMPLATES_ES = {
  delivery_notification: `¡Hola {{cliente_nome}}! 🛵 Tu pedido acaba de salir para entrega. ¡En breve estará en tu puerta! 😊`,
  preparing_notification: `¡Hola {{cliente_nome}}! ✅ Tu pedido fue confirmado y ya está en preparación en {{restaurante_nome}}. ¡En breve recibirás la confirmación de envío para entrega! 😊`,
  courier_dispatch: `🛵 *Nuevo pedido para entrega*\n\n*Pedido:* #{{codigo_pedido}}\n*Cliente:* {{cliente_nome}}\n*WhatsApp:* {{cliente_telefone}}\n\n*Dirección:* {{detalhes_endereco}}\n🗺️ {{mapa}}\n\n*Ítems:*\n{{itens}}\n\n*Subtotal:* {{subtotal}}\n*Costo de envío:* {{taxa_entrega}}\n*Total:* {{total}}`,
};

function processTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    const tag = `{{${key}}}`;
    result = result.split(tag).join(val || '');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

function getTemplate(
  key: 'delivery_notification' | 'preparing_notification' | 'courier_dispatch',
  custom?: { delivery_notification?: string; preparing_notification?: string; courier_dispatch?: string } | null,
  lang: 'pt' | 'es' = 'pt'
): string {
  if (custom?.[key]) return custom[key]!;
  const defs = lang === 'es' ? DEFAULT_TEMPLATES_ES : DEFAULT_TEMPLATES;
  return defs[key];
}

function normalizePhone(phone: string, country: 'BR' | 'PY' | 'AR'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('595') && digits.length >= 12) return digits;
  if (digits.startsWith('54') && digits.length >= 10) return digits;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (country === 'BR') {
    const br = digits.length <= 11 ? digits : digits.slice(-11);
    return '55' + (br.length === 11 ? br : br.padStart(11, '0'));
  }
  if (country === 'PY') {
    const py = digits.length <= 9 ? digits : digits.slice(-9);
    return '595' + py.padStart(9, '0');
  }
  if (country === 'AR') {
    const ar = digits.length <= 12 ? digits : digits.slice(-12);
    return '54' + ar;
  }
  return digits;
}

function inferCountry(phone: string, fallback: 'BR' | 'PY' | 'AR'): 'BR' | 'PY' | 'AR' {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('595')) return 'PY';
  if (d.startsWith('54')) return 'AR';
  if (d.startsWith('55')) return 'BR';
  return fallback;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionBase = Deno.env.get('EVOLUTION_API_BASE_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionBase || !evolutionKey) {
      console.error('[send-order-whatsapp] EVOLUTION_API_BASE_URL ou EVOLUTION_API_KEY não configurados');
      return fail('Evolution API não configurada', 500);
    }

    let body: { orderId: string; newStatus: string };
    try {
      body = await req.json();
    } catch {
      return fail('Body JSON inválido');
    }

    const { orderId, newStatus } = body;
    if (!orderId || !newStatus) return fail('orderId e newStatus obrigatórios');

    if (newStatus !== 'preparing' && newStatus !== 'delivering' && newStatus !== 'courier_dispatch') {
      return ok({ skipped: true, reason: 'status_not_trigger' });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(`
        id, customer_name, customer_phone, customer_language,
        restaurant_id
      `)
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return fail('Pedido não encontrado', 404);

    const restaurantId = order.restaurant_id as string;
    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .select('id, name, whatsapp_evolution_enabled, evolution_instance_name, whatsapp_templates, language, phone_country')
      .eq('id', restaurantId)
      .single();

    if (restErr || !restaurant) return fail('Restaurante não encontrado', 404);

    const enabled = restaurant.whatsapp_evolution_enabled === true;
    const instance = (restaurant.evolution_instance_name as string)?.trim();
    const baseUrl = evolutionBase.replace(/\/$/, '');
    const customTemplates = restaurant.whatsapp_templates as Record<string, string> | null;

    // ── Despacho para entregador ──────────────────────────────────────────────
    if (newStatus === 'courier_dispatch') {
      if (!enabled || !instance) {
        return ok({ skipped: true, reason: !enabled ? 'disabled' : 'no_instance' });
      }

      const { data: fullOrder } = await admin
        .from('orders')
        .select('id, customer_name, customer_phone, customer_language, courier_id, address_details, latitude, longitude, subtotal, delivery_fee, total, order_items(quantity, product_name)')
        .eq('id', orderId)
        .single();

      if (!fullOrder?.courier_id) return ok({ skipped: true, reason: 'no_courier' });

      const { data: courier } = await admin
        .from('couriers')
        .select('id, name, phone, phone_country')
        .eq('id', fullOrder.courier_id as string)
        .single();

      if (!courier?.phone) return ok({ skipped: true, reason: 'courier_no_phone' });

      const orderLang = (fullOrder.customer_language === 'es' || restaurant.language === 'es') ? 'es' : 'pt';
      const itemsText = ((fullOrder.order_items as Array<{ quantity: number; product_name: string }>) ?? [])
        .map((i) => `  • ${i.quantity}x ${i.product_name}`)
        .join('\n');
      const mapsUrl = fullOrder.latitude && fullOrder.longitude
        ? `https://www.google.com/maps?q=${fullOrder.latitude},${fullOrder.longitude}`
        : '';
      const clienteTelefone = (fullOrder.customer_phone as string) || '';

      const template = getTemplate('courier_dispatch', customTemplates ?? undefined, orderLang as 'pt' | 'es');
      const text = processTemplate(template, {
        codigo_pedido:     `${(fullOrder.id as string).slice(0, 8).toUpperCase()}`,
        cliente_nome:      (fullOrder.customer_name as string) || '',
        cliente_telefone:  clienteTelefone,
        detalhes_endereco: (fullOrder.address_details as string) || '',
        endereco:          fullOrder.latitude ? `${fullOrder.latitude},${fullOrder.longitude}` : '',
        mapa:              mapsUrl,
        restaurante_nome:  (restaurant.name as string) || '',
        itens:             itemsText,
        subtotal:          String(fullOrder.subtotal ?? ''),
        taxa_entrega:      fullOrder.delivery_fee ? String(fullOrder.delivery_fee) : '',
        total:             String(fullOrder.total ?? ''),
      });

      const courierCountry = (courier.phone_country === 'PY' ? 'PY' : courier.phone_country === 'AR' ? 'AR' : 'BR') as 'BR' | 'PY' | 'AR';
      const courierNumber = normalizePhone(courier.phone as string, courierCountry);

      const courierRes = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
        body: JSON.stringify({ number: courierNumber, text }),
      });
      const courierData = await courierRes.json().catch(() => ({}));
      if (!courierRes.ok) {
        console.error('[send-order-whatsapp] courier dispatch erro:', courierRes.status, courierData);
        return fail(`Falha ao notificar entregador: ${(courierData as { message?: string })?.message || courierRes.statusText}`, 502);
      }
      return ok({ sent: true, templateKey: 'courier_dispatch' });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const phone = (order.customer_phone as string)?.trim();

    if (!enabled || !instance || !phone) {
      return ok({ skipped: true, reason: enabled ? (!instance ? 'no_instance' : 'no_phone') : 'disabled' });
    }

    const firstName = ((order.customer_name as string) || 'Cliente').split(' ')[0] || 'Cliente';
    const restaurantName = (restaurant.name as string) || '';
    const orderLang = (order.customer_language === 'es' || restaurant.language === 'es') ? 'es' : 'pt';
    const country = inferCountry(
      phone,
      (restaurant.phone_country === 'PY' ? 'PY' : restaurant.phone_country === 'AR' ? 'AR' : 'BR')
    );
    const number = normalizePhone(phone, country);

    const templateKey = newStatus === 'preparing' ? 'preparing_notification' : 'delivery_notification';
    const template = getTemplate(templateKey, customTemplates ?? undefined, orderLang);
    const text = processTemplate(template, {
      cliente_nome: firstName,
      restaurante_nome: restaurantName,
    });

    const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
    const evolutionRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify({ number, text }),
    });

    const evolutionData = await evolutionRes.json().catch(() => ({}));

    if (!evolutionRes.ok) {
      console.error('[send-order-whatsapp] Evolution API erro:', evolutionRes.status, evolutionData);
      return fail(`Falha ao enviar WhatsApp: ${(evolutionData as { message?: string })?.message || evolutionRes.statusText}`, 502);
    }

    return ok({ sent: true, templateKey });
  } catch (e) {
    console.error('[send-order-whatsapp]', e);
    return fail(e instanceof Error ? e.message : 'Erro interno', 500);
  }
});
