/**
 * ComandaQRCode — Admin page
 * Gera o QR Code que o restaurante exibe na entrada / em cada mesa.
 * O cliente escaneia → abre /:slug/comanda → comanda criada automaticamente.
 * Protegida por FeatureGuard (plano Enterprise — feature_virtual_comanda).
 */

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { Button } from '@/components/ui/button';
import { Download, Printer, QrCode, ExternalLink, Info } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** URL pública da comanda para um dado slug */
const getComandaUrl = (slug: string) =>
  `https://app.quiero.food/${slug}/comanda`;

// ─── Sub-componente: Card QR ─────────────────────────────────────────────────

interface QRCardProps {
  url: string;
  restaurantName: string;
  logo: string | null;
}

function QRCard({ url, restaurantName, logo }: QRCardProps) {
  const qrRef = useRef<SVGSVGElement>(null);

  // ── Download como SVG ─────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-comanda-${restaurantName.replace(/\s+/g, '-').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Imprimir ──────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card de impressão */}
      <div
        id="qr-print-area"
        className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8 flex flex-col items-center gap-5 max-w-xs w-full"
      >
        {/* Logo do restaurante */}
        {logo ? (
          <img
            src={logo}
            alt={restaurantName}
            className="h-16 w-16 rounded-2xl object-cover border border-slate-200"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#F87116] to-orange-500 flex items-center justify-center">
            <QrCode className="h-8 w-8 text-white" />
          </div>
        )}

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Escaneie para abrir sua comanda
          </p>
          <p className="text-base font-bold text-slate-900">{restaurantName}</p>
        </div>

        {/* QR Code */}
        <div className="p-3 bg-white rounded-2xl border-2 border-slate-100">
          <QRCodeSVG
            ref={qrRef}
            value={url}
            size={220}
            level="H"
            includeMargin={false}
            fgColor="#0f172a"
            bgColor="#ffffff"
            imageSettings={
              logo
                ? {
                    src: logo,
                    height: 44,
                    width: 44,
                    excavate: true,
                  }
                : undefined
            }
          />
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-400 font-mono break-all leading-relaxed px-2">
            {url}
          </p>
        </div>

        {/* Instrução de uso */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-center w-full">
          <p className="text-xs text-slate-500 leading-relaxed">
            Aponte a câmera do celular para este código. Não é necessário instalar nenhum aplicativo.
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3 w-full max-w-xs">
        <Button
          onClick={handleDownload}
          variant="outline"
          className="flex-1 gap-2"
        >
          <Download className="h-4 w-4" />
          Baixar SVG
        </Button>
        <Button
          onClick={handlePrint}
          className="flex-1 gap-2 bg-[#F87116] hover:bg-orange-600 text-white"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Link direto */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-[#F87116] hover:text-orange-600 transition-colors font-medium"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Testar a experiência do cliente
      </a>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ComandaQRCode() {
  const restaurantId = useAdminRestaurantId();
  const { data: restaurant } = useRestaurant(restaurantId);

  const slug = restaurant?.slug;
  const url = slug ? getComandaUrl(slug) : null;

  return (
    <FeatureGuard feature="feature_virtual_comanda">
      <div className="p-6 max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-[#F87116]" />
            QR Code da Comanda Digital
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Imprima e cole na entrada do restaurante ou em cada mesa. O cliente escaneia e sua comanda abre automaticamente no celular.
          </p>
        </div>

        {/* Alerta de slug ausente */}
        {!slug && restaurant && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Slug do restaurante não configurado</p>
              <p className="text-xs text-amber-700 mt-1">
                Para gerar o QR Code é necessário ter um link personalizado (slug) configurado. Acesse as{' '}
                <strong>Configurações do Restaurante</strong> e defina o campo "Link Personalizado".
              </p>
            </div>
          </div>
        )}

        {/* QR Card */}
        {url && restaurant && (
          <QRCard
            url={url}
            restaurantName={restaurant.name}
            logo={restaurant.logo ?? null}
          />
        )}

        {/* Instruções de uso */}
        {url && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              Como funciona para o cliente
            </h3>
            <ol className="space-y-2">
              {[
                'O cliente chega ao restaurante e aponta a câmera para o QR Code.',
                'O celular abre automaticamente a tela da comanda — sem precisar instalar app.',
                'A comanda é criada e o cliente recebe um código de barras único (ex: CMD-1234).',
                'O cliente navega pelo cardápio e adiciona itens à comanda.',
                'No caixa, o operador escaneia o código de barras do celular do cliente e fecha a conta.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-[#F87116] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

      </div>

      {/* Estilos de impressão — visíveis apenas ao imprimir */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #qr-print-area { display: flex !important; }
        }
      `}</style>
    </FeatureGuard>
  );
}
