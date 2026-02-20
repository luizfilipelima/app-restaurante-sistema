import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PrintPaperWidth, PrintSettingsBySector } from '@/types';

export interface PrintSettings {
  name: string;
  print_auto_on_new_order: boolean;
  print_paper_width: PrintPaperWidth;
  print_settings_by_sector: PrintSettingsBySector;
}

function parseSectorSettings(raw: unknown): PrintSettingsBySector {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const sectors = ['delivery', 'table', 'pickup', 'buffet'] as const;
  const out: PrintSettingsBySector = {};
  for (const k of sectors) {
    const v = obj[k];
    if (v && typeof v === 'object' && 'waiter_tip_enabled' in v && 'waiter_tip_pct' in v) {
      const s = v as { waiter_tip_enabled: boolean; waiter_tip_pct: number };
      out[k] = {
        waiter_tip_enabled: !!s.waiter_tip_enabled,
        waiter_tip_pct: Math.max(0, Math.min(100, Number(s.waiter_tip_pct) || 0)),
      };
    }
  }
  return out;
}

/** Busca configurações de impressão do restaurante. */
async function fetchPrintSettings(restaurantId: string | null): Promise<PrintSettings | null> {
  if (!restaurantId) return null;
  const { data, error } = await supabase
    .from('restaurants')
    .select('name, print_auto_on_new_order, print_paper_width, print_settings_by_sector')
    .eq('id', restaurantId)
    .single();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name || '',
    print_auto_on_new_order: !!data.print_auto_on_new_order,
    print_paper_width: (data.print_paper_width === '58mm' ? '58mm' : '80mm') as PrintPaperWidth,
    print_settings_by_sector: parseSectorSettings(data.print_settings_by_sector),
  };
}

/** Hook para config de impressão. Usado em AdminOrders. */
export function usePrintSettings(restaurantId: string | null) {
  return useQuery({
    queryKey: ['printSettings', restaurantId],
    queryFn: () => fetchPrintSettings(restaurantId),
    enabled: !!restaurantId,
  });
}
