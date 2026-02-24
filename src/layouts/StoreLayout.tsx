import { useEffect, useState, Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { prefetchRestaurantMenu } from '@/hooks/queries/useRestaurantMenuData';
import { supabase } from '@/lib/supabase';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import InitialSplashScreen from '@/components/public/InitialSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getMenuThemeConfig, paletteToCssVars, getSemanticCssVarsForCustomTheme } from '@/lib/menuThemes';

// Rotas públicas — lazy para reduzir bundle inicial (cardápio carrega só o necessário)
const PublicMenu = lazyWithRetry(() => import('@/pages/public/Menu'));
const PublicCheckout = lazyWithRetry(() => import('@/pages/public/Checkout'));
const MenuViewOnly = lazyWithRetry(() => import('@/pages/public/MenuViewOnly'));
const MenuTable = lazyWithRetry(() => import('@/pages/public/MenuTable'));
const VirtualComanda = lazyWithRetry(() => import('@/pages/public/VirtualComanda'));
const PublicReservation = lazyWithRetry(() => import('@/pages/public/PublicReservation'));
const PublicWaitingQueue = lazyWithRetry(() => import('@/pages/public/PublicWaitingQueue'));
const OrderTracking = lazyWithRetry(() => import('@/pages/public/OrderTracking'));
const OrderConfirmation = lazyWithRetry(() => import('@/pages/public/OrderConfirmation'));
const LinkBio = lazyWithRetry(() => import('@/pages/public/LinkBio'));

interface StoreLayoutProps {
  /** Slug do tenant (subdomínio), usado para buscar restaurante no Supabase */
  tenantSlug: string;
}

/**
 * Layout para loja/cardápio do restaurante (multi-tenant por subdomínio).
 * Ex.: pizzaria.quiero.food -> cardápio da pizzaria.
 * Aplica o tema (menu_theme + menu_theme_accent) em todas as rotas vistas pelo cliente:
 * cardápio delivery, vitrine, mesas/QR, checkout, comanda, reservas, fila, track, bio.
 */
export default function StoreLayout({ tenantSlug }: StoreLayoutProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [menuThemeId, setMenuThemeId] = useState<string | null>(null);
  const [menuThemeAccent, setMenuThemeAccent] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    (async () => {
      try {
        const [restaurantRes, _] = await Promise.all([
          supabase
            .from('restaurants')
            .select('logo, language, menu_theme, menu_theme_accent')
            .eq('slug', tenantSlug)
            .eq('is_active', true)
            .single(),
          prefetchRestaurantMenu(tenantSlug),
        ]);
        const data = restaurantRes.data;
        setLogoUrl(data?.logo ?? null);
        setMenuThemeId(data?.menu_theme ?? null);
        setMenuThemeAccent(data?.menu_theme_accent ?? null);
        const userHasChosen = hasStoredMenuLanguage();
        const lang = (userHasChosen ? getStoredMenuLanguage() : (data?.language === 'es' ? 'es' : 'pt')) as MenuLanguage;
        if (!userHasChosen) setStoredMenuLanguage(lang);
        i18n.changeLanguage(lang);
      } catch {
        setLogoUrl(null);
        setMenuThemeId(null);
        setMenuThemeAccent(null);
        i18n.changeLanguage('pt');
        setStoredMenuLanguage('pt');
      }
    })();
  }, [tenantSlug]);

  // Tema sempre aplicado: fallback para default_light se config for null
  const themeConfig = useMemo(() => {
    const config = getMenuThemeConfig(menuThemeId, menuThemeAccent) ?? getMenuThemeConfig('default_light', null);
    if (!config) return null;
    const style: React.CSSProperties = {
      ...paletteToCssVars(config.palette),
      ...(config.primaryBgGradient && { '--primary-bg': config.primaryBgGradient } as React.CSSProperties),
      // Cores semânticas seguem o tema quando não for o padrão
      ...(config.accentId != null ? getSemanticCssVarsForCustomTheme(config.palette) : {}),
    };
    return {
      style,
      isDark: config.isDark,
      accentId: config.accentId ?? undefined,
    };
  }, [menuThemeId, menuThemeAccent]);

  // Aplicar tema no documentElement para modais/dropdowns (portais) herdarem as variáveis
  useEffect(() => {
    if (!themeConfig) return;
    const el = document.documentElement;
    Object.entries(themeConfig.style).forEach(([key, value]) => {
      if (typeof value === 'string') el.style.setProperty(key, value);
    });
    if (themeConfig.isDark) el.classList.add('dark');
    else el.classList.remove('dark');
    return () => {
      Object.keys(themeConfig.style).forEach((key) => el.style.removeProperty(key));
      el.classList.remove('dark');
    };
  }, [themeConfig]);

  useDynamicFavicon(logoUrl);

  const content = (
    <Suspense fallback={<InitialSplashScreen />}>
      <Routes>
          <Route path="/" element={<PublicMenu tenantSlug={tenantSlug} />} />
        <Route path="/categoria/:categoryId" element={<PublicMenu tenantSlug={tenantSlug} />} />
        <Route path="/menu" element={<MenuViewOnly tenantSlug={tenantSlug} />} />
        <Route path="/menu/categoria/:categoryId" element={<MenuViewOnly tenantSlug={tenantSlug} />} />
        <Route path="/cardapio/:tableNumber" element={<MenuTable tenantSlug={tenantSlug} />} />
        <Route path="/checkout" element={<PublicCheckout tenantSlug={tenantSlug} />} />
        <Route path="/order-confirmed" element={<OrderConfirmation tenantSlug={tenantSlug} />} />
        <Route path="/comanda" element={<VirtualComanda tenantSlug={tenantSlug} />} />
        <Route path="/reservar" element={<PublicReservation tenantSlug={tenantSlug} />} />
        <Route path="/fila" element={<PublicWaitingQueue tenantSlug={tenantSlug} />} />
        <Route path="/track/:orderId" element={<OrderTracking tenantSlug={tenantSlug} />} />
          <Route path="/bio" element={<LinkBio tenantSlug={tenantSlug} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div
          data-menu-theme
          data-accent={themeConfig?.accentId ?? undefined}
          className={`min-h-screen ${themeConfig?.isDark ? 'dark' : ''}`}
          style={themeConfig?.style ?? {}}
        >
          {content}
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
