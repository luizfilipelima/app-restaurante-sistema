import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Download, QrCode, ShoppingCart, Eye } from 'lucide-react';
import { getCardapioPublicUrl } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface MenuQRCodeCardProps {
  slug: string;
}

type QRCodeType = 'interactive' | 'view-only';

export default function MenuQRCodeCard({ slug }: MenuQRCodeCardProps) {
  const qrCodeRefInteractive = useRef<HTMLDivElement>(null);
  const qrCodeRefViewOnly = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<QRCodeType | null>(null);

  const cardapioUrl = getCardapioPublicUrl(slug);
  const cardapioViewOnlyUrl = cardapioUrl + '/menu';

  if (!slug) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground gap-3 py-8">
        <QrCode className="h-10 w-10 opacity-25" />
        <p className="text-xs text-center max-w-[180px]">
          Configure o slug do cardápio para gerar os QR Codes
        </p>
      </div>
    );
  }

  const handleDownloadQRCode = async (type: QRCodeType) => {
    const qrCodeRef = type === 'interactive' ? qrCodeRefInteractive : qrCodeRefViewOnly;
    if (!qrCodeRef.current) return;

    setDownloading(type);
    try {
      const svgElement = qrCodeRef.current.querySelector('svg');
      if (!svgElement) throw new Error('SVG não encontrado');

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar contexto do canvas');

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const padding = 40;
        const size = Math.max(img.width, img.height) + padding * 2;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, padding, padding, img.width, img.height);

        canvas.toBlob((blob) => {
          if (!blob) throw new Error('Erro ao gerar imagem');
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `qrcode-cardapio-${slug}-${type === 'interactive' ? 'interativo' : 'visualizacao'}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(svgUrl);
          toast({ title: 'QR Code baixado com sucesso!' });
          setDownloading(null);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        throw new Error('Erro ao carregar imagem SVG');
      };

      img.src = svgUrl;
    } catch (error) {
      toast({
        title: 'Erro ao baixar QR Code',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4 h-full">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          QR Codes
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ideal para imprimir nas mesas ou materiais de divulgação.
        </p>
      </div>

      {/* QR Code Interativo */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-3 w-3 text-orange-600" />
          </div>
          <span className="text-xs font-semibold text-foreground">Interativo</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Com pedidos</span>
        </div>

        <div className="flex justify-center">
          <div
            ref={qrCodeRefInteractive}
            className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm inline-block"
          >
            <QRCodeSVG
              value={cardapioUrl}
              size={148}
              level="H"
              includeMargin={false}
              fgColor="#111827"
              bgColor="#ffffff"
            />
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => handleDownloadQRCode('interactive')}
          disabled={downloading !== null}
        >
          {downloading === 'interactive' ? (
            <><Download className="h-3.5 w-3.5 animate-pulse" />Gerando...</>
          ) : (
            <><Download className="h-3.5 w-3.5" />Baixar PNG</>
          )}
        </Button>
      </div>

      {/* QR Code Somente Visualização */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Eye className="h-3 w-3 text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-foreground">Visualização</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Sem pedidos</span>
        </div>

        <div className="flex justify-center">
          <div
            ref={qrCodeRefViewOnly}
            className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm inline-block"
          >
            <QRCodeSVG
              value={cardapioViewOnlyUrl}
              size={148}
              level="H"
              includeMargin={false}
              fgColor="#111827"
              bgColor="#ffffff"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => handleDownloadQRCode('view-only')}
          disabled={downloading !== null}
        >
          {downloading === 'view-only' ? (
            <><Download className="h-3.5 w-3.5 animate-pulse" />Gerando...</>
          ) : (
            <><Download className="h-3.5 w-3.5" />Baixar PNG</>
          )}
        </Button>
      </div>
    </div>
  );
}
