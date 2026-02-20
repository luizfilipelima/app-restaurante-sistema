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
  /**
   * Base path das rotas do painel para este restaurante.
   * Exemplos: "/{slug}/painel", "/admin", "/super-admin/restaurants/{id}"
   * Usado para construir links internos (upgrade, etc.) sem hardcodar /admin.
   */
  basePath: string;
}

const AdminRestaurantContext = createContext<AdminRestaurantContextType>({
  restaurantId: null,
  restaurant: null,
  isSuperAdminView: false,
  basePath: '/admin',
});

export function useAdminRestaurant() {
  const ctx = useContext(AdminRestaurantContext);
  return ctx;
}

/** Retorna o restaurantId a usar nas queries (do contexto) */
export function useAdminRestaurantId(): string | null {
  return useContext(AdminRestaurantContext).restaurantId;
}

/** Retorna o basePath do painel (ex: "/{slug}/painel", "/admin") */
export function useAdminBasePath(): string {
  return useContext(AdminRestaurantContext).basePath;
}

/** Moeda do restaurante para formatação de valores */
export function useAdminCurrency(): CurrencyCode {
  const { restaurant } = useContext(AdminRestaurantContext);
  const valid: CurrencyCode[] = ['BRL', 'PYG', 'ARS', 'USD'];
  const c = restaurant?.currency as CurrencyCode;
  return valid.includes(c) ? c : 'BRL';
}

export { AdminRestaurantContext };
export type { AdminRestaurantContextType };
