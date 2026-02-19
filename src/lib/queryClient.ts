import { QueryClient } from '@tanstack/react-query';

const FIVE_MIN  = 5 * 60 * 1000;
const TEN_MIN   = 10 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados considerados "frescos" por 5 min — sem refetch silencioso nesse período.
      staleTime: FIVE_MIN,

      // Mantém dados em memória por 10 min após o último observer ser removido.
      gcTime: TEN_MIN,

      // ── Prevenção de refetches desnecessários ──────────────────────────────
      // false: não refaz ao focar a janela/aba (Supabase Realtime já mantém
      // os dados frescos via subscriptions; disparos duplicados causam lag
      // visível na navegação entre telas).
      refetchOnWindowFocus: false,

      // Refaz queries ao reconectar à internet (útil para offline-first do buffet).
      refetchOnReconnect: true,

      // ── Retry inteligente ──────────────────────────────────────────────────
      // Não retenta erros 4xx (400–499): são erros de cliente, repetir não adianta.
      // Retenta até 2x para erros de rede/5xx.
      retry: (failureCount, error: unknown) => {
        const status =
          (error as { status?: number })?.status ??
          (error as { code?: string })?.code;

        // Erros HTTP de cliente (autenticação, permissão, not found) — sem retry.
        if (typeof status === 'number' && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 2;
      },

      // Intervalo crescente entre tentativas: 1s → 2s.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 2000),
    },
  },
});
