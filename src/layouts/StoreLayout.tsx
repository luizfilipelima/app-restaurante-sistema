import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import PublicMenu from '@/pages/public/Menu';
import PublicCheckout from '@/pages/public/Checkout';
import MenuViewOnly from '@/pages/public/MenuViewOnly';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';
import { supabase } from '@/lib/supabase';

interface StoreLayoutProps {
  /** Slug do tenant (subdomínio), usado para buscar restaurante no Supabase */
  tenantSlug: string;
}

/**
 * Layout para loja/cardápio do restaurante (multi-tenant por subdomínio).
 * Ex.: pizzaria.quiero.food -> cardápio da pizzaria.
 * Atualiza o favicon para o logo do restaurante quando disponível.
 */
export default function StoreLayout({ tenantSlug }: StoreLayoutProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('logo')
          .eq('slug', tenantSlug)
          .eq('is_active', true)
          .single();
        setLogoUrl(data?.logo ?? null);
      } catch {
        setLogoUrl(null);
      }
    })();
  }, [tenantSlug]);

  useDynamicFavicon(logoUrl);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicMenu tenantSlug={tenantSlug} />} />
        <Route path="/menu" element={<MenuViewOnly tenantSlug={tenantSlug} />} />
        <Route path="/checkout" element={<PublicCheckout tenantSlug={tenantSlug} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
