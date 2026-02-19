/**
 * ComandaQRCode — Admin page
 * Gera o QR Code que o restaurante exibe na entrada / em cada mesa.
 * O cliente escaneia → abre slug.quiero.food/comanda (subdomínio do restaurante).
 * Protegida por FeatureGuard (plano Enterprise — feature_virtual_comanda).
 *
 * - URL: subdomínio (ex: talitacumis.quiero.food/comanda)
 * - Download em PNG com fundo transparente
 * - Impressão via janela dedicada
 */

import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { Button } from '@/components/ui/button';
import { getComandaPublicUrl } from '@/lib/utils';
import { Download, Printer, QrCode, ExternalLink, Info, Loader2 } from 'lucide-react';

// URL da comanda: slug.quiero.food/comanda (subdomínio)

// ─── Sub-componente: Card QR ─────────────────────────────────────────────────

interface QRCardProps {
  url: string;
  restaurantName: string;
  logo: string | null;
}

function QRCard({ url, restaurantName, logo }: QRCardProps) {
  const qrSvgRef = useRef<SVGSVGElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // ── Download PNG com fundo transparente ─────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pngDataUrl = await QRCode.toDataURL(url, {
        type: 'image/png',
        margin: 2,
        width: 512,
        color: {
          dark: '#0f172a',
          light: '#00000000', // transparente
        },
        errorCorrectionLevel: 'H',
      });
      const a = document.createElement('a');
      a.href = pngDataUrl;
      a.download = `qrcode-comanda-${restaurantName.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } catch (err) {
      console.error('Erro ao gerar PNG:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ── Imprimir via janela dedicada ────────────────────────────────────────────
  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Gera o QR em PNG para incluir na página de impressão
      const qrPng = await QRCode.toDataURL(url, {
        type: 'image/png',
        margin: 2,
        width: 280,
        color: { dark: '#0f172a', light: '#00000000' },
        errorCorrectionLevel: 'H',
      });

      const logoHtml = logo
        ? `<img src="${logo}" alt="${restaurantName}" style="height:64px;width:64px;border-radius:16px;object-fit:cover;border:1px solid #e2e8f0;" />`
        : `<div style="height:64px;width:64px;border-radius:16px;background:linear-gradient(135deg,#F87116,#ea580c);display:flex;align-items:center;justify-content:center;"><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M3 3h4v4H3V3zm6 0h4v4H9V3zm6 0h4v4h-4V3zM3 9h4v4H3V9zm6 0h4v4H9V9zm6 0h4v4h-4V9zM3 15h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4z"/></svg></div>`;

      const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Code Comanda - ${restaurantName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: #fff; }
    .card { max-width: 320px; margin: 0 auto; text-align: center; }
    .card h1 { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
    .card h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 24px; }
    .qr-wrap { padding: 16px; background: #fff; border-radius: 16px; border: 2px solid #f1f5f9; display: inline-block; margin-bottom: 16px; }
    .qr-wrap img { display: block; }
    .url { font-size: 10px; color: #94a3b8; word-break: break-all; padding: 0 8px; margin-bottom: 16px; font-family: monospace; }
    .instrucao { font-size: 11px; color: #64748b; background: #f8fafc; padding: 12px 16px; border-radius: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    ${logoHtml}
    <h1>Escaneie para abrir sua comanda</h1>
    <h2>${restaurantName}</h2>
    <div class="qr-wrap">
      <img src="${qrPng}" alt="QR Code" width="280" height="280" />
    </div>
    <p class="url">${url}</p>
    <p class="instrucao">Aponte a câmera do celular para este código. Não é necessário instalar nenhum aplicativo.</p>
  </div>
  <script>
    window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } };
  </script>
</body>
</html>`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Permita pop-ups para imprimir. Ou use o botão "Baixar PNG" e imprima a imagem.');
        return;
      }
      printWindow.document.write(printContent);
      printWindow.document.close();
    } catch (err) {
      console.error('Erro ao imprimir:', err);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card visual (QR para exibição — SVG com fundo branco para contraste) */}
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8 flex flex-col items-center gap-5 max-w-xs w-full"
      >
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

        <div className="p-3 bg-white rounded-2xl border-2 border-slate-100">
          <QRCodeSVG
            ref={qrSvgRef}
            value={url}
            size={220}
            level="H"
            includeMargin={false}
            fgColor="#0f172a"
            bgColor="#ffffff"
            imageSettings={
              logo
                ? { src: logo, height: 44, width: 44, excavate: true }
                : undefined
            }
          />
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-400 font-mono break-all leading-relaxed px-2">
            {url}
          </p>
        </div>

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
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Baixar PNG
        </Button>
        <Button
          onClick={handlePrint}
          className="flex-1 gap-2 bg-[#F87116] hover:bg-orange-600 text-white"
          disabled={printing}
        >
          {printing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Imprimir
        </Button>
      </div>

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
  const url = slug ? getComandaPublicUrl(slug) : null;

  return (
    <FeatureGuard feature="feature_virtual_comanda">
      <div className="p-6 max-w-2xl mx-auto space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-[#F87116]" />
            QR Code da Comanda Digital
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Imprima e cole na entrada ou em cada mesa. O cliente escaneia e abre a comanda com cardápio integrado.
          </p>
        </div>

        {!slug && restaurant && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Slug não configurado</p>
              <p className="text-xs text-amber-700 mt-1">
                Configure o link personalizado nas Configurações do Restaurante para gerar o QR Code.
              </p>
            </div>
          </div>
        )}

        {url && restaurant && (
          <QRCard
            url={url}
            restaurantName={restaurant.name}
            logo={restaurant.logo ?? null}
          />
        )}

        {url && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              Como funciona para o cliente
            </h3>
            <ol className="space-y-2">
              {[
                'O cliente aponta a câmera no QR Code.',
                'Abre a página da comanda digital com código de barras único.',
                'O cliente navega pelo cardápio e adiciona itens à comanda.',
                'No caixa, o operador escaneia o código de barras e fecha a conta.',
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
    </FeatureGuard>
  );
}
