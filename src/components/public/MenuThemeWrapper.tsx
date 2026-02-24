/**
 * Wrapper que aplica o tema do cardápio (menu_theme + menu_theme_accent) em todas
 * as rotas públicas do restaurante acessadas por path (/:restaurantSlug/*).
 * Garante que cardápio delivery, vitrine, mesas, checkout, reservas, fila, track, bio etc.
 * usem o mesmo tema configurado. No subdomínio, o StoreLayout aplica o tema.
 */
import { useEffect, useState, useMemo } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getMenuThemeConfig, paletteToCssVars } from '@/lib/menuThemes';

export default function MenuThemeWrapper() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const [menuThemeId, setMenuThemeId] = useState<string | null | undefined>(undefined);
  const [menuThemeAccent, setMenuThemeAccent] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!restaurantSlug) {
      setMenuThemeId(undefined);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('menu_theme, menu_theme_accent')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        setMenuThemeId(data?.menu_theme ?? null);
        setMenuThemeAccent(data?.menu_theme_accent ?? null);
      } catch {
        setMenuThemeId(null);
        setMenuThemeAccent(null);
      }
    })();
  }, [restaurantSlug]);

  // Sempre aplicar um tema: enquanto carrega usa default_light; depois usa o do restaurante
  const themeConfig = useMemo(() => {
    const effectiveTheme = menuThemeId === undefined ? 'default_light' : menuThemeId;
    const effectiveAccent = menuThemeAccent === undefined ? null : menuThemeAccent;
    const config = getMenuThemeConfig(effectiveTheme, effectiveAccent);
    if (!config) return null;
    const style: React.CSSProperties = {
      ...paletteToCssVars(config.palette),
      ...(config.primaryBgGradient && { '--primary-bg': config.primaryBgGradient } as React.CSSProperties),
    };
    return {
      style,
      isDark: config.isDark,
      accentId: config.accentId ?? undefined,
    };
  }, [menuThemeId, menuThemeAccent]);

  if (!restaurantSlug) return <Outlet />;

  return (
    <div
      data-menu-theme
      data-accent={themeConfig?.accentId ?? undefined}
      className={`min-h-screen ${themeConfig?.isDark ? 'dark' : ''}`}
      style={themeConfig?.style ?? {}}
    >
      <Outlet />
    </div>
  );
}
