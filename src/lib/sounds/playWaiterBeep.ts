/**
 * Bip de alerta para chamada de garçom — som padrão restaurante
 * Usa Web Audio API (sem arquivos externos)
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/** Prepara o áudio para uso (Chrome exige interação do usuário antes de tocar). Chamar no primeiro clique/toque. */
export function primeWaiterAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

/**
 * Toca um bip mais chamativo (padrão restaurante/PDV).
 * Sequência de 3 bips curtos para alertar o garçom.
 * Chamar primeWaiterAudio() no primeiro clique/toque da tela para desbloquear áudio no Chrome.
 */
export function playWaiterBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const playBip = (offset: number) => {
    try {
      const oscillator = ctx!.createOscillator();
      const gain = ctx!.createGain();
      oscillator.connect(gain);
      gain.connect(ctx!.destination);
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, ctx!.currentTime + offset);
      gain.gain.setValueAtTime(0, ctx!.currentTime + offset);
      gain.gain.linearRampToValueAtTime(0.4, ctx!.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx!.currentTime + offset + 0.15);
      oscillator.start(ctx!.currentTime + offset);
      oscillator.stop(ctx!.currentTime + offset + 0.15);
    } catch {
      /* fallback silencioso */
    }
  };

  try {
    playBip(0);
    playBip(0.2);
    playBip(0.4);
  } catch {
    /* fallback */
  }
}
