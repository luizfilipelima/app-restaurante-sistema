/**
 * Dispara notificação WhatsApp ao cliente quando o status do pedido muda
 * para "preparando" ou "entregando" (se o restaurante tiver Evolution API habilitada).
 * Chamado após o update de status no banco.
 */
import { supabase } from '@/lib/core/supabase';

export async function notifyOrderStatusWhatsApp(
  orderId: string,
  newStatus: 'preparing' | 'delivering' | 'courier_dispatch'
): Promise<void> {
  try {
    await supabase.functions.invoke('send-order-whatsapp-notification', {
      body: { orderId, newStatus },
    });
    // Falha silenciosa: não bloqueia o fluxo do Kanban
  } catch {
    // ignora
  }
}
