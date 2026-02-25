import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * Chave usada no sessionStorage para evitar loops de reload infinitos.
 * sessionStorage é limpo ao fechar a aba, então não afeta sessões futuras.
 */
const RELOAD_KEY = 'app-chunk-reload';

/** Detecta se o erro é causado por falha ao carregar um chunk JavaScript/CSS. */
function isChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(error.message) ||
    /Importing a module script failed/i.test(error.message) ||
    /Loading chunk \d+ failed/i.test(error.message) ||
    /Loading CSS chunk \d+ failed/i.test(error.message) ||
    /error loading dynamically imported module/i.test(error.message)
  );
}

/**
 * Versão resiliente do React.lazy() com recuperação automática de ChunkLoadError.
 *
 * **Por que isso acontece?**
 * Vite (e Webpack) nomeiam os chunks com hash do conteúdo (ex: Orders-CGNcHXcM.js).
 * Após um novo deploy, os hashes mudam. Se um usuário com a aba aberta navegar
 * para uma nova rota, o browser tenta buscar o chunk com o hash antigo → 404 →
 * ChunkLoadError. A solução é recarregar a página uma única vez para obter o
 * novo HTML com os URLs corretos.
 *
 * **Proteção contra loop infinito:**
 * O flag no sessionStorage garante que o reload só acontece uma vez por sessão.
 * Se o erro persistir após o reload, ele é propagado para o ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const hasAlreadyRetried = sessionStorage.getItem(RELOAD_KEY) === '1';

    try {
      const module = await factory();
      // Carregou com sucesso — limpa qualquer flag residual.
      sessionStorage.removeItem(RELOAD_KEY);
      return module;
    } catch (error: unknown) {
      if (isChunkError(error) && !hasAlreadyRetried) {
        // Marca que já tentamos recarregar para evitar loop.
        sessionStorage.setItem(RELOAD_KEY, '1');
        // Recarrega a página para obter os novos chunks do deploy atual.
        window.location.reload();
        // A página está recarregando; esta Promise jamais será resolvida.
        // O Suspense mantém o fallback até o reload concluir.
        return new Promise<never>(() => {});
      }

      // Não é ChunkLoadError, ou já tentou recarregar uma vez → propaga
      // para o ErrorBoundary mais próximo tratar.
      sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }
  });
}
