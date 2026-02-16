import { create } from 'zustand';
import { Restaurant } from '@/types';

interface RestaurantState {
  currentRestaurant: Restaurant | null;
  setCurrentRestaurant: (restaurant: Restaurant | null) => void;
}

export const useRestaurantStore = create<RestaurantState>((set) => ({
  currentRestaurant: null,
  setCurrentRestaurant: (restaurant) => set({ currentRestaurant: restaurant }),
}));
