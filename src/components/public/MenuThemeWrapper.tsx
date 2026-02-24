/**
 * Wrapper que aplica o tema do cardápio (menu_theme) nas rotas do domínio principal.
 * Usado quando o cardápio é acessado via /:restaurantSlug/menu (sem subdomínio).
 * No subdomínio, o StoreLayout já aplica o tema.
 */
import { useEffect, useState, useMemo } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { MENU_THEMES, paletteToCssVars } from '@/lib/menuThemes';

export default function MenuThemeWrapper() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const [menuThemeId, setMenuThemeId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!restaurantSlug) {
      setMenuThemeId(undefined);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('menu_theme')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        setMenuThemeId(data?.menu_theme ?? null);
      } catch {
        setMenuThemeId(null);
      }
    })();
  }, [restaurantSlug]);

  const themeConfig = useMemo(() => {
    if (menuThemeId === undefined || !menuThemeId) return null;
    const theme = MENU_THEMES[menuThemeId];
    if (!theme) return null;
    return {
      style: paletteToCssVars(theme.palette) as React.CSSProperties,
      isDark: theme.mode === 'dark',
    };
  }, [menuThemeId]);

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
