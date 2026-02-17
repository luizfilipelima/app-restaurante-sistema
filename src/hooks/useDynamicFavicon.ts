import { useEffect } from 'react';

const DEFAULT_FAVICON = '/favicon.svg';

/**
 * Atualiza o favicon da página com o logo do restaurante.
 * Ao desmontar ou quando logoUrl for vazio, restaura o favicon padrão (Quiero).
 */
export function useDynamicFavicon(logoUrl: string | null | undefined) {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    if (logoUrl && logoUrl.trim()) {
      link.href = logoUrl;
      link.type = logoUrl.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    } else {
      link.href = DEFAULT_FAVICON;
      link.type = 'image/svg+xml';
    }

    return () => {
      const el = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (el) {
        el.href = DEFAULT_FAVICON;
        el.type = 'image/svg+xml';
      }
    };
  }, [logoUrl]);
}
