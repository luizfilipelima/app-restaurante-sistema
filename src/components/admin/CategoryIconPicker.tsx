/**
 * Seletor de ícones para categorias do cardápio.
 * Layout otimizado para desktop: ícones agrupados por tipo.
 * Modo compact: botão + dropdown para economizar espaço no modal.
 */
import { CATEGORY_ICON_OPTIONS, getCategoryIconComponent } from '@/lib/categoryIcons';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

interface CategoryIconPickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  /** Modo compacto: mostra botão com ícone atual; ao clicar, abre dropdown com a grade */
  compact?: boolean;
}

const GROUPS_ORDER = ['Geral', 'Bebidas', 'Pratos', 'Comida árabe', 'Doces'];

function IconPickerGrid({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const byGroup = GROUPS_ORDER.reduce<Record<string, typeof CATEGORY_ICON_OPTIONS>>((acc, g) => {
    acc[g] = CATEGORY_ICON_OPTIONS.filter((o) => (o.group ?? 'Geral') === g);
    return acc;
  }, {});

  return (
    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
      {GROUPS_ORDER.map((groupName) => {
        const options = byGroup[groupName];
        if (!options?.length) return null;
        return (
          <div key={groupName} className="space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</span>
            <div className="grid grid-cols-6 gap-1.5">
              {options.map((opt) => {
                const IconComp = getCategoryIconComponent(opt.id);
                const selected = (value || 'Utensils') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange(opt.id)}
                    title={opt.label}
                    className={`flex items-center justify-center p-2 rounded-lg border transition-all ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <IconComp className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CategoryIconPicker({
  value,
  onChange,
  label = 'Ícone da categoria (quando não há imagem)',
  compact = false,
}: CategoryIconPickerProps) {
  const IconComp = getCategoryIconComponent(value || 'Utensils');

  if (compact) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-background hover:bg-muted/50 text-foreground transition-colors w-full sm:w-auto"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-muted/60">
                <IconComp className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="text-sm truncate flex-1 text-left">Clique para trocar</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px] p-3" sideOffset={4}>
            <IconPickerGrid value={value} onChange={onChange} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <IconPickerGrid value={value} onChange={onChange} />
    </div>
  );
}
