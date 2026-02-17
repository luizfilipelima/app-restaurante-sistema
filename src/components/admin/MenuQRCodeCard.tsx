import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Download, QrCode } from 'lucide-react';
import { getCardapioPublicUrl } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface MenuQRCodeCardProps {
  slug: string;
}

export default function MenuQRCodeCard({ slug }: MenuQRCodeCardProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cardapioUrl = getCardapioPublicUrl(slug);

  if (!slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code do Cardápio
          </CardTitle>
          <CardDescription>
            Configure o slug do cardápio para gerar o QR Code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Configure o slug do cardápio acima para gerar o QR Code</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(cardapioUrl).then(() => {
      setLinkCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast({ title: 'Erro ao copiar link', variant: 'destructive' });
    });
  };

  const handleDownloadQRCode = async () => {
    if (!qrCodeRef.current) return;

    setDownloading(true);
    try {
      // Encontra o elemento SVG dentro do ref
      const svgElement = qrCodeRef.current.querySelector('svg');
      if (!svgElement) {
        throw new Error('SVG não encontrado');
      }

      // Cria um canvas para converter SVG em PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Não foi possível criar contexto do canvas');
      }

      // Obtém as dimensões do SVG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Cria uma imagem a partir do SVG
      const img = new Image();
      img.onload = () => {
        // Define o tamanho do canvas (com padding para melhor legibilidade)
        const padding = 40;
        const size = Math.max(img.width, img.height) + padding * 2;
        canvas.width = size;
        canvas.height = size;

        // Preenche o fundo branco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Desenha a imagem no centro com padding
        ctx.drawImage(img, padding, padding, img.width, img.height);

        // Converte para blob e faz download
        canvas.toBlob((blob) => {
          if (!blob) {
            throw new Error('Erro ao gerar imagem');
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `qrcode-cardapio-${slug}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(svgUrl);

          toast({ title: 'QR Code baixado com sucesso!' });
          setDownloading(false);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        throw new Error('Erro ao carregar imagem SVG');
      };

      img.src = svgUrl;
    } catch (error) {
      console.error('Erro ao baixar QR Code:', error);
      toast({
        title: 'Erro ao baixar QR Code',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code do Cardápio
        </CardTitle>
        <CardDescription>
          Escaneie o QR Code para acessar o cardápio digital. Ideal para imprimir nas mesas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex flex-col items-center">
          <div
            ref={qrCodeRef}
            className="p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm"
            style={{ display: 'inline-block' }}
          >
            <QRCodeSVG
              value={cardapioUrl}
              size={256}
              level="H"
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center max-w-xs">
            Escaneie com a câmera do celular para acessar o cardápio
          </p>
        </div>

        {/* Link do Cardápio */}
        <div className="space-y-2">
          <Label>Link do cardápio:</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              readOnly
              value={cardapioUrl}
              className="flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyLink}
              className="w-full sm:w-auto"
            >
              {linkCopied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Botão de Download */}
        <div className="pt-2 border-t">
          <Button
            type="button"
            onClick={handleDownloadQRCode}
            disabled={downloading}
            className="w-full"
            variant="default"
          >
            {downloading ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-pulse" />
                Gerando imagem...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar QR Code (PNG)
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Baixe a imagem para imprimir nas mesas ou compartilhar
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
