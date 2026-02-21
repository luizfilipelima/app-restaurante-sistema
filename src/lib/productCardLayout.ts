import type { Product } from '@/types';

/**
 * Define se o produto usa card horizontal (padrão).
 * Todos os produtos usam layout horizontal minimalista; 'grid' é ignorado para consistência.
 */
export function shouldUseBeverageCard(_product: Product): boolean {
  return true; // Sempre horizontal para UX consistente e elegante
}
