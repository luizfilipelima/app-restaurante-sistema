import { useState, useEffect } from 'react';
import { Loader2, Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MENU_THEMES, THEME_IDS_BY_CATEGORY } from '@/lib/menuThemes';

interface MenuThemeSelectorProps {
  restaurantId: string | null;
  currentTheme: string | null | undefined;
  onThemeChange?: (themeId: string | null) => void;
  slug?: string;
  onInvalidateCache?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurante',
  festive: 'Festivos',
};

export default function MenuThemeSelector({
  restaurantId,
  currentTheme,
  onThemeChange,
  onInvalidateCache,
}: MenuThemeSelectorProps) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentTheme ?? null);

  useEffect(() => {
    setSelected(currentTheme ?? null);
  }, [currentTheme]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { invalidatePublicMenuCache } = await import('@/lib/invalidatePublicCache');
      const { queryClient } = await import('@/lib/queryClient');

      const { error } = await supabase
        .from('restaurants')
        .update({ menu_theme: selected })
        .eq('id', restaurantId);

      if (error) throw error;
      onThemeChange?.(selected);
      invalidatePublicMenuCache(queryClient);
      onInvalidateCache?.();
      const { toast } = await import('@/hooks/use-toast');
      toast({ title: 'Tema salvo! Atualize o cardápio para ver as mudanças.' });
    } catch (err) {
      const { toast } = await import('@/hooks/use-toast');
      toast({ title: 'Erro ao salvar tema', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selected !== (currentTheme ?? null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Tema do cardápio
        </Label>
      </div>

      <div className="space-y-3">
        {/* Opção Padrão */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Padrão</p>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`relative w-full flex flex-col items-stretch rounded-lg border-2 p-2 text-left transition-all ${
              selected === null
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
            }`}
          >
            {selected === null && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
              </span>
            )}
            <div className="flex gap-0.5 mb-1.5">
              {['#f97316', '#dc2626', '#f1f5f9', '#0f172a'].map((color, i) => (
                <div
                  key={i}
                  className="flex-1 h-4 rounded-sm border border-white/50 shadow-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-foreground leading-tight">Sistema</span>
            <span className="text-[10px] text-muted-foreground">Tema padrão laranja</span>
          </button>
        </div>

        {(Object.keys(THEME_IDS_BY_CATEGORY) as Array<keyof typeof THEME_IDS_BY_CATEGORY>).map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {THEME_IDS_BY_CATEGORY[cat].map((id) => {
                const theme = MENU_THEMES[id];
                if (!theme) return null;
                const isSelected = selected === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelected(id)}
                    className={`relative flex flex-col items-stretch rounded-lg border-2 p-2 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                      </span>
                    )}
                    <div className="flex gap-0.5 mb-1.5">
                      {theme.previewColors.map((color, i) => (
                        <div
                          key={i}
                          className="flex-1 h-4 rounded-sm border border-white/50 shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-foreground leading-tight">
                      {theme.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {theme.mode === 'light' ? 'Claro' : 'Escuro'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        className="w-full h-8 text-xs"
        onClick={handleSave}
        disabled={saving || !hasChanges}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          'Salvar tema'
        )}
      </Button>
    </div>
  );
}
