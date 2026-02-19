/**
 * Hook para gerenciar o conteúdo editável da landing page.
 * Leitura pública (sem auth) · Escrita exclusiva para super_admin.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LandingContentRow {
  id: string;
  section: string;
  key: string;
  value: string | null;
  content_type: 'text' | 'url' | 'json';
  updated_at: string;
}

/** Mapa aninhado section → key → value */
export type LandingContent = Record<string, Record<string, string>>;

/** Item para upsert em lote */
export interface LandingUpsertItem {
  section: string;
  key: string;
  value: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const landingContentKeys = {
  all:  () => ['landing-page-content']         as const,
  rows: () => ['landing-page-content', 'rows'] as const,
};

// ─── Funções de fetch ─────────────────────────────────────────────────────────

async function fetchLandingPageContent(): Promise<LandingContent> {
  const { data, error } = await supabase
    .from('landing_page_content')
    .select('section, key, value')
    .order('section')
    .order('key');

  if (error) throw error;

  const result: LandingContent = {};
  for (const row of data ?? []) {
    if (!result[row.section]) result[row.section] = {};
    result[row.section][row.key] = row.value ?? '';
  }
  return result;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useLandingPageContent() {
  return useQuery({
    queryKey: landingContentKeys.all(),
    queryFn:  fetchLandingPageContent,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Salva/atualiza múltiplos itens de uma (ou mais) seção de uma só vez. */
export function useUpsertLandingSection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (items: LandingUpsertItem[]) => {
      const { error } = await supabase
        .from('landing_page_content')
        .upsert(items, { onConflict: 'section,key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: landingContentKeys.all() });
    },
  });
}
