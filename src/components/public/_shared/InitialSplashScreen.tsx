/**
 * Tela de carregamento inicial do cardápio.
 * Fundo sólido na cor base do tema (--background); ícone animado na cor de detalhe (--primary).
 * Quando dentro de StoreLayout ou MenuThemeWrapper, reflete o tema configurado (claro/escuro + cor).
 */
import { cn } from '@/lib/core/utils';

interface InitialSplashScreenProps {
  /** Quando true, aplica fade-out suave antes de desmontar */
  exiting?: boolean;
  /** Quando true, usa fundo neutro fixo (#f5f5f5) em vez do tema — evita flash na primeira carga sem cache */
  neutral?: boolean;
  className?: string;
}

const LOGO_PATH =
  'M62.11,1.5H18.77c-4.46,0-8.06,3.61-8.06,8.06v2.34h-5.13c-2.25,0-4.07,1.83-4.07,4.08s1.82,4.08,4.07,4.08h5.13v11.7h-5.13c-2.25,0-4.07,1.83-4.07,4.08s1.82,4.08,4.07,4.08h5.13v11.7h-5.13c-2.25,0-4.07,1.83-4.07,4.08s1.82,4.08,4.07,4.08h5.13v2.34c0,4.45,3.61,8.06,8.06,8.06h43.34c4.45,0,8.06-3.61,8.06-8.06V9.56c0-4.45-3.61-8.06-8.06-8.06ZM49.07,44.6v5.95c0,1.34-1.09,2.42-2.42,2.42h-12.42c-1.34,0-2.42-1.08-2.42-2.42v-5.95c-4.77,0-8.63-3.87-8.63-8.64s3.87-8.63,8.63-8.63c0-4.77,3.87-8.63,8.64-8.63s8.63,3.86,8.63,8.63c4.77,0,8.63,3.87,8.63,8.63s-3.86,8.64-8.63,8.64Z';

/** Fallback para --primary quando fora do tema (ex.: :root) */
const PRIMARY_FALLBACK = '24 95% 53%';

const NEUTRAL_BG = '#f5f5f5';

export default function InitialSplashScreen({ exiting = false, neutral = false, className }: InitialSplashScreenProps) {
  return (
    <div
      role="status"
      aria-label="Carregando cardápio"
      className={cn(
        'h-screen w-screen fixed inset-0 z-50 flex items-center justify-center',
        neutral ? '' : 'bg-background',
        'transition-opacity duration-500 ease-out',
        exiting ? 'opacity-0' : 'opacity-100',
        className
      )}
      style={neutral ? { backgroundColor: NEUTRAL_BG } : undefined}
    >
      <div className="relative flex flex-col items-center justify-center">
        <svg
          viewBox="0 0 71.67 71.67"
          className="w-16 h-16 sm:w-20 sm:h-20 select-none drop-shadow-lg"
          aria-hidden
        >
          <path
            d={LOGO_PATH}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            pathLength="1"
            strokeDasharray="1"
            className="animate-icon-draw"
            style={{
              strokeDashoffset: 1,
              stroke: `hsl(var(--primary, ${PRIMARY_FALLBACK}))`,
            }}
          />
        </svg>
      </div>
    </div>
  );
}
