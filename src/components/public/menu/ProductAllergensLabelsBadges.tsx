/**
 * Badges compactos de alérgenos e etiquetas para exibição no cardápio público.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getAllergenById, getLabelById } from '@/lib/allergensLabels';

interface ProductAllergensLabelsBadgesProps {
  allergens?: string[] | null;
  labels?: string[] | null;
  className?: string;
  /** Compacto: só ícones com title. Padrão: ícone + texto */
  compact?: boolean;
}

function ProductAllergensLabelsBadges({
  allergens,
  labels,
  className,
  compact = false,
}: ProductAllergensLabelsBadgesProps) {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';
  const allergenIds = Array.isArray(allergens) ? allergens : [];
  const labelIds = Array.isArray(labels) ? labels : [];

  if (allergenIds.length === 0 && labelIds.length === 0) return null;

  const getLabel = (obj: { label: string; labelEs: string }) => (isEs ? obj.labelEs : obj.label);

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {labelIds.map((id) => {
        const l = getLabelById(id);
        if (!l) return null;
        return (
          <span
            key={`label-${id}`}
            title={getLabel(l)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/50 px-1.5 py-0.5',
              compact ? 'text-[10px]' : 'text-[10px] font-medium text-emerald-800 dark:text-emerald-200'
            )}
          >
            <l.Icon className={cn('h-2.5 w-2.5 shrink-0', l.color)} strokeWidth={2} />
            {!compact && <span>{getLabel(l)}</span>}
          </span>
        );
      })}
      {allergenIds.map((id) => {
        const a = getAllergenById(id);
        if (!a) return null;
        return (
          <span
            key={`allergen-${id}`}
            title={getLabel(a)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/50 px-1.5 py-0.5',
              compact ? 'text-[10px]' : 'text-[10px] font-medium text-amber-800 dark:text-amber-200'
            )}
          >
            <a.Icon className={cn('h-2.5 w-2.5 shrink-0', a.color)} strokeWidth={2} />
            {!compact && <span>{getLabel(a)}</span>}
          </span>
        );
      })}
    </div>
  );
}

export default memo(ProductAllergensLabelsBadges);
