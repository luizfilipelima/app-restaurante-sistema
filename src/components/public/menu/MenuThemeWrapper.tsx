/**
 * Wrapper que aplica o tema do cardápio (menu_theme + menu_theme_accent) em todas
 * as rotas públicas do restaurante acessadas por path (/:restaurantSlug/*).
 * Garante que cardápio delivery, vitrine, mesas, checkout, reservas, fila, track, bio etc.
 * usem o mesmo tema configurado. No subdomínio, o StoreLayout aplica o tema.
 *
 * Usa cache em localStorage para evitar flash de tema em visitas repetidas.
 * Atualiza meta theme-color e background do html para refletir o tema.
 */
import { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { supabase } from '@/lib/core/supabase';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { getMenuThemeConfig, paletteToCssVars, getSemanticCssVarsForCustomTheme, updateDocumentThemeMeta, resetDocumentThemeMeta } from '@/lib/menu/menuThemes';
import { getMenuThemeCache, setMenuThemeCache } from '@/lib/menu/menuThemeCache';

export default function MenuThemeWrapper() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const [menuThemeId, setMenuThemeId] = useState<string | null | undefined>(undefined);
  const [menuThemeAccent, setMenuThemeAccent] = useState<string | null | undefined>(undefined);

  // Carregar tema do cache imediatamente (antes do paint) para evitar flash em visitas repetidas
  useLayoutEffect(() => {
    if (!restaurantSlug) {
      setMenuThemeId(undefined);
      setMenuThemeAccent(undefined);
      return;
    }
    const cached = getMenuThemeCache(restaurantSlug);
    if (cached) {
      setMenuThemeId(cached.menuThemeId);
      setMenuThemeAccent(cached.menuThemeAccent);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    if (!restaurantSlug) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('menu_theme, menu_theme_accent, language')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        const themeId = data?.menu_theme ?? null;
        const accent = data?.menu_theme_accent ?? null;
        setMenuThemeId(themeId);
        setMenuThemeAccent(accent);
        setMenuThemeCache(restaurantSlug, { menuThemeId: themeId, menuThemeAccent: accent });
        const userHasChosen = hasStoredMenuLanguage();
        const lang = (userHasChosen ? getStoredMenuLanguage() : (data?.language === 'es' ? 'es' : 'pt')) as MenuLanguage;
        if (!userHasChosen) setStoredMenuLanguage(lang);
        i18n.changeLanguage(lang);
      } catch {
        setMenuThemeId(null);
        setMenuThemeAccent(null);
        i18n.changeLanguage('pt');
      }
    })();
  }, [restaurantSlug]);

  // Sempre aplicar um tema: usa cache/default enquanto carrega; depois usa o do restaurante
  const themeConfig = useMemo(() => {
    const effectiveTheme = menuThemeId === undefined ? 'default_light' : menuThemeId;
    const effectiveAccent = menuThemeAccent === undefined ? null : menuThemeAccent;
    const config = getMenuThemeConfig(effectiveTheme, effectiveAccent);
    if (!config) return null;
    const style: React.CSSProperties = {
      ...paletteToCssVars(config.palette),
      ...(config.primaryBgGradient && { '--primary-bg': config.primaryBgGradient } as React.CSSProperties),
      ...(config.accentId != null ? getSemanticCssVarsForCustomTheme(config.palette) : {}),
    };
    return {
      style,
      isDark: config.isDark,
      accentId: config.accentId ?? undefined,
      rawConfig: config,
    };
  }, [menuThemeId, menuThemeAccent]);

  // Aplicar tema no documentElement + meta theme-color + background do html
  useEffect(() => {
    if (!restaurantSlug || !themeConfig) return;
    const el = document.documentElement;
    Object.entries(themeConfig.style).forEach(([key, value]) => {
      if (typeof value === 'string') el.style.setProperty(key, value);
    });
    if (themeConfig.isDark) el.classList.add('dark');
    else el.classList.remove('dark');
    updateDocumentThemeMeta(themeConfig.rawConfig);
    return () => {
      Object.keys(themeConfig.style).forEach((key) => el.style.removeProperty(key));
      el.classList.remove('dark');
      resetDocumentThemeMeta();
    };
  }, [restaurantSlug, themeConfig]);

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
