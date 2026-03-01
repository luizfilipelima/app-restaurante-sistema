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
 * Toca um bip curto (padrão restaurante/PDV).
 * Chamar primeWaiterAudio() no primeiro clique/toque da tela para desbloquear áudio no Chrome.
 */
export function playWaiterBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Chrome exige que o contexto seja "resumed" após interação do usuário
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(900, ctx.currentTime); // Frequência típica de bip
    oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Fallback silencioso se Web Audio falhar
  }
}
