/**
 * Splash screen inicial do cardápio público.
 * Exibido enquanto a RPC get_restaurant_menu carrega.
 * CSS puro (sem Framer Motion) para performance e aparecimento instantâneo.
 */
import { cn } from '@/lib/utils';

interface InitialSplashScreenProps {
  /** Quando true, aplica fade-out suave antes de desmontar */
  exiting?: boolean;
  className?: string;
}

export default function InitialSplashScreen({ exiting = false, className }: InitialSplashScreenProps) {
  return (
    <div
      role="status"
      aria-label="Carregando cardápio"
      className={cn(
        'h-screen w-screen fixed inset-0 z-50 flex items-center justify-center',
        'bg-slate-50 dark:bg-slate-950',
        'transition-opacity duration-500 ease-out',
        exiting ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      <div className="animate-splash-breathe flex flex-col items-center justify-center gap-4">
        <img
          src="/icone-quierofood.svg"
          alt="Quiero.food"
          width={88}
          height={88}
          className="w-20 h-20 sm:w-24 sm:h-24 select-none drop-shadow-lg"
          fetchPriority="high"
        />
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-splash-dot" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-splash-dot" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-orange-600 animate-splash-dot" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
