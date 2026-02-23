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
  Pizza,
  Cake,
  Salad,
  Sandwich,
  IceCream,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICON_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'Utensils', label: 'Garfo e faca (padrão)' },
  { id: 'UtensilsCrossed', label: 'Talheres cruzados' },
  { id: 'Coffee', label: 'Café / bebidas quentes' },
  { id: 'Wine', label: 'Vinho' },
  { id: 'Beer', label: 'Cerveja' },
  { id: 'Pizza', label: 'Pizza' },
  { id: 'Cake', label: 'Bolo / sobremesas' },
  { id: 'IceCream', label: 'Sorvete' },
  { id: 'Salad', label: 'Salada' },
  { id: 'Sandwich', label: 'Sanduíche / lanches' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  UtensilsCrossed,
  Coffee,
  Wine,
  Beer,
  Pizza,
  Cake,
  Salad,
  Sandwich,
  IceCream,
};

/** Retorna o componente de ícone Lucide pelo nome, ou Utensils como fallback */
export function getCategoryIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName || !ICON_MAP[iconName]) return Utensils;
  return ICON_MAP[iconName];
}
