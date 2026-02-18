import { useEffect } from 'react';

const DEFAULT_OG_IMAGE = typeof window !== 'undefined'
  ? `${window.location.origin}/quierofood-logo-f.svg`
  : '/quierofood-logo-f.svg';

interface RestaurantMeta {
  name: string;
  logo?: string | null;
}

/**
 * Define meta tags Open Graph e Twitter Card para compartilhamento de link.
 * Usa a logo do restaurante como imagem destacada (og:image) quando disponível.
 */
export function useSharingMeta(restaurant: RestaurantMeta | null) {
  useEffect(() => {
    const title = restaurant?.name
      ? `${restaurant.name} · Cardápio`
      : 'Cardápio · Quiero.food';
    const description = restaurant?.name
      ? `Confira o cardápio de ${restaurant.name}`
      : 'Cardápio digital';
    const imageUrl =
      restaurant?.logo?.trim() &&
      (restaurant.logo.startsWith('http://') || restaurant.logo.startsWith('https://'))
        ? restaurant.logo
        : restaurant?.logo?.trim() && typeof window !== 'undefined'
          ? `${window.location.origin}${restaurant.logo.startsWith('/') ? '' : '/'}${restaurant.logo}`
          : DEFAULT_OG_IMAGE;

    const tags: { property?: string; name?: string; content: string }[] = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: imageUrl },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
    ];

    const elements: HTMLElement[] = [];

    for (const tag of tags) {
      const attr = tag.property ? 'property' : 'name';
      const key = (tag.property ?? tag.name) as string;
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        elements.push(el);
      }
      el.content = tag.content;
    }

    return () => {
      elements.forEach((el) => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    };
  }, [restaurant?.name, restaurant?.logo]);
}
