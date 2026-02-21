/**
 * Invalidação de cache do TanStack Query para o cardápio público e páginas relacionadas.
 * Chamar quando o Admin alterar produtos, categorias, restaurante, zonas de entrega,
 * etc. — garante que o cliente veja as alterações ao recarregar ou reabrir o menu.
 */

import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalida os caches usados pelo cardápio público e páginas relacionadas.
 * Deve ser chamada após mutations no Admin que afetem:
 * - produtos, categorias, subcategorias
 * - restaurante (configurações, moeda, idioma, etc.)
 * - delivery_zones, product_offers
 */
export function invalidatePublicMenuCache(queryClient: QueryClient, restaurantSlug?: string | null): void {
  // Invalida get_restaurant_menu — afeta Menu, Checkout, etc.
  queryClient.invalidateQueries({ queryKey: ['restaurant-menu'] });

  // Invalida ofertas ativas (por slug e por id)
  queryClient.invalidateQueries({ queryKey: ['active-offers'] });
  queryClient.invalidateQueries({ queryKey: ['active-offers-by-id'] });

  // Invalida zonas de entrega
  queryClient.invalidateQueries({ queryKey: ['deliveryZones'] });

  // Invalida bio do restaurante (LinkBio)
  if (restaurantSlug) {
    queryClient.invalidateQueries({ queryKey: ['bio-restaurant', restaurantSlug] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['bio-restaurant'] });
  }
}
