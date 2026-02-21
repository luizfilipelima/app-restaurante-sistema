/**
 * Hook para configuração de câmbio no Super Admin.
 * Usado para converter GMV e ticket médio para BRL nos KPIs agregados.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ExchangeRates } from '@/lib/priceHelper';

const DEFAULT_RATES: ExchangeRates = { pyg_per_brl: 3600, ars_per_brl: 1150 };

export const superAdminExchangeRatesKey = () => ['super-admin-exchange-rates'] as const;

async function fetchExchangeRates(): Promise<ExchangeRates> {
  const { data, error } = await supabase
    .from('super_admin_settings')
    .select('value')
    .eq('key', 'exchange_rates')
    .single();

  if (error || !data?.value) return DEFAULT_RATES;
  const v = data.value as { pyg_per_brl?: number; ars_per_brl?: number };
  return {
    pyg_per_brl: typeof v.pyg_per_brl === 'number' ? v.pyg_per_brl : DEFAULT_RATES.pyg_per_brl,
    ars_per_brl: typeof v.ars_per_brl === 'number' ? v.ars_per_brl : DEFAULT_RATES.ars_per_brl,
  };
}

export function useSuperAdminExchangeRates() {
  return useQuery({
    queryKey: superAdminExchangeRatesKey(),
    queryFn: fetchExchangeRates,
    staleTime: 60 * 1000,
  });
}

export async function updateExchangeRates(rates: ExchangeRates): Promise<ExchangeRates> {
  const { data, error } = await supabase
    .from('super_admin_settings')
    .upsert(
      { key: 'exchange_rates', value: rates, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    .select('value')
    .single();

  if (error) throw error;
  const v = (data?.value ?? rates) as ExchangeRates;
  return { pyg_per_brl: v.pyg_per_brl ?? DEFAULT_RATES.pyg_per_brl, ars_per_brl: v.ars_per_brl ?? DEFAULT_RATES.ars_per_brl };
}

export function useUpdateSuperAdminExchangeRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateExchangeRates,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: superAdminExchangeRatesKey() });
      qc.invalidateQueries({ queryKey: ['super-admin-restaurants'] });
    },
  });
}
