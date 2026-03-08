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
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICON_OPTIONS: Array<{ id: string; label: string; group?: string }> = [
  { id: 'Utensils', label: 'Padrão (garfo e faca)', group: 'Geral' },
  { id: 'UtensilsCrossed', label: 'Talheres cruzados', group: 'Geral' },
  { id: 'Coffee', label: 'Café / bebidas quentes', group: 'Bebidas' },
  { id: 'Wine', label: 'Vinho', group: 'Bebidas' },
  { id: 'Beer', label: 'Cerveja', group: 'Bebidas' },
  { id: 'Martini', label: 'Coquetéis / drinks', group: 'Bebidas' },
  { id: 'CupSoda', label: 'Refrigerante / soda', group: 'Bebidas' },
  { id: 'GlassWater', label: 'Água / sucos', group: 'Bebidas' },
  { id: 'Milk', label: 'Milk shake / laticínios', group: 'Bebidas' },
  { id: 'Flame', label: 'Arguile / shisha', group: 'Bebidas' },
  { id: 'Pizza', label: 'Pizza', group: 'Pratos' },
  { id: 'Salad', label: 'Salada', group: 'Pratos' },
  { id: 'Sandwich', label: 'Sanduíche / lanches', group: 'Pratos' },
  { id: 'Beef', label: 'Hambúrguer / x-burger / carne', group: 'Lanches' },
  { id: 'Wheat', label: 'Shawarma / kebab / pão árabe', group: 'Lanches' },
  { id: 'Apple', label: 'Frutas / naturais', group: 'Lanches' },
  { id: 'Carrot', label: 'Saudável / vegetais', group: 'Lanches' },
  { id: 'CookingPot', label: 'Pratos quentes / guisados', group: 'Comida árabe' },
  { id: 'Soup', label: 'Sopas / entradas', group: 'Comida árabe' },
  { id: 'Croissant', label: 'Esfihas / pastéis / árabe', group: 'Comida árabe' },
  { id: 'Cake', label: 'Bolo / sobremesas', group: 'Doces' },
  { id: 'CakeSlice', label: 'Fatia de bolo', group: 'Doces' },
  { id: 'IceCream', label: 'Sorvete', group: 'Doces' },
  { id: 'Donut', label: 'Donuts / doces', group: 'Doces' },
  { id: 'Cookie', label: 'Biscoitos / cookies', group: 'Doces' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  UtensilsCrossed,
  Coffee,
  Wine,
  Beer,
  Martini,
  CupSoda,
  GlassWater,
  Milk,
  Pizza,
  Cake,
  CakeSlice,
  Salad,
  Sandwich,
  Beef,
  Wheat,
  Apple,
  Carrot,
  IceCream,
  Croissant,
  CookingPot,
  Soup,
  Flame,
  Donut,
  Cookie,
};

/** Retorna o componente de ícone Lucide pelo nome, ou Utensils como fallback */
export function getCategoryIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName || !ICON_MAP[iconName]) return Utensils;
  return ICON_MAP[iconName];
}
