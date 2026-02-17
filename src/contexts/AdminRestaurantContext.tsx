import { createContext, useContext } from 'react';
import { Restaurant } from '@/types';
import type { CurrencyCode } from '@/lib/utils';

interface AdminRestaurantContextType {
  /** ID do restaurante sendo gerenciado (do user ou do super-admin) */
  restaurantId: string | null;
  /** Dados do restaurante (quando carregado) */
  restaurant: Restaurant | null;
  /** true quando o super-admin está gerenciando outro restaurante */
  isSuperAdminView: boolean;
}

const AdminRestaurantContext = createContext<AdminRestaurantContextType>({
  restaurantId: null,
  restaurant: null,
  isSuperAdminView: false,
});

export function useAdminRestaurant() {
  const ctx = useContext(AdminRestaurantContext);
  return ctx;
}

/** Retorna o restaurantId a usar nas queries (do contexto) */
export function useAdminRestaurantId(): string | null {
  return useContext(AdminRestaurantContext).restaurantId;
}

/** Moeda do restaurante para formatação de valores (BRL ou PYG) */
export function useAdminCurrency(): CurrencyCode {
  const { restaurant } = useContext(AdminRestaurantContext);
  return restaurant?.currency === 'PYG' ? 'PYG' : 'BRL';
}

export { AdminRestaurantContext };
export type { AdminRestaurantContextType };
