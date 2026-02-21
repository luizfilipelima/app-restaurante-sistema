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
        'transition-opacity duration-300',
        exiting ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      <div className="animate-splash-breathe flex items-center justify-center">
        <img
          src="/icone-quierofood.svg"
          alt="Quiero.food"
          width={80}
          height={80}
          className="w-16 h-16 sm:w-20 sm:h-20 select-none"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
