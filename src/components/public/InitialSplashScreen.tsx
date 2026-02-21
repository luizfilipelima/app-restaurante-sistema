/**
 * Tela de carregamento inicial do cardápio.
 * Animação de "construção" do ícone Quiero.food — o trace da marca
 * é desenhado progressivamente, reforçando o branding durante o load.
 */
import { cn } from '@/lib/utils';

interface InitialSplashScreenProps {
  /** Quando true, aplica fade-out suave antes de desmontar */
  exiting?: boolean;
  className?: string;
}

const LOGO_PATH =
  'M62.11,1.5H18.77c-4.46,0-8.06,3.61-8.06,8.06v2.34h-5.13c-2.25,0-4.07,1.83-4.07,4.08s1.82,4.08,4.07,4.08h5.13v11.7h-5.13c-2.25,0-4.07,1.83-4.07,4.08s1.82,4.08,4.07,4.08h5.13v11.7h-5.13c-2.25,0-4.07,1.83-4.07,4.08s1.82,4.08,4.07,4.08h5.13v2.34c0,4.45,3.61,8.06,8.06,8.06h43.34c4.45,0,8.06-3.61,8.06-8.06V9.56c0-4.45-3.61-8.06-8.06-8.06ZM49.07,44.6v5.95c0,1.34-1.09,2.42-2.42,2.42h-12.42c-1.34,0-2.42-1.08-2.42-2.42v-5.95c-4.77,0-8.63-3.87-8.63-8.64s3.87-8.63,8.63-8.63c0-4.77,3.87-8.63,8.64-8.63s8.63,3.86,8.63,8.63c4.77,0,8.63,3.87,8.63,8.63s-3.86,8.64-8.63,8.64Z';

export default function InitialSplashScreen({ exiting = false, className }: InitialSplashScreenProps) {
  return (
    <div
      role="status"
      aria-label="Carregando cardápio"
      className={cn(
        'h-screen w-screen fixed inset-0 z-50 flex items-center justify-center',
        'bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-50 dark:from-slate-950 dark:via-orange-950/10 dark:to-slate-950',
        'transition-opacity duration-500 ease-out',
        exiting ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Glow suave quando o ícone está completo */}
        <div
          className="absolute inset-0 w-[140px] h-[140px] -m-[30px] rounded-full bg-orange-400/10 blur-2xl animate-icon-glow"
          aria-hidden
        />
        {/* Ícone com animação de trace/construção — o path é "desenhado" progressivamente */}
        <svg
          viewBox="0 0 71.67 71.67"
          className="w-24 h-24 sm:w-28 sm:h-28 select-none drop-shadow-xl relative z-10"
          aria-hidden
        >
          <path
            d={LOGO_PATH}
            fill="none"
            stroke="#f77b28"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            pathLength="1"
            strokeDasharray="1"
            className="animate-icon-draw"
            style={{ strokeDashoffset: 1 }}
          />
        </svg>
      </div>
    </div>
  );
}
