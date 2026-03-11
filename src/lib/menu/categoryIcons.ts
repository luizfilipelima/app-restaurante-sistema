/**
 * Ícones disponíveis para categorias sem imagem no cardápio.
 * O dono do restaurante escolhe no admin; o valor é armazenado como string no banco.
 */
import {
  Utensils,
  UtensilsCrossed,
  Coffee,
  Wine,
  Beer,
  Martini,
  Pizza,
  Cake,
  CakeSlice,
  Salad,
  Sandwich,
  IceCream,
  Croissant,
  CookingPot,
  Soup,
  Flame,
  Donut,
  Cookie,
  CupSoda,
  GlassWater,
  Beef,
  Wheat,
  Apple,
  Carrot,
  Milk,
  Fish,
  Drumstick,
  EggFried,
  ChefHat,
  Layers,
  CircleDot,
  Banana,
  Grape,
  Cherry,
  Scroll,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICON_OPTIONS: Array<{ id: string; label: string; group?: string }> = [
  // Geral
  { id: 'Utensils', label: 'Padrão (garfo e faca)', group: 'Geral' },
  { id: 'UtensilsCrossed', label: 'Talheres cruzados', group: 'Geral' },
  { id: 'ChefHat', label: 'Pratos especiais / chef', group: 'Geral' },
  // Bebidas
  { id: 'Coffee', label: 'Café / bebidas quentes', group: 'Bebidas' },
  { id: 'Wine', label: 'Vinho', group: 'Bebidas' },
  { id: 'Beer', label: 'Cerveja', group: 'Bebidas' },
  { id: 'Martini', label: 'Coquetéis / drinks', group: 'Bebidas' },
  { id: 'CupSoda', label: 'Refrigerante / soda', group: 'Bebidas' },
  { id: 'GlassWater', label: 'Água / sucos', group: 'Bebidas' },
  { id: 'Milk', label: 'Milk shake / laticínios', group: 'Bebidas' },
  { id: 'Flame', label: 'Arguile / shisha', group: 'Bebidas' },
  // Pizza
  { id: 'Pizza', label: 'Pizza', group: 'Pizza' },
  { id: 'CircleDot', label: 'Pizza (fatias)', group: 'Pizza' },
  // Japonesa
  { id: 'Fish', label: 'Sushi / peixe cru', group: 'Comida japonesa' },
  { id: 'Salad', label: 'Sashimi / temaki / poke', group: 'Comida japonesa' },
  { id: 'CookingPot', label: 'Lámen / sopas japonesas', group: 'Comida japonesa' },
  // Burger / Lanches
  { id: 'Beef', label: 'Hambúrguer / x-burger', group: 'Burger e lanches' },
  { id: 'Sandwich', label: 'Sanduíche / lanche', group: 'Burger e lanches' },
  { id: 'Drumstick', label: 'Frango / batatas fritas', group: 'Burger e lanches' },
  { id: 'EggFried', label: 'Egg / café da manhã', group: 'Burger e lanches' },
  // Comida árabe
  { id: 'Wheat', label: 'Shawarma / kebab / pão árabe', group: 'Comida árabe' },
  { id: 'Scroll', label: 'Wraps / lanches enrolados', group: 'Comida árabe' },
  { id: 'Croissant', label: 'Esfiha / pastéis árabes', group: 'Comida árabe' },
  { id: 'Layers', label: 'Lomito / tábua de frios', group: 'Comida árabe' },
  { id: 'Flame', label: 'Pratos quentes / guisados árabes', group: 'Comida árabe' },
  // Pratos gerais
  { id: 'Soup', label: 'Sopas / entradas', group: 'Pratos' },
  { id: 'Carrot', label: 'Saudável / vegetais', group: 'Pratos' },
  { id: 'Apple', label: 'Frutas / naturais', group: 'Pratos' },
  { id: 'Banana', label: 'Frutas tropicais', group: 'Pratos' },
  { id: 'Grape', label: 'Vinhos / queijos', group: 'Pratos' },
  { id: 'Cherry', label: 'Sobremesas / frutas', group: 'Pratos' },
  // Doces
  { id: 'Cake', label: 'Bolo / sobremesas', group: 'Doces' },
  { id: 'CakeSlice', label: 'Fatia de bolo', group: 'Doces' },
  { id: 'IceCream', label: 'Sorvete', group: 'Doces' },
  { id: 'Donut', label: 'Donuts', group: 'Doces' },
  { id: 'Cookie', label: 'Biscoitos / cookies', group: 'Doces' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  UtensilsCrossed,
  ChefHat,
  Coffee,
  Wine,
  Beer,
  Martini,
  CupSoda,
  GlassWater,
  Milk,
  Flame,
  Pizza,
  CircleDot,
  Fish,
  Salad,
  CookingPot,
  Beef,
  Sandwich,
  Drumstick,
  EggFried,
  Wheat,
  Scroll,
  Croissant,
  Layers,
  Soup,
  Carrot,
  Apple,
  Banana,
  Grape,
  Cherry,
  Cake,
  CakeSlice,
  IceCream,
  Donut,
  Cookie,
};

/** Retorna o componente de ícone Lucide pelo nome, ou Utensils como fallback */
export function getCategoryIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName || !ICON_MAP[iconName]) return Utensils;
  return ICON_MAP[iconName];
}
