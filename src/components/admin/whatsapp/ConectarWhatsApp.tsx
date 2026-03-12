/**
 * ConectarWhatsApp — Fluxo automatizado de conexão via Evolution API
 *
 * - Nome da instância gerado automaticamente: rest_{restaurantId}
 * - Botão "Gerar QR Code" cria a instância (se não existir) e exibe o QR
 * - Status "WhatsApp Conectado" quando whatsapp_connected = true (atualizado via webhook)
 * - Botão "Desconectar" para encerrar a sessão
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/core/supabase';

/** Extrai mensagem de erro do retorno da Edge Function (inclui body em 4xx/5xx). */
async function getInvokeErrorMessage(err: unknown): Promise<string> {
  const fallback = 'Falha ao chamar API';
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { message?: string; context?: { json?: () => Promise<{ error?: string }> } };
  const ctx = e.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error && typeof body.error === 'string') return body.error;
    } catch {
      /* ignore */
    }
  }
  return e.message || fallback;
}
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, RefreshCw, AlertCircle, CheckCircle2, Link2Off } from 'lucide-react';
import { toast } from '@/hooks/shared/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';

export interface ConectarWhatsAppProps {
  restaurantId: string;
  whatsappConnected?: boolean;
  disabled?: boolean;
  onStatusChange?: () => void;
  className?: string;
}

function toInstanceName(restaurantId: string): string {
  return `rest_${restaurantId.replace(/-/g, '_')}`;
}

export function ConectarWhatsApp({
  restaurantId,
  whatsappConnected = false,
  disabled,
  onStatusChange,
  className = '',
}: ConectarWhatsAppProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGerarQR = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    setError(null);
    setQrImageSrc(null);

    try {
      const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !session) {
        setError('Sessão expirada. Faça logout e login novamente para continuar.');
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { data: res, error: err } = await supabase.functions.invoke('get-evolution-qrcode', {
        body: { restaurantId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (err) {
        const ctx = err && typeof err === 'object' && 'context' in err ? (err as { context?: { status?: number } }).context : undefined;
        const status = ctx && typeof ctx === 'object' && typeof ctx.status === 'number' ? ctx.status : null;
        if (status === 401) {
          await supabase.auth.signOut();
          setError('Sessão expirada. Redirecionando para login…');
          toast({ title: 'Sessão expirada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
          navigate('/login', { replace: true });
          return;
        }
        const msg = await getInvokeErrorMessage(err);
        throw new Error(msg);
      }

      const payload = (res as { ok?: boolean; qrCode?: string; code?: string; pairingCode?: string; count?: number; data?: Record<string, unknown>; error?: string } | null);
      console.log('Resposta do Supabase:', payload);

      if (!payload?.ok) {
        const errMsg = (payload as { error?: string })?.error;
        const isAuthError = errMsg && /401|autentic|sessão|token|login/i.test(errMsg);
        throw new Error(isAuthError ? 'Sessão expirada ou inválida. Faça logout e login novamente.' : (errMsg || 'Resposta inválida'));
      }

      const qrCode = payload.qrCode as string | undefined;
      const code = payload.code as string | undefined;
      const pairingCode = payload.pairingCode as string | undefined;
      const count = payload.count as number | undefined;
      const data = payload.data as Record<string, unknown> | undefined;
      const legacyBase64 = data?.base64 as string | undefined;

      if (qrCode && typeof qrCode === 'string') {
        const src = qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
        setQrImageSrc(src);
        toast({ title: 'QR Code gerado', description: 'Escaneie com o WhatsApp do celular.' });
        queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
        onStatusChange?.();
        return;
      }

      if (code && typeof code === 'string') {
        const dataUrl = await QRCode.toDataURL(code, { margin: 2, width: 280 });
        setQrImageSrc(dataUrl);
        toast({ title: 'QR Code gerado', description: 'Escaneie com o WhatsApp do celular.' });
        queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
        onStatusChange?.();
        return;
      }

      if (legacyBase64 && typeof legacyBase64 === 'string') {
        const src = legacyBase64.startsWith('data:') ? legacyBase64 : `data:image/png;base64,${legacyBase64}`;
        setQrImageSrc(src);
        toast({ title: 'QR Code gerado', description: 'Escaneie com o WhatsApp do celular.' });
        queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
        onStatusChange?.();
        return;
      }

      if (pairingCode && typeof pairingCode === 'string' && pairingCode.length >= 6) {
        setQrImageSrc(null);
        setError(`Código de pareamento: ${pairingCode}. No WhatsApp: Menu → Aparelhos conectados → Conectar com número de telefone`);
        return;
      }

      if (count === 0) {
        setError('A instância não retornou QR Code. Tente novamente ou aguarde alguns segundos e clique em "Atualizar".');
        return;
      }

      setError('A API não retornou QR Code. Verifique a Evolution API na VPS (CONFIG_SESSION_PHONE_VERSION, SERVER_URL).');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao obter QR Code';
      setError(msg);
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, queryClient, onStatusChange, navigate]);

  const handleDesconectar = useCallback(async () => {
    if (!restaurantId) return;

    setDisconnecting(true);
    try {
      const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !session) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { error: err } = await supabase.functions.invoke('evolution-disconnect', {
        body: { restaurantId },
      });

      if (err) {
        const msg = await getInvokeErrorMessage(err);
        throw new Error(msg);
      }

      setQrImageSrc(null);
      toast({ title: 'WhatsApp desconectado' });
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      onStatusChange?.();
    } catch (e) {
      toast({
        title: 'Erro',
        description: e instanceof Error ? e.message : 'Não foi possível desconectar',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  }, [restaurantId, queryClient, onStatusChange]);

  if (whatsappConnected) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">WhatsApp Conectado</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Instância: {toInstanceName(restaurantId)}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDesconectar}
            disabled={disconnecting}
            className="gap-2"
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
            Desconectar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleGerarQR}
          disabled={disabled || loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4" />
              Gerar QR Code
            </>
          )}
        </Button>
        {qrImageSrc && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGerarQR}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Instância automática: <code className="font-mono bg-muted px-1 rounded">{toInstanceName(restaurantId)}</code>
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {qrImageSrc && !error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-6">
          <p className="text-sm font-medium text-foreground">Escaneie com o WhatsApp</p>
          <img
            src={qrImageSrc}
            alt="QR Code para conectar WhatsApp"
            className="h-[280px] w-[280px] rounded-lg border border-border bg-white p-2"
          />
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Abra o WhatsApp no celular → Menu (⋮) → Aparelhos conectados → Conectar aparelho
          </p>
        </div>
      )}
    </div>
  );
}
