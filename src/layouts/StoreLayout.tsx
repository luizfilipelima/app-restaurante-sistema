import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import PublicMenu from '@/pages/public/Menu';
import PublicCheckout from '@/pages/public/Checkout';
import MenuViewOnly from '@/pages/public/MenuViewOnly';
import MenuTable from '@/pages/public/MenuTable';
import VirtualComanda from '@/pages/public/VirtualComanda';
import OrderTracking from '@/pages/public/OrderTracking';
import LinkBio from '@/pages/public/LinkBio';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { supabase } from '@/lib/supabase';
import i18n, { setStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';

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
        const { data } = await supabase
          .from('restaurants')
          .select('logo, language')
          .eq('slug', tenantSlug)
          .eq('is_active', true)
          .single();
        setLogoUrl(data?.logo ?? null);
        const lang = (data?.language === 'es' ? 'es' : 'pt') as MenuLanguage;
        i18n.changeLanguage(lang);
        setStoredMenuLanguage(lang);
      } catch {
        setLogoUrl(null);
        i18n.changeLanguage('pt');
        setStoredMenuLanguage('pt');
      }
    })();
  }, [tenantSlug]);

  useDynamicFavicon(logoUrl);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicMenu tenantSlug={tenantSlug} />} />
        <Route path="/menu" element={<MenuViewOnly tenantSlug={tenantSlug} />} />
        <Route path="/cardapio/:tableNumber" element={<MenuTable tenantSlug={tenantSlug} />} />
        <Route path="/checkout" element={<PublicCheckout tenantSlug={tenantSlug} />} />
        <Route path="/comanda" element={<VirtualComanda tenantSlug={tenantSlug} />} />
        <Route path="/track/:orderId" element={<OrderTracking tenantSlug={tenantSlug} />} />
        <Route path="/bio" element={<LinkBio tenantSlug={tenantSlug} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
