/**
 * useTableComandaLinks — Vínculos mesa ↔ comanda física (buffet)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import type { TableComandaLink } from '@/types';

export interface TableComandaLinkWithComanda extends TableComandaLink {
  comandas: { id: string; number: number; status: string } | null;
}

async function fetchTableComandaLinks(tableId: string | null, restaurantId: string | null): Promise<TableComandaLinkWithComanda[]> {
  if (!tableId || !restaurantId) return [];
  const { data, error } = await supabase
    .from('table_comanda_links')
    .select(`
      id, table_id, comanda_id, restaurant_id, created_at,
      comandas(id, number, status)
    `)
    .eq('table_id', tableId)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    ...r,
    comandas: Array.isArray(r.comandas) ? r.comandas[0] : r.comandas,
  })) as TableComandaLinkWithComanda[];
}

export function useTableComandaLinks(tableId: string | null, restaurantId: string | null) {
  return useQuery({
    queryKey: ['tableComandaLinks', tableId, restaurantId],
    queryFn: () => fetchTableComandaLinks(tableId, restaurantId),
    enabled: !!tableId && !!restaurantId,
    staleTime: 5 * 1000,
  });
}

export function useLinkComandaToTable(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, comandaId }: { tableId: string; comandaId: string }) => {
      const { data, error } = await supabase
        .from('table_comanda_links')
        .insert({ table_id: tableId, comanda_id: comandaId, restaurant_id: restaurantId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tableComandaLinks', vars.tableId, restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}

export function useUnlinkComandaFromTable(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ linkId }: { tableId: string; linkId: string }) => {
      const { error } = await supabase.from('table_comanda_links').delete().eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tableComandaLinks', vars.tableId, restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}
