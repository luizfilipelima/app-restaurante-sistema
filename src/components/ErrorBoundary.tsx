import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface State {
  hasError: boolean;
  isChunkError: boolean;
  message: string;
}

function isChunkError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(error.message) ||
    /Importing a module script failed/i.test(error.message) ||
    /Loading chunk \d+ failed/i.test(error.message)
  );
}

/**
 * Error Boundary de nível de aplicação.
 *
 * - ChunkLoadError → orienta o usuário a recarregar (novo deploy detectado).
 * - Outros erros  → exibe mensagem genérica com opção de tentar novamente.
 *
 * Deve envolver o conteúdo dentro de cada <BrowserRouter> para capturar erros
 * de renderização de rotas lazy e componentes filhos.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      isChunkError: isChunkError(error),
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log para monitoramento (ex: Sentry) sem poluir o console em produção.
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error.message, info.componentStack);
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('app-chunk-reload');
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, isChunkError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-slate-50 px-4">
        <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center shadow-sm">
          <AlertTriangle className="h-7 w-7 text-[#F87116]" />
        </div>

        <div className="text-center space-y-1.5 max-w-sm">
          {this.state.isChunkError ? (
            <>
              <p className="text-base font-semibold text-slate-800">
                Nova versão disponível
              </p>
              <p className="text-sm text-slate-500">
                Uma atualização foi detectada. Recarregue a página para continuar usando o sistema.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-800">
                Algo deu errado
              </p>
              <p className="text-sm text-slate-500">
                Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
              </p>
              {import.meta.env.DEV && (
                <p className="text-xs text-slate-400 font-mono mt-2 bg-slate-100 rounded px-3 py-2 text-left break-all">
                  {this.state.message}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3">
          {!this.state.isChunkError && (
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Tentar novamente
            </button>
          )}
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F87116] text-white text-sm font-semibold hover:brightness-105 transition-all shadow-sm shadow-orange-200"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
