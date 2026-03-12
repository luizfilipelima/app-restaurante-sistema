import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  /** Itens já enviados para a cozinha (pedido de mesa) — exibidos como read-only até conta fechada */
  orderedTableItems: CartItem[];
  restaurantId: string | null;
  /** Observações gerais do pedido (campo opcional no carrinho) */
  orderNotes: string;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  replaceItem: (index: number, item: CartItem) => void;
  clearCart: () => void;
  /** Marca itens atuais como já pedidos (após envio para cozinha em pedido de mesa) */
  markTableItemsAsOrdered: () => void;
  getSubtotal: () => number;
  getItemsCount: () => number;
  getOrderedSubtotal: () => number;
  getOrderedItemsCount: () => number;
  setRestaurant: (restaurantId: string) => void;
  setOrderNotes: (notes: string) => void;
  /** Remove itens cujo productId não está em activeProductIds (produto desativado/excluído no Admin). */
  removeInactiveProducts: (activeProductIds: Set<string>) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orderedTableItems: [],
      restaurantId: null,
      orderNotes: '',

      setRestaurant: (restaurantId: string) => {
        const currentRestaurantId = get().restaurantId;
        
        // Se trocar de restaurante, limpa o carrinho e itens pedidos
        if (currentRestaurantId && currentRestaurantId !== restaurantId) {
          set({ items: [], orderedTableItems: [], restaurantId });
        } else {
          set({ restaurantId });
        }
      },

      addItem: (item: CartItem) => {
        const items = get().items;
        
        // Verifica se é um item idêntico (incluindo personalizações de pizza e marmita)
        const existingIndex = items.findIndex((i) => {
          if (i.productId !== item.productId) return false;
          if (i.isLoyaltyReward !== item.isLoyaltyReward) return false;
          if (i.isPizza && item.isPizza) {
            const sameFlavors = (JSON.stringify(i.pizzaFlavors ?? []) === JSON.stringify(item.pizzaFlavors ?? []));
            const sameAddonsPizza = (JSON.stringify(i.addons ?? []) === JSON.stringify(item.addons ?? []));
            return (
              i.pizzaSize === item.pizzaSize &&
              sameFlavors &&
              i.pizzaDough === item.pizzaDough &&
              i.pizzaEdge === item.pizzaEdge &&
              sameAddonsPizza &&
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
          const sameAddons = (JSON.stringify(i.addons ?? []) === JSON.stringify(item.addons ?? []));
          return sameAddons && i.observations === item.observations;
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

      replaceItem: (index: number, item: CartItem) => {
        const items = get().items;
        if (index < 0 || index >= items.length) return;
        const newItems = [...items];
        newItems[index] = item;
        set({ items: newItems });
      },

      clearCart: () => {
        set({ items: [], orderedTableItems: [], restaurantId: null, orderNotes: '' });
      },

      markTableItemsAsOrdered: () => {
        const { items } = get();
        set({
          orderedTableItems: [...items],
          items: [],
        });
      },

      setOrderNotes: (notes: string) => {
        set({ orderNotes: notes });
      },

      getSubtotal: () => {
        const items = get().items;
        return items.reduce((total, item) => {
          const base = item.unitPrice * item.quantity;
          const edge = (item.pizzaEdgePrice ?? 0) * item.quantity;
          const dough = (item.pizzaDoughPrice ?? 0) * item.quantity;
          return total + base + edge + dough;
        }, 0);
      },

      getItemsCount: () => {
        const items = get().items;
        return items.reduce((count, item) => count + item.quantity, 0);
      },

      getOrderedSubtotal: () => {
        const items = get().orderedTableItems;
        return items.reduce((total, item) => {
          const base = item.unitPrice * item.quantity;
          const edge = (item.pizzaEdgePrice ?? 0) * item.quantity;
          const dough = (item.pizzaDoughPrice ?? 0) * item.quantity;
          return total + base + edge + dough;
        }, 0);
      },

      getOrderedItemsCount: () => {
        const items = get().orderedTableItems;
        return items.reduce((count, item) => count + item.quantity, 0);
      },

      removeInactiveProducts: (activeProductIds: Set<string>) => {
        const { items, restaurantId } = get();
        if (restaurantId && items.length > 0) {
          const valid = items.filter((i) => i.productId && activeProductIds.has(i.productId));
          if (valid.length !== items.length) {
            set({ items: valid });
          }
        }
      },
    }),
    {
      name: 'cart-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as { items?: CartItem[]; orderedTableItems?: CartItem[]; restaurantId?: string | null; orderNotes?: string };
        const migrated = {
          ...s,
          items: s?.items ?? [],
          orderedTableItems: version < 2 ? [] : (s?.orderedTableItems ?? []),
          restaurantId: s?.restaurantId ?? null,
          orderNotes: s?.orderNotes ?? '',
        };
        return migrated;
      },
    }
  )
);
