import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Download, QrCode, ShoppingCart, Eye } from 'lucide-react';
import { getCardapioPublicUrl } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface MenuQRCodeCardProps {
  slug: string;
}

type QRCodeType = 'interactive' | 'view-only';

export default function MenuQRCodeCard({ slug }: MenuQRCodeCardProps) {
  const [qrCodeType, setQrCodeType] = useState<QRCodeType>('interactive');
  const qrCodeRefInteractive = useRef<HTMLDivElement>(null);
  const qrCodeRefViewOnly = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cardapioUrl = getCardapioPublicUrl(slug);
  const cardapioViewOnlyUrl = cardapioUrl + '/menu';

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

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast({ title: 'Erro ao copiar link', variant: 'destructive' });
    });
  };

  const handleDownloadQRCode = async (type: QRCodeType) => {
    const qrCodeRef = type === 'interactive' ? qrCodeRefInteractive : qrCodeRefViewOnly;
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
          link.download = `qrcode-cardapio-${slug}-${type === 'interactive' ? 'interativo' : 'visualizacao'}.png`;
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
        <Tabs value={qrCodeType} onValueChange={(v) => setQrCodeType(v as QRCodeType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="interactive" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Interativo
            </TabsTrigger>
            <TabsTrigger value="view-only" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visualização
            </TabsTrigger>
          </TabsList>

          {/* QR Code Interativo */}
          <TabsContent value="interactive" className="space-y-6 mt-6">
            <div className="flex flex-col items-center">
              <div
                ref={qrCodeRefInteractive}
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
                Cardápio com opção de pedidos e checkout
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link do cardápio interativo:</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  readOnly
                  value={cardapioUrl}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopyLink(cardapioUrl)}
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

            <div className="pt-2 border-t">
              <Button
                type="button"
                onClick={() => handleDownloadQRCode('interactive')}
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
            </div>
          </TabsContent>

          {/* QR Code Somente Visualização */}
          <TabsContent value="view-only" className="space-y-6 mt-6">
            <div className="flex flex-col items-center">
              <div
                ref={qrCodeRefViewOnly}
                className="p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm"
                style={{ display: 'inline-block' }}
              >
                <QRCodeSVG
                  value={cardapioViewOnlyUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center max-w-xs">
                Cardápio sem opção de pedidos, ideal para substituir cardápio físico
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link do cardápio (somente visualização):</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  readOnly
                  value={cardapioViewOnlyUrl}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopyLink(cardapioViewOnlyUrl)}
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

            <div className="pt-2 border-t">
              <Button
                type="button"
                onClick={() => handleDownloadQRCode('view-only')}
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
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
