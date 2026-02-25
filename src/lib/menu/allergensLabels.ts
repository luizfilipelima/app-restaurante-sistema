/**
 * Configuração de alérgenos e etiquetas para produtos do cardápio.
 * Baseado nos 14 alérgenos da UE e etiquetas dietéticas comuns.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Wheat,
  WheatOff,
  Fish,
  Egg,
  Milk,
  TreePine,
  Leaf,
  Shell,
  Layers,
  Bean,
  Flower2,
  CircleDot,
  FlaskConical,
  Cherry,
  Citrus,
  Flame,
  LeafyGreen,
  Sprout,
} from 'lucide-react';

export const ALLERGENS: {
  id: string;
  label: string;
  labelEs: string;
  Icon: LucideIcon;
  color: string;
}[] = [
  { id: 'gluten', label: 'Glúten', labelEs: 'Gluten', Icon: Wheat, color: 'text-amber-700 dark:text-amber-400' },
  { id: 'crustaceans', label: 'Crustáceos', labelEs: 'Crustáceos', Icon: Layers, color: 'text-blue-700 dark:text-blue-400' },
  { id: 'eggs', label: 'Ovos', labelEs: 'Huevos', Icon: Egg, color: 'text-orange-600 dark:text-orange-400' },
  { id: 'fish', label: 'Peixe', labelEs: 'Pescado', Icon: Fish, color: 'text-cyan-700 dark:text-cyan-400' },
  { id: 'peanuts', label: 'Amendoim', labelEs: 'Cacahuetes', Icon: Cherry, color: 'text-amber-800 dark:text-amber-500' },
  { id: 'soy', label: 'Soja', labelEs: 'Soja', Icon: Bean, color: 'text-emerald-700 dark:text-emerald-400' },
  { id: 'milk', label: 'Lácteos', labelEs: 'Lácteos', Icon: Milk, color: 'text-slate-600 dark:text-slate-400' },
  { id: 'nuts', label: 'Frutos de casca rija', labelEs: 'Frutos de cáscara', Icon: TreePine, color: 'text-amber-900 dark:text-amber-600' },
  { id: 'celery', label: 'Aipo', labelEs: 'Apio', Icon: Leaf, color: 'text-green-700 dark:text-green-400' },
  { id: 'mustard', label: 'Mostarda', labelEs: 'Mostaza', Icon: Citrus, color: 'text-yellow-600 dark:text-yellow-400' },
  { id: 'sesame', label: 'Sésamo', labelEs: 'Sésamo', Icon: CircleDot, color: 'text-amber-700 dark:text-amber-500' },
  { id: 'sulphites', label: 'Sulfitos', labelEs: 'Sulfitos', Icon: FlaskConical, color: 'text-violet-600 dark:text-violet-400' },
  { id: 'lupin', label: 'Altramuz', labelEs: 'Altramuces', Icon: Flower2, color: 'text-pink-600 dark:text-pink-400' },
  { id: 'molluscs', label: 'Moluscos', labelEs: 'Moluscos', Icon: Shell, color: 'text-teal-600 dark:text-teal-400' },
];

export const LABELS: {
  id: string;
  label: string;
  labelEs: string;
  Icon: LucideIcon;
  color: string;
}[] = [
  { id: 'vegetarian', label: 'Vegetariano', labelEs: 'Vegetariano', Icon: LeafyGreen, color: 'text-green-700 dark:text-green-400' },
  { id: 'vegan', label: 'Vegano', labelEs: 'Vegano', Icon: Sprout, color: 'text-emerald-700 dark:text-emerald-400' },
  { id: 'spicy', label: 'Picante', labelEs: 'Picante', Icon: Flame, color: 'text-red-600 dark:text-red-400' },
  { id: 'gluten_free', label: 'Sem glúten', labelEs: 'Sin gluten', Icon: WheatOff, color: 'text-slate-600 dark:text-slate-400' },
  { id: 'organic', label: 'Ecológico', labelEs: 'Ecológico', Icon: Sprout, color: 'text-green-600 dark:text-green-500' },
];

export type AllergenId = (typeof ALLERGENS)[number]['id'];
export type LabelId = (typeof LABELS)[number]['id'];

export function getAllergenById(id: string) {
  return ALLERGENS.find((a) => a.id === id);
}

export function getLabelById(id: string) {
  return LABELS.find((l) => l.id === id);
}
