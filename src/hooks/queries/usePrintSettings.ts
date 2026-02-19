import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PrintPaperWidth } from '@/types';

export interface PrintSettings {
  name: string;
  print_auto_on_new_order: boolean;
  print_paper_width: PrintPaperWidth;
}

/** Busca configurações de impressão do restaurante. */
async function fetchPrintSettings(restaurantId: string | null): Promise<PrintSettings | null> {
  if (!restaurantId) return null;
  const { data, error } = await supabase
    .from('restaurants')
    .select('name, print_auto_on_new_order, print_paper_width')
    .eq('id', restaurantId)
    .single();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name || '',
    print_auto_on_new_order: !!data.print_auto_on_new_order,
    print_paper_width: (data.print_paper_width === '58mm' ? '58mm' : '80mm') as PrintPaperWidth,
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
