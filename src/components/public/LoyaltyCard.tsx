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
          ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/40'
          : 'border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40'
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {isGoalReached
              ? <Gift className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
              : <Star className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
            }
            <span className={`text-[11px] font-semibold ${isGoalReached ? 'text-yellow-700 dark:text-yellow-400' : 'text-violet-700 dark:text-violet-400'}`}>
              {isGoalReached
                ? t('loyalty.progressComplete', { reward: reward_description })
                : remaining === 1
                  ? t('loyalty.progressLabelSingle', { remaining, reward: reward_description })
                  : t('loyalty.progressLabel', { points, remaining, reward: reward_description })
              }
            </span>
          </div>
          <span className={`text-[10px] font-bold shrink-0 ${isGoalReached ? 'text-yellow-600' : 'text-violet-500'}`}>
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
                    ? 'bg-yellow-400 shadow-sm shadow-yellow-200'
                    : 'bg-violet-500 shadow-sm shadow-violet-200'
                  : 'bg-muted border border-border'
              }`}
            >
              <Star className={`h-2.5 w-2.5 ${i < completedDisplay ? 'text-white' : 'text-muted-foreground/30'}`} />
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
        ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950/30 dark:via-amber-950/30 dark:to-orange-950/30'
        : 'border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-fuchsia-950/30'
    }`}>
      <div className="flex items-center gap-2">
        {isGoalReached
          ? <Gift className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          : <Star className="h-5 w-5 text-violet-600 flex-shrink-0" />
        }
        <div>
          <p className={`text-sm font-semibold leading-tight ${isGoalReached ? 'text-yellow-700 dark:text-yellow-400' : 'text-violet-700 dark:text-violet-400'}`}>
            {isGoalReached
              ? t('loyalty.progressComplete', { reward: reward_description })
              : remaining === 1
                ? t('loyalty.progressLabelSingle', { remaining, reward: reward_description })
                : t('loyalty.progressLabel', { points, remaining, reward: reward_description })
            }
          </p>
        </div>
        <span className={`ml-auto text-xs font-bold shrink-0 ${isGoalReached ? 'text-yellow-600' : 'text-violet-500'}`}>
          {completed}/{orders_required}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isGoalReached ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-violet-500 to-purple-600'
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
                  ? 'bg-yellow-400 shadow shadow-yellow-200'
                  : 'bg-violet-500 shadow shadow-violet-200'
                : 'bg-muted border border-border'
            }`}
          >
            <Star className={`h-3 w-3 ${i < completedDisplay ? 'text-white' : 'text-muted-foreground/30'}`} />
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
    <div className="mx-3 mb-2 rounded-xl border border-violet-200/60 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2 flex items-start gap-2">
      <Star className="h-3.5 w-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">{t('loyalty.inviteFirst')}</p>
        <p className="text-[10px] text-muted-foreground">{t('loyalty.inviteDesc')}</p>
      </div>
    </div>
  );
}
