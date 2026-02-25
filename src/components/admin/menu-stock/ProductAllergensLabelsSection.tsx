/**
 * Seção de Alérgenos e Etiquetas para produtos do cardápio.
 * Chips selecionáveis com ícones — UX elegante e acessível.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/core/utils';
import { ALLERGENS, LABELS, type AllergenId, type LabelId } from '@/lib/menu/allergensLabels';

interface ProductAllergensLabelsSectionProps {
  allergens: string[];
  labels: string[];
  onAllergensChange: (ids: string[]) => void;
  onLabelsChange: (ids: string[]) => void;
  lang?: 'pt' | 'es';
}

function ProductAllergensLabelsSection({
  allergens,
  labels,
  onAllergensChange,
  onLabelsChange,
  lang = 'pt',
}: ProductAllergensLabelsSectionProps) {
  const { i18n } = useTranslation();
  const isEs = lang === 'es' || i18n.language === 'es';

  const toggleAllergen = (id: AllergenId) => {
    if (allergens.includes(id)) {
      onAllergensChange(allergens.filter((a) => a !== id));
    } else {
      onAllergensChange([...allergens, id]);
    }
  };

  const toggleLabel = (id: LabelId) => {
    if (labels.includes(id)) {
      onLabelsChange(labels.filter((l) => l !== id));
    } else {
      onLabelsChange([...labels, id]);
    }
  };

  const getLabel = (obj: { label: string; labelEs: string }) => (isEs ? obj.labelEs : obj.label);

  return (
    <div className="space-y-4">
      {/* Alérgenos */}
      <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-900/40">
          <span className="text-amber-700 dark:text-amber-400 font-medium text-sm">
            {isEs ? 'Alérgenos' : 'Alérgenos'}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {isEs ? 'Indique qué contiene este producto' : 'Indique o que este produto contém'}
          </span>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => {
            const selected = allergens.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAllergen(a.id as AllergenId)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  'border-2 touch-manipulation active:scale-[0.97]',
                  selected
                    ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-amber-300 dark:hover:border-amber-800 hover:bg-amber-50/50 dark:hover:bg-amber-950/30'
                )}
              >
                <a.Icon className={cn('h-3.5 w-3.5 shrink-0', a.color)} strokeWidth={2} />
                <span>{getLabel(a)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Etiquetas */}
      <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-200/60 dark:border-emerald-900/40">
          <span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">
            {isEs ? 'Etiquetas' : 'Etiquetas'}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {isEs ? 'Vegetariano, picante, ecológico...' : 'Vegetariano, picante, ecológico...'}
          </span>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {LABELS.map((l) => {
            const selected = labels.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggleLabel(l.id as LabelId)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  'border-2 touch-manipulation active:scale-[0.97]',
                  selected
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-100 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                )}
              >
                <l.Icon className={cn('h-3.5 w-3.5 shrink-0', l.color)} strokeWidth={2} />
                <span>{getLabel(l)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductAllergensLabelsSection);
