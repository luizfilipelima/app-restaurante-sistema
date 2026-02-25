import { useEffect, useState, Suspense, useMemo, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/core/lazyWithRetry';
import { useDynamicFavicon } from '@/hooks/shared/useDynamicFavicon';
import { prefetchRestaurantMenu } from '@/hooks/queries/useRestaurantMenuData';
import { supabase } from '@/lib/core/supabase';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import InitialSplashScreen from '@/components/public/_shared/InitialSplashScreen';
import { ErrorBoundary } from '@/components/_routing/ErrorBoundary';
import { getMenuThemeConfig, paletteToCssVars, getSemanticCssVarsForCustomTheme, updateDocumentThemeMeta, resetDocumentThemeMeta } from '@/lib/menu/menuThemes';
import { getMenuThemeCache, setMenuThemeCache } from '@/lib/menu/menuThemeCache';

// Rotas públicas — lazy para reduzir bundle inicial (cardápio carrega só o necessário)
const PublicMenu = lazyWithRetry(() => import('@/pages/public/menu/Menu'));
const PublicCheckout = lazyWithRetry(() => import('@/pages/public/checkout/Checkout'));
const MenuViewOnly = lazyWithRetry(() => import('@/pages/public/menu/MenuViewOnly'));
const MenuTable = lazyWithRetry(() => import('@/pages/public/menu/MenuTable'));
const VirtualComanda = lazyWithRetry(() => import('@/pages/public/comanda/VirtualComanda'));
const PublicReservation = lazyWithRetry(() => import('@/pages/public/reservation/PublicReservation'));
const PublicWaitingQueue = lazyWithRetry(() => import('@/pages/public/reservation/PublicWaitingQueue'));
const OrderTracking = lazyWithRetry(() => import('@/pages/public/orders/OrderTracking'));
const OrderConfirmation = lazyWithRetry(() => import('@/pages/public/checkout/OrderConfirmation'));
const LinkBio = lazyWithRetry(() => import('@/pages/public/link-bio/LinkBio'));

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
  const [cacheApplied, setCacheApplied] = useState(false);

  // Carregar tema do cache imediatamente (antes do paint) para evitar flash em visitas repetidas
  useLayoutEffect(() => {
    if (!tenantSlug) return;
    const cached = getMenuThemeCache(tenantSlug);
    if (cached) {
      setMenuThemeId(cached.menuThemeId);
      setMenuThemeAccent(cached.menuThemeAccent);
    }
    setCacheApplied(true);
  }, [tenantSlug]);

  const showNeutralSplash = cacheApplied && menuThemeId === null && menuThemeAccent === null;

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
        const themeId = data?.menu_theme ?? null;
        const themeAccent = data?.menu_theme_accent ?? null;
        setLogoUrl(data?.logo ?? null);
        setMenuThemeId(themeId);
        setMenuThemeAccent(themeAccent);
        setMenuThemeCache(tenantSlug, { menuThemeId: themeId, menuThemeAccent: themeAccent });
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
    if (!themeConfig) return;
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
  }, [themeConfig]);

  useDynamicFavicon(logoUrl);

  const content = (
    <Suspense fallback={<InitialSplashScreen neutral={showNeutralSplash} />}>
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
