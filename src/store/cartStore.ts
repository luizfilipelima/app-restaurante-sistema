import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemsCount: () => number;
  setRestaurant: (restaurantId: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,

      setRestaurant: (restaurantId: string) => {
        const currentRestaurantId = get().restaurantId;
        
        // Se trocar de restaurante, limpa o carrinho
        if (currentRestaurantId && currentRestaurantId !== restaurantId) {
          set({ items: [], restaurantId });
        } else {
          set({ restaurantId });
        }
      },

      addItem: (item: CartItem) => {
        const items = get().items;
        
        // Verifica se é um item idêntico (incluindo personalizações de pizza e marmita)
        const existingIndex = items.findIndex((i) => {
          if (i.productId !== item.productId) return false;
          if (i.isPizza && item.isPizza) {
            const sameFlavors = (JSON.stringify(i.pizzaFlavors ?? []) === JSON.stringify(item.pizzaFlavors ?? []));
            return (
              i.pizzaSize === item.pizzaSize &&
              sameFlavors &&
              i.pizzaDough === item.pizzaDough &&
              i.pizzaEdge === item.pizzaEdge &&
              i.observations === item.observations
            );
          }
          if (i.isMarmita && item.isMarmita) {
            const sameProteins = (JSON.stringify(i.marmitaProteins ?? []) === JSON.stringify(item.marmitaProteins ?? []));
            const sameSides = (JSON.stringify(i.marmitaSides ?? []) === JSON.stringify(item.marmitaSides ?? []));
            return (
              i.marmitaSize === item.marmitaSize &&
              sameProteins &&
              sameSides &&
              i.observations === item.observations
            );
          }
          return i.observations === item.observations;
        });

        if (existingIndex >= 0) {
          // Incrementa quantidade se item já existe
          const newItems = [...items];
          newItems[existingIndex].quantity += item.quantity;
          set({ items: newItems });
        } else {
          // Adiciona novo item
          set({ items: [...items, item] });
        }
      },

      removeItem: (index: number) => {
        const items = get().items;
        set({ items: items.filter((_, i) => i !== index) });
      },

      updateQuantity: (index: number, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(index);
          return;
        }

        const items = get().items;
        const newItems = [...items];
        newItems[index].quantity = quantity;
        set({ items: newItems });
      },

      clearCart: () => {
        set({ items: [], restaurantId: null });
      },

      getSubtotal: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
      },

      getItemsCount: () => {
        const items = get().items;
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
