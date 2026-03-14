import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeLib from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, QrCode, ShoppingCart, Eye, Copy, Printer, Receipt, Loader2, Check, Link2 } from 'lucide-react';
import { getCardapioPublicUrl, getComandaPublicUrl, getBioPublicUrl } from '@/lib/core/utils';
import { toast } from '@/hooks/shared/use-toast';

interface MenuQRCodeCardProps {
  slug: string;
  /** Nome do restaurante (para o QR Comanda: impressão e título) */
  restaurantName?: string | null;
  /** Logo do restaurante (para o QR Comanda: impressão) */
  logo?: string | null;
}

type QRCodeType = 'interactive' | 'view-only' | 'bio' | 'comanda';

const COMANDA_PRINT_TITLE = 'Escaneie para abrir sua comanda';
const COMANDA_PRINT_HINT = 'Aponte a câmera do celular. Nenhum aplicativo necessário.';

export default function MenuQRCodeCard({ slug, restaurantName, logo }: MenuQRCodeCardProps) {
  const qrCodeRefInteractive = useRef<HTMLDivElement>(null);
  const qrCodeRefViewOnly = useRef<HTMLDivElement>(null);
  const qrCodeRefBio = useRef<HTMLDivElement>(null);
  const qrCodeRefComanda = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<QRCodeType | null>(null);
  const [printingComanda, setPrintingComanda] = useState(false);
  const [comandaCopied, setComandaCopied] = useState(false);

  const cardapioUrl = getCardapioPublicUrl(slug);
  const cardapioViewOnlyUrl = cardapioUrl + '/menu';
  const bioUrl = slug ? getBioPublicUrl(slug) : '';
  const comandaUrl = slug ? getComandaPublicUrl(slug) : '';

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
    if (type === 'comanda' && comandaUrl) {
      setDownloading('comanda');
      try {
        const png = await QRCodeLib.toDataURL(comandaUrl, {
          type: 'image/png',
          margin: 2,
          width: 512,
          color: { dark: '#0f172a', light: '#00000000' },
          errorCorrectionLevel: 'H',
        });
        const a = document.createElement('a');
        a.href = png;
        a.download = `qrcode-comanda-${(slug || 'cardapio').replace(/\s+/g, '-').toLowerCase()}.png`;
        a.click();
        toast({ title: 'QR Code baixado com sucesso!' });
      } catch (e) {
        console.error(e);
        toast({ title: 'Erro ao baixar QR Code', variant: 'destructive' });
      } finally {
        setDownloading(null);
      }
      return;
    }

    const qrCodeRef = type === 'interactive' ? qrCodeRefInteractive : type === 'view-only' ? qrCodeRefViewOnly : qrCodeRefBio;
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
          const label = type === 'interactive' ? 'interativo' : type === 'view-only' ? 'visualizacao' : 'link-bio';
          link.download = `qrcode-cardapio-${slug}-${label}.png`;
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

  const handlePrintComanda = async () => {
    if (!comandaUrl) return;
    setPrintingComanda(true);
    try {
      const qrPng = await QRCodeLib.toDataURL(comandaUrl, {
        type: 'image/png',
        margin: 2,
        width: 280,
        color: { dark: '#0f172a', light: '#00000000' },
        errorCorrectionLevel: 'H',
      });
      const logoHtml = logo
        ? `<img src="${logo}" alt="" style="height:64px;width:64px;border-radius:16px;object-fit:cover;border:1px solid #e2e8f0;margin-bottom:12px" />`
        : '';
      const name = restaurantName || 'Comanda';
      const win = window.open('', '_blank');
      if (!win) {
        toast({ title: 'Permita pop-ups para imprimir.', variant: 'destructive' });
        return;
      }
      win.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR Comanda</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
        .card{text-align:center;max-width:320px}.logo{margin-bottom:8px}.title{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
        .name{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:20px}.qr{padding:12px;border:2px solid #f1f5f9;border-radius:16px;display:inline-block;margin-bottom:14px}
        .url{font-size:10px;color:#94a3b8;word-break:break-all;font-family:monospace;margin-bottom:14px}.hint{font-size:11px;color:#64748b;background:#f8fafc;padding:12px;border-radius:12px;line-height:1.5}
        </style></head><body><div class="card">${logoHtml}<p class="title">${COMANDA_PRINT_TITLE}</p>
        <p class="name">${name}</p><div class="qr"><img src="${qrPng}" width="280" height="280"/></div>
        <p class="url">${comandaUrl}</p><p class="hint">${COMANDA_PRINT_HINT}</p></div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script></body></html>`
      );
      win.document.close();
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao imprimir', variant: 'destructive' });
    } finally {
      setPrintingComanda(false);
    }
  };

  const handleCopyComanda = () => {
    if (!comandaUrl) return;
    navigator.clipboard.writeText(comandaUrl).then(() => {
      setComandaCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setComandaCopied(false), 2000);
    });
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

      {/* QR Code Link Bio */}
      {bioUrl && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-100 dark:bg-cyan-950/40 flex items-center justify-center shrink-0">
              <Link2 className="h-3 w-3 text-cyan-600" />
            </div>
            <span className="text-xs font-semibold text-foreground">Link Bio</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Links e Bio</span>
          </div>

          <div className="flex justify-center">
            <div
              ref={qrCodeRefBio}
              className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm inline-block"
            >
              <QRCodeSVG
                value={bioUrl}
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
            onClick={() => handleDownloadQRCode('bio')}
            disabled={downloading !== null}
          >
            {downloading === 'bio' ? (
              <><Download className="h-3.5 w-3.5 animate-pulse" />Gerando...</>
            ) : (
              <><Download className="h-3.5 w-3.5" />Baixar PNG</>
            )}
          </Button>
        </div>
      )}

      {/* QR Code Comanda (mesa / PDV) */}
      {comandaUrl && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
              <Receipt className="h-3 w-3 text-violet-600" />
            </div>
            <span className="text-xs font-semibold text-foreground">Comanda</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Mesa / Caixa</span>
          </div>

          <div className="flex justify-center">
            <div
              ref={qrCodeRefComanda}
              className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm inline-block"
            >
              <QRCodeSVG
                value={comandaUrl}
                size={148}
                level="H"
                includeMargin={false}
                fgColor="#111827"
                bgColor="#ffffff"
              />
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              className="flex-1 min-w-0 h-8 text-xs gap-1.5"
              onClick={() => handleDownloadQRCode('comanda')}
              disabled={downloading !== null}
            >
              {downloading === 'comanda' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando...</>
              ) : (
                <><Download className="h-3.5 w-3.5" />Baixar</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 shrink-0"
              onClick={handlePrintComanda}
              disabled={printingComanda}
              title="Imprimir"
            >
              {printingComanda ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 shrink-0"
              onClick={handleCopyComanda}
              title="Copiar link"
            >
              {comandaCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
