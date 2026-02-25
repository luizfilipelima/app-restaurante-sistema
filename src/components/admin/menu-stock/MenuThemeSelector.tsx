import { useState, useEffect } from 'react';
import { Loader2, Palette, Check, Pipette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  MENU_THEMES,
  MENU_THEME_OPTIONS,
  MENU_THEME_ACCENT_OPTIONS,
  normalizeMenuThemeId,
  getMinimalPreviewColors,
  getPalettePreviewColors,
  getMinimalPalette,
  isCustomAccent,
  parseCustomAccent,
  hslToHex,
} from '@/lib/menu/menuThemes';
import ThemeColorPicker from './ThemeColorPicker';
import type { MenuThemeId } from '@/lib/menu/menuThemes';

interface MenuThemeSelectorProps {
  restaurantId: string | null;
  currentTheme: string | null | undefined;
  currentAccent: string | null | undefined;
  onThemeChange?: (themeId: MenuThemeId | null) => void;
  onAccentChange?: (accentId: string | null) => void;
  slug?: string;
  onInvalidateCache?: () => void;
}

const DEFAULT_ACCENT = 'orange';

export default function MenuThemeSelector({
  restaurantId,
  currentTheme,
  currentAccent,
  slug,
  onThemeChange,
  onAccentChange,
  onInvalidateCache,
}: MenuThemeSelectorProps) {
  const [saving, setSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<MenuThemeId>(() =>
    normalizeMenuThemeId(currentTheme)
  );
  const [selectedAccent, setSelectedAccent] = useState<string>(() =>
    currentAccent && (MENU_THEME_ACCENT_OPTIONS.some((a) => a.id === currentAccent) || isCustomAccent(currentAccent))
      ? currentAccent
      : DEFAULT_ACCENT
  );

  useEffect(() => {
    setSelectedTheme(normalizeMenuThemeId(currentTheme));
  }, [currentTheme]);

  useEffect(() => {
    setSelectedAccent(
      currentAccent && (MENU_THEME_ACCENT_OPTIONS.some((a) => a.id === currentAccent) || isCustomAccent(currentAccent))
        ? currentAccent
        : DEFAULT_ACCENT
    );
  }, [currentAccent]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const { supabase } = await import('@/lib/core/supabase');
      const { invalidatePublicMenuCache } = await import('@/lib/cache/invalidatePublicCache');
      const { queryClient } = await import('@/lib/core/queryClient');

      const accentValue =
        selectedTheme === 'minimal_light' || selectedTheme === 'minimal_dark'
          ? selectedAccent
          : null;

      const { error } = await supabase
        .from('restaurants')
        .update({
          menu_theme: selectedTheme,
          menu_theme_accent: accentValue,
        })
        .eq('id', restaurantId);

      if (error) throw error;
      onThemeChange?.(selectedTheme);
      onAccentChange?.(accentValue);
      invalidatePublicMenuCache(queryClient);
      onInvalidateCache?.();
      const { clearMenuThemeCache } = await import('@/lib/menu/menuThemeCache');
      clearMenuThemeCache(slug);
      const { toast } = await import('@/hooks/shared/use-toast');
      toast({ title: 'Tema salvo! Atualize o cardápio para ver as mudanças.' });
    } catch (err) {
      const { toast } = await import('@/hooks/shared/use-toast');
      toast({ title: 'Erro ao salvar tema', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const currentThemeNorm = normalizeMenuThemeId(currentTheme);
  const currentAccentNorm =
    currentAccent && (MENU_THEME_ACCENT_OPTIONS.some((a) => a.id === currentAccent) || isCustomAccent(currentAccent))
      ? currentAccent
      : DEFAULT_ACCENT;
  const themeChanged = selectedTheme !== currentThemeNorm;
  const accentChanged =
    (selectedTheme === 'minimal_light' || selectedTheme === 'minimal_dark') &&
    selectedAccent !== currentAccentNorm;
  const hasChanges = themeChanged || accentChanged;

  const showAccentPicker =
    selectedTheme === 'minimal_light' || selectedTheme === 'minimal_dark';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Tema do cardápio
        </Label>
      </div>

      {/* 3 opções de tema */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground">Escolha o tema</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {MENU_THEME_OPTIONS.map((opt) => {
            const isSelected = selectedTheme === opt.id;
            const previewColors =
              opt.id === 'default_light'
                ? (MENU_THEMES.default_light?.previewColors ?? []).slice(0, 5)
                : getPalettePreviewColors(getMinimalPalette(opt.mode, showAccentPicker ? selectedAccent : DEFAULT_ACCENT));

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedTheme(opt.id)}
                className={`relative flex flex-col items-stretch rounded-lg border-2 p-2.5 text-left transition-all ${
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
                <div className="flex gap-0.5 mb-2">
                  {previewColors.map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-5 rounded-sm border border-white/50 dark:border-black/20 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-foreground leading-tight block">
                  {opt.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{opt.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seletor de cor (só para minimal claro/escuro) */}
      {showAccentPicker && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground">
            Cor dos detalhes e ícones
          </p>
          <div className="flex flex-wrap gap-2">
            {MENU_THEME_ACCENT_OPTIONS.map((acc) => {
              const isSelected = selectedAccent === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccent(acc.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border-2 text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
                  }`}
                  title={acc.name}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/80 dark:border-black/30 shadow-sm"
                    style={{ backgroundColor: acc.hex }}
                  />
                  {acc.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setSelectedAccent(
                  isCustomAccent(selectedAccent) ? selectedAccent : 'custom:350,40,90'
                )
              }
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border-2 text-xs font-medium transition-all ${
                isCustomAccent(selectedAccent)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
              }`}
              title="Cor personalizada"
            >
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/80 dark:border-black/30 shadow-sm"
                style={{
                  backgroundColor: isCustomAccent(selectedAccent)
                    ? hslToHex(
                        parseCustomAccent(selectedAccent)?.h ?? 350,
                        parseCustomAccent(selectedAccent)?.s ?? 40,
                        parseCustomAccent(selectedAccent)?.l ?? 90
                      )
                    : '#a8a8a8',
                }}
              />
              <Pipette className="h-3 w-3" />
              Personalizada
            </button>
          </div>
          {isCustomAccent(selectedAccent) && (
            <ThemeColorPicker
              value={selectedAccent}
              onChange={(v) => setSelectedAccent(v)}
              label="Escolha a cor"
            />
          )}
          {/* Visualização tema claro vs escuro com a cor escolhida */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg border border-border p-2 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">Tema claro</p>
              <div className="flex gap-0.5">
                {getMinimalPreviewColors('light', selectedAccent).map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-4 rounded-sm border border-white/50 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border p-2 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">Tema escuro</p>
              <div className="flex gap-0.5">
                {getMinimalPreviewColors('dark', selectedAccent).map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-4 rounded-sm border border-white/10 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
