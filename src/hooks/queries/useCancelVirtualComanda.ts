/**
 * useCancelVirtualComanda — Remove/cancela comanda digital da fila do Cashier
 *
 * Marca virtual_comanda como status = 'cancelled'.
 * NÃO cria order, NÃO registra pagamento — não reflete em Concluídos nem em saldos.
 * Se a comanda tiver reserva (pending/confirmed), cancela a reserva também.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

export interface CancelVirtualComandaParams {
  comandaId: string;
  /** Se a comanda tem reserva pending/confirmed, cancela via RPC */
  reservationId?: string | null;
  reservationStatus?: string | null;
}

async function cancelVirtualComanda(params: CancelVirtualComandaParams): Promise<void> {
  const { comandaId, reservationId, reservationStatus } = params;

  // Se tem reserva pending/confirmed, cancela via RPC (que também atualiza a comanda)
  if (reservationId && reservationStatus && ['pending', 'confirmed'].includes(reservationStatus)) {
    const { error } = await supabase.rpc('cancel_reservation', { p_reservation_id: reservationId });
    if (error) throw error;
    return;
  }

  // Caso contrário: apenas cancela a comanda diretamente
  const { error } = await supabase
    .from('virtual_comandas')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', comandaId)
    .eq('status', 'open');

  if (error) throw error;
}

export function useCancelVirtualComanda(restaurantId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: cancelVirtualComanda,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}
