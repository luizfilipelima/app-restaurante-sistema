import { Gift, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LoyaltyStatus } from '@/types';

interface LoyaltyCardProps {
  status: LoyaltyStatus | null | undefined;
  /** Exibir versão compacta (dentro do CartDrawer) */
  compact?: boolean;
}

/**
 * Exibe o progresso de fidelidade do cliente com selos visuais.
 * Quando status.enabled é false, não renderiza nada.
 */
export default function LoyaltyCard({ status, compact = false }: LoyaltyCardProps) {
  const { t } = useTranslation();

  if (!status?.enabled) return null;

  const { points, orders_required, reward_description } = status;
  const remaining = Math.max(0, orders_required - points);
  const completed = Math.min(points, orders_required);
  const isGoalReached = points >= orders_required;

  // Determinar número de selos a exibir (máximo 10 para layout limpo)
  const displayMax = Math.min(orders_required, 10);
  const ratio = orders_required / displayMax;
  const completedDisplay = Math.min(Math.round(completed / ratio), displayMax);

  const progressPct = Math.min(100, (completed / orders_required) * 100);

  if (compact) {
    return (
      <div className={`mx-3 mb-2 rounded-xl border px-3 py-2.5 ${
        isGoalReached
          ? 'border-warning/50 bg-warning/10 dark:bg-warning/20'
          : 'border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10'
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {isGoalReached
              ? <Gift className="h-3.5 w-3.5 text-warning flex-shrink-0" />
              : <Star className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            }
            <span className={`text-[11px] font-semibold ${isGoalReached ? 'text-warning' : 'text-primary'}`}>
              {isGoalReached
                ? t('loyalty.progressComplete', { reward: reward_description })
                : remaining === 1
                  ? t('loyalty.progressLabelSingle', { remaining, reward: reward_description })
                  : t('loyalty.progressLabel', { points, remaining, reward: reward_description })
              }
            </span>
          </div>
          <span className={`text-[10px] font-bold shrink-0 ${isGoalReached ? 'text-warning' : 'text-primary'}`}>
            {completed}/{orders_required}
          </span>
        </div>

        {/* Selos */}
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: displayMax }).map((_, i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                i < completedDisplay
                  ? isGoalReached
                    ? 'bg-warning shadow-sm'
                    : 'bg-primary shadow-sm'
                  : 'bg-muted border border-border'
              }`}
            >
              <Star className={`h-2.5 w-2.5 ${i < completedDisplay ? (isGoalReached ? 'text-warning-foreground' : 'text-primary-foreground') : 'text-muted-foreground/30'}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Versão completa (para exibir no topo do cardápio ou checkout)
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${
      isGoalReached
        ? 'border-warning/50 bg-warning/10 dark:bg-warning/20'
        : 'border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/5 dark:from-primary/20 dark:via-primary/10 dark:to-primary/10'
    }`}>
      <div className="flex items-center gap-2">
        {isGoalReached
          ? <Gift className="h-5 w-5 text-warning flex-shrink-0" />
          : <Star className="h-5 w-5 text-primary flex-shrink-0" />
        }
        <div>
          <p className={`text-sm font-semibold leading-tight ${isGoalReached ? 'text-warning' : 'text-primary'}`}>
            {isGoalReached
              ? t('loyalty.progressComplete', { reward: reward_description })
              : remaining === 1
                ? t('loyalty.progressLabelSingle', { remaining, reward: reward_description })
                : t('loyalty.progressLabel', { points, remaining, reward: reward_description })
            }
          </p>
        </div>
        <span className={`ml-auto text-xs font-bold shrink-0 ${isGoalReached ? 'text-warning' : 'text-primary'}`}>
          {completed}/{orders_required}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isGoalReached ? 'bg-warning' : 'bg-primary'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Selos */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: displayMax }).map((_, i) => (
          <div
            key={i}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
              i < completedDisplay
                ? isGoalReached
                  ? 'bg-warning shadow'
                  : 'bg-primary shadow'
                : 'bg-muted border border-border'
            }`}
          >
            <Star className={`h-3 w-3 ${i < completedDisplay ? (isGoalReached ? 'text-warning-foreground' : 'text-primary-foreground') : 'text-muted-foreground/30'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Versão convite (quando o cliente ainda não tem pontos ou telefone não reconhecido) */
export function LoyaltyInvite({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  if (!enabled) return null;
  return (
    <div className="mx-3 mb-2 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3 py-2 flex items-start gap-2">
      <Star className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-semibold text-primary">{t('loyalty.inviteFirst')}</p>
        <p className="text-[10px] text-muted-foreground">{t('loyalty.inviteDesc')}</p>
      </div>
    </div>
  );
}
