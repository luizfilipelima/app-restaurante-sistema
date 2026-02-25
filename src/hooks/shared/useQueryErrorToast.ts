import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/shared/use-toast';

/** Objeto compatível com o retorno de useQuery (isError + error opcional). */
export interface QueryLikeResult {
  isError: boolean;
  error?: Error | null;
}

const DEFAULT_MESSAGE = 'Não foi possível carregar os dados. Tente novamente.';

/**
 * Exibe um toast de erro quando a query está em estado de erro.
 * Padroniza o feedback de falha nas telas do painel (relatório frontend).
 *
 * Uso:
 *   const ordersQuery = useOrders({ restaurantId, ... });
 *   useQueryErrorToast(ordersQuery, 'Não foi possível carregar os pedidos.');
 */
export function useQueryErrorToast(
  queryResult: QueryLikeResult,
  message: string = DEFAULT_MESSAGE,
) {
  const { toast } = useToast();
  const lastErrorRef = useRef<unknown>(null);

  useEffect(() => {
    if (!queryResult.isError || !queryResult.error) return;
    const err = queryResult.error;
    if (lastErrorRef.current === err) return;
    lastErrorRef.current = err;
    const description =
      err instanceof Error ? err.message : typeof err === 'string' ? err : undefined;
    toast({
      title: message,
      description: description && description !== message ? description : undefined,
      variant: 'destructive',
    });
  }, [queryResult.isError, queryResult.error, message, toast]);
}
