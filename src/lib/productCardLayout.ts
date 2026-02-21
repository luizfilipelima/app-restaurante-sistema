import type { Product } from '@/types';

/** Categorias que historicamente usam card horizontal (bebidas) */
function isBeverageCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === 'bebidas' || lower.includes('bebida') || lower === 'drinks';
}

/** Define se o produto deve usar layout beverage (card horizontal) no cardápio */
export function shouldUseBeverageCard(product: Product): boolean {
  if (product.card_layout === 'beverage') return true;
  if (product.card_layout === 'grid') return false;
  return isBeverageCategory(product.category);
}
