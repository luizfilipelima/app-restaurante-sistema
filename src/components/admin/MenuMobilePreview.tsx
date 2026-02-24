/**
 * Pré-visualização do cardápio no formato mobile, simulando um iPhone 17 Pro Max.
 * Permite ao admin ver em tempo real como o cliente visualiza o cardápio.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCardapioPublicUrl } from '@/lib/utils';
import {
  Smartphone,
  RefreshCw,
  ExternalLink,
  Eye,
  Loader2,
  ShoppingCart,
  EyeOff,
} from 'lucide-react';

// iPhone 17 Pro Max: viewport 440×956 CSS pixels
const VIEWPORT_WIDTH = 440;
const VIEWPORT_HEIGHT = 956;
const SCALE = 0.58; // Escala para caber confortavelmente no modal
const FRAME_RADIUS = 56; // Raio dos cantos da moldura (estilo iPhone)
const NOTCH_WIDTH = 126; // Dynamic Island

interface MenuMobilePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  /** true = cardápio interativo (com carrinho), false = somente visualização */
  interactiveDefault?: boolean;
  restaurantName?: string;
}

export default function MenuMobilePreview({
  open,
  onOpenChange,
  slug,
  interactiveDefault = true,
  restaurantName = 'Cardápio',
}: MenuMobilePreviewProps) {
  const [interactive, setInteractive] = useState(interactiveDefault);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const baseUrl = getCardapioPublicUrl(slug);
  const menuUrl = interactive ? baseUrl : `${baseUrl}/menu`;
  const iframeSrc = `${menuUrl}${menuUrl.includes('?') ? '&' : '?'}_preview=${refreshKey}`;

  useEffect(() => {
    if (open) setLoading(true);
  }, [open, interactive]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open(menuUrl, '_blank', 'noopener,noreferrer');
  }, [menuUrl]);

  const scaledWidth = VIEWPORT_WIDTH * SCALE;
  const scaledHeight = VIEWPORT_HEIGHT * SCALE;

  if (!slug?.trim()) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[520px] p-0 gap-0 overflow-hidden flex flex-col max-h-[95vh] border-0 shadow-2xl rounded-2xl"
        hideClose={false}
      >
        {/* Cabeçalho elegante */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold leading-tight flex items-center gap-2">
                  Pré-visualização Mobile
                  <span className="text-xs font-normal text-muted-foreground">iPhone 17 Pro Max</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {restaurantName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Interativo / Somente visualização */}
              <div className="flex rounded-lg border border-border/60 overflow-hidden bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setInteractive(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    interactive ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Cardápio com carrinho e pedidos"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Interativo
                </button>
                <button
                  type="button"
                  onClick={() => setInteractive(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    !interactive ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Apenas visualização, sem carrinho"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Somente visual
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="h-8 gap-1.5"
                title="Atualizar visualização (ver alterações recentes)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="h-8 gap-1.5"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Área do dispositivo */}
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center min-h-[420px] bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-slate-900 dark:to-slate-800/80">
          {/* Moldura iPhone 17 Pro Max */}
          <div
            className="relative flex-shrink-0 shadow-2xl"
            style={{
              width: scaledWidth + 24,
              height: scaledHeight + 24,
            }}
          >
            {/* Borda/bezel externo — preto com cantos arredondados */}
            <div
              className="absolute inset-0 rounded-[60px] bg-black"
              style={{
                borderRadius: `${FRAME_RADIUS + 8}px`,
                boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.08), 0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            />
            {/* Área da tela com cantos arredondados */}
            <div
              className="absolute overflow-hidden bg-black"
              style={{
                top: 12,
                left: 12,
                width: scaledWidth,
                height: scaledHeight,
                borderRadius: FRAME_RADIUS,
              }}
            >
              {/* Dynamic Island */}
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black rounded-full"
                style={{
                  width: NOTCH_WIDTH * SCALE,
                  height: 22,
                }}
              />
              {/* Conteúdo da tela — wrapper com dimensões escaladas */}
              <div
                className="absolute top-0 left-0 overflow-hidden"
                style={{
                  width: scaledWidth,
                  height: scaledHeight,
                  borderRadius: FRAME_RADIUS - 4,
                }}
              >
                {loading && (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800"
                    style={{ borderRadius: FRAME_RADIUS - 4 }}
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-2" />
                    <p className="text-xs text-slate-500">Carregando cardápio…</p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  title="Pré-visualização do cardápio"
                  onLoad={() => setLoading(false)}
                  style={{
                    width: VIEWPORT_WIDTH,
                    height: VIEWPORT_HEIGHT,
                    transform: `scale(${SCALE})`,
                    transformOrigin: '0 0',
                    border: 'none',
                  }}
                  className="absolute top-0 left-0"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com dicas */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            <span>Visualização em tempo real do cardápio do cliente</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
