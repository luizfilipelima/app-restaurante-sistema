import type { Product } from '@/types';

/**
 * Define se o produto deve usar layout horizontal no cardápio.
 * Padrão: horizontal para todos. Apenas retorna false quando card_layout === 'grid'.
 */
export function shouldUseBeverageCard(product: Product): boolean {
  if (product.card_layout === 'grid') return false;
  return true; // Padrão: card horizontal para todos os produtos
}
