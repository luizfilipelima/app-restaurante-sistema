/**
 * useUpdateTableCustomerName — Persiste o nome do cliente na mesa no servidor.
 *
 * Quando o cliente salva seu nome no cardápio (modal de boas-vindas ou checkout),
 * o nome é gravado na coluna current_customer_name da mesa para aparecer imediatamente
 * na tela do garçom e no painel de mesas (via Realtime).
 *
 * Chamável por anon (cliente no cardápio público).
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

async function updateTableCustomerName(params: {
  tableId: string;
  customerName: string | null;
}): Promise<void> {
  const { tableId, customerName } = params;
  const { error } = await supabase.rpc('update_table_customer_name', {
    p_table_id: tableId,
    p_customer_name: customerName ?? '',
  });
  if (error) throw error;
}

export function useUpdateTableCustomerName() {
  return useMutation({
    mutationFn: updateTableCustomerName,
  });
}

/** Função direta para chamar fora de componentes React (ex: debounced no Checkout) */
export async function updateTableCustomerNameFn(params: {
  tableId: string;
  customerName: string | null;
}): Promise<void> {
  return updateTableCustomerName(params);
}
