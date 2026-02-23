/**
 * Seletor de ícones para categorias do cardápio.
 * Layout otimizado para desktop: ícones agrupados por tipo.
 */
import { CATEGORY_ICON_OPTIONS, getCategoryIconComponent } from '@/lib/categoryIcons';
import { Label } from '@/components/ui/label';

interface CategoryIconPickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

const GROUPS_ORDER = ['Geral', 'Bebidas', 'Pratos', 'Comida árabe', 'Doces'];

export default function CategoryIconPicker({ value, onChange, label = 'Ícone da categoria (quando não há imagem)' }: CategoryIconPickerProps) {
  const byGroup = GROUPS_ORDER.reduce<Record<string, typeof CATEGORY_ICON_OPTIONS>>((acc, g) => {
    acc[g] = CATEGORY_ICON_OPTIONS.filter((o) => (o.group ?? 'Geral') === g);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
        {GROUPS_ORDER.map((groupName) => {
          const options = byGroup[groupName];
          if (!options?.length) return null;
          return (
            <div key={groupName} className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{groupName}</span>
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-1.5">
                {options.map((opt) => {
                  const IconComp = getCategoryIconComponent(opt.id);
                  const selected = (value || 'Utensils') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange(opt.id)}
                      title={opt.label}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <IconComp className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
