/**
 * Integração com balança via Web Serial API
 *
 * Suporta balanças que enviam peso em texto (ex: "0.350\r\n" ou "350\r\n" em gramas).
 * Funciona em Chrome e Edge (Chromium). Safari e Firefox não suportam Web Serial.
 */

/** Tipos mínimos para Web Serial API (Chrome/Edge) */
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface Serial {
  requestPort(options?: { filters?: unknown[] }): Promise<SerialPort>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

export type ScaleUnit = 'kg' | 'g';

export interface ScaleConfig {
  baudRate: number;
  unit: ScaleUnit;
}

const DEFAULT_CONFIG: ScaleConfig = {
  baudRate: 9600,
  unit: 'kg',
};

/** Verifica se a Web Serial API está disponível */
export function isScaleApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/** Extrai valor numérico do peso a partir de string enviada pela balança */
function parseWeightFromLine(line: string, unit: ScaleUnit): number | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Remove caracteres não numéricos exceto . e ,
  const normalized = trimmed.replace(',', '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(normalized);
  if (isNaN(num) || num < 0) return null;
  if (unit === 'g') return num / 1000; // converter gramas para kg
  return num;
}

/** Abre a porta serial e retorna um reader para leitura contínua */
export async function connectScale(
  config: Partial<ScaleConfig> = {}
): Promise<{ port: SerialPort; reader: ReadableStreamDefaultReader<Uint8Array> }> {
  if (!isScaleApiAvailable()) {
    throw new Error('Web Serial API não disponível. Use Chrome ou Edge.');
  }
  const serial = navigator.serial;
  if (!serial) throw new Error('Web Serial API não disponível.');
  const port = await serial.requestPort();
  const opts = { baudRate: config.baudRate ?? DEFAULT_CONFIG.baudRate };
  await port.open(opts);
  const reader = port.readable!.getReader();
  return { port, reader };
}

/** Lê dados da balança em loop e chama onWeight com cada valor válido */
export async function readScaleLoop(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  config: ScaleConfig,
  onWeight: (kg: number) => void,
  onError?: (err: Error) => void
): Promise<void> {
  const unit = config.unit ?? 'kg';
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const kg = parseWeightFromLine(line, unit);
        if (kg != null && kg > 0) onWeight(kg);
      }
    }
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Fecha a porta serial */
export async function disconnectScale(port: SerialPort): Promise<void> {
  try {
    await port.close();
  } catch {
    // Ignorar erro ao fechar
  }
}
