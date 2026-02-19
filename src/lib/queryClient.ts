import { QueryClient } from '@tanstack/react-query';

/** Cache global: staleTime de 5 minutos. Ao trocar de aba, não faz refetch se os dados ainda forem válidos. */
const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: 10 * 60 * 1000, // 10 min (antigo cacheTime)
      refetchOnWindowFocus: true, // Só refaz se dados estiverem stale
      retry: 1,
    },
  },
});
