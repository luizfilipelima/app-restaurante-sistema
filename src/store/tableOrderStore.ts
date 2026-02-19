import { create } from 'zustand';

interface TableOrderState {
  tableId: string | null;
  tableNumber: number | null;
  setTable: (tableId: string, tableNumber: number) => void;
  clearTable: () => void;
}

export const useTableOrderStore = create<TableOrderState>((set) => ({
  tableId: null,
  tableNumber: null,
  setTable: (tableId, tableNumber) => set({ tableId, tableNumber }),
  clearTable: () => set({ tableId: null, tableNumber: null }),
}));
