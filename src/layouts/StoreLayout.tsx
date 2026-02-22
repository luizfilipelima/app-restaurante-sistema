import { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { prefetchRestaurantMenu } from '@/hooks/queries/useRestaurantMenuData';
import { supabase } from '@/lib/supabase';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import InitialSplashScreen from '@/components/public/InitialSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Rotas públicas — lazy para reduzir bundle inicial (cardápio carrega só o necessário)
const PublicMenu = lazyWithRetry(() => import('@/pages/public/Menu'));
const PublicCheckout = lazyWithRetry(() => import('@/pages/public/Checkout'));
const MenuViewOnly = lazyWithRetry(() => import('@/pages/public/MenuViewOnly'));
const MenuTable = lazyWithRetry(() => import('@/pages/public/MenuTable'));
const VirtualComanda = lazyWithRetry(() => import('@/pages/public/VirtualComanda'));
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
 * Carrega restaurante (logo + language), aplica idioma e evita flash antes de renderizar.
 */
export default function StoreLayout({ tenantSlug }: StoreLayoutProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    (async () => {
      try {
        const [restaurantRes, _] = await Promise.all([
          supabase
            .from('restaurants')
            .select('logo, language')
            .eq('slug', tenantSlug)
            .eq('is_active', true)
            .single(),
          prefetchRestaurantMenu(tenantSlug),
        ]);
        const data = restaurantRes.data;
        setLogoUrl(data?.logo ?? null);
        const userHasChosen = hasStoredMenuLanguage();
        const lang = (userHasChosen ? getStoredMenuLanguage() : (data?.language === 'es' ? 'es' : 'pt')) as MenuLanguage;
        if (!userHasChosen) setStoredMenuLanguage(lang);
        i18n.changeLanguage(lang);
      } catch {
        setLogoUrl(null);
        i18n.changeLanguage('pt');
        setStoredMenuLanguage('pt');
      }
    })();
  }, [tenantSlug]);

  useDynamicFavicon(logoUrl);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<InitialSplashScreen />}>
          <Routes>
          <Route path="/" element={<PublicMenu tenantSlug={tenantSlug} />} />
        <Route path="/menu" element={<MenuViewOnly tenantSlug={tenantSlug} />} />
        <Route path="/cardapio/:tableNumber" element={<MenuTable tenantSlug={tenantSlug} />} />
        <Route path="/checkout" element={<PublicCheckout tenantSlug={tenantSlug} />} />
        <Route path="/order-confirmed" element={<OrderConfirmation tenantSlug={tenantSlug} />} />
        <Route path="/comanda" element={<VirtualComanda tenantSlug={tenantSlug} />} />
        <Route path="/track/:orderId" element={<OrderTracking tenantSlug={tenantSlug} />} />
          <Route path="/bio" element={<LinkBio tenantSlug={tenantSlug} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
