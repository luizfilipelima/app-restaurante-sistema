/**
 * Wrapper que aplica o tema do cardápio (menu_theme) nas rotas do domínio principal.
 * Usado quando o cardápio é acessado via /:restaurantSlug/menu (sem subdomínio).
 * No subdomínio, o StoreLayout já aplica o tema.
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

  const themeConfig = useMemo(() => {
    if (menuThemeId === undefined) return null;
    const config = getMenuThemeConfig(menuThemeId, menuThemeAccent);
    if (!config) return null;
    return {
      style: paletteToCssVars(config.palette) as React.CSSProperties,
      isDark: config.isDark,
    };
  }, [menuThemeId, menuThemeAccent]);

  if (themeConfig) {
    return (
      <div
        data-menu-theme
        className={`min-h-screen ${themeConfig.isDark ? 'dark' : ''}`}
        style={themeConfig.style}
      >
        <Outlet />
      </div>
    );
  }

  return <Outlet />;
}
