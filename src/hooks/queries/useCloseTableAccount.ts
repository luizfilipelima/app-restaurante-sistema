/**
 * useCloseTableAccount — Fecha a conta da mesa (pedidos pagos, reserva concluída, comandas buffet fechadas)
 *
 * Usado em /tables e Terminal do Garçom. Remove a mesa da fila do /cashier.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

export type CloseTablePaymentMethod = 'cash' | 'card' | 'pix';

export interface CloseTableAccountParams {
  tableId: string;
  paymentMethod: CloseTablePaymentMethod;
  /** IDs das comandas físicas (buffet) vinculadas à mesa para fechar */
  comandaIds?: string[];
}

async function closeTableAccount(params: CloseTableAccountParams): Promise<void> {
  const { tableId, paymentMethod, comandaIds = [] } = params;

  // 1. Marcar pedidos da mesa como pagos
  const { error: ordersError } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      is_paid: true,
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('table_id', tableId);

  if (ordersError) throw ordersError;

  // 2. Marcar reserva ativada como concluída (se houver)
  const { error: resError } = await supabase.rpc('complete_reservation_for_table', { p_table_id: tableId });
  if (resError) throw resError;

  // 3. Fechar comandas físicas (buffet) vinculadas
  if (comandaIds.length > 0) {
    const { error: comandasError } = await supabase
      .from('comandas')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .in('id', comandaIds)
      .eq('status', 'open');

    if (comandasError) throw comandasError;
  }
}

export function useCloseTableAccount(restaurantId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: closeTableAccount,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableOrders'] });
      qc.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableComandaLinks', vars.tableId, restaurantId] });
    },
  });
}
