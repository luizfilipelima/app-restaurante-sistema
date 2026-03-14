/**
 * Hook para conexão com balança via Web Serial API
 *
 * Quando conectado e um produto por peso está selecionado, o peso é lido
 * automaticamente e enviado via onWeight. O operador pode confirmar com Enter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectScale,
  disconnectScale,
  isScaleApiAvailable,
  readScaleLoop,
  type ScaleConfig,
  type ScaleUnit,
} from '@/lib/scale/scaleSerial';

/** Tipo da porta serial (Web Serial API) */
type SerialPort = Awaited<ReturnType<typeof connectScale>>['port'];

export interface UseScaleConnectionOptions {
  /** Configuração da balança */
  config?: Partial<ScaleConfig>;
  /** Callback quando um novo peso é lido (em kg) */
  onWeight?: (kg: number) => void;
}

export interface UseScaleConnectionResult {
  /** Se a Web Serial API está disponível no navegador */
  isAvailable: boolean;
  /** Se a balança está conectada */
  isConnected: boolean;
  /** Se está conectando (aguardando usuário selecionar porta) */
  isConnecting: boolean;
  /** Último peso lido (kg) - atualizado em tempo real */
  lastWeight: number | null;
  /** Conectar à balança (abre diálogo de seleção de porta) */
  connect: () => Promise<void>;
  /** Desconectar da balança */
  disconnect: () => Promise<void>;
  /** Erro da última operação */
  error: string | null;
}

export function useScaleConnection({
  config = {},
  onWeight,
}: UseScaleConnectionOptions = {}): UseScaleConnectionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onWeightRef = useRef(onWeight);
  onWeightRef.current = onWeight;

  const baudRate = config.baudRate ?? 9600;
  const unit = (config.unit ?? 'kg') as ScaleUnit;
  const scaleConfig: ScaleConfig = { baudRate, unit };

  const handleWeight = useCallback((kg: number) => {
    setLastWeight(kg);
    onWeightRef.current?.(kg);
  }, []);

  const connect = useCallback(async () => {
    if (!isScaleApiAvailable()) {
      setError('Web Serial não disponível. Use Chrome ou Edge.');
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      const { port, reader } = await connectScale(config);
      portRef.current = port;
      readerRef.current = reader;
      setIsConnected(true);
      setIsConnecting(false);

      const controller = new AbortController();
      abortRef.current = controller;

      readScaleLoop(reader, scaleConfig, handleWeight, (err) => {
        setError(err.message);
        setIsConnected(false);
      });
    } catch (err) {
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [config, scaleConfig, handleWeight]);

  const disconnect = useCallback(async () => {
    abortRef.current?.abort();
    const reader = readerRef.current;
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Ignorar
      }
      readerRef.current = null;
    }
    const port = portRef.current;
    if (port) {
      await disconnectScale(port);
      portRef.current = null;
    }
    setIsConnected(false);
    setLastWeight(null);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isAvailable: isScaleApiAvailable(),
    isConnected,
    isConnecting,
    lastWeight,
    connect,
    disconnect,
    error,
  };
}
