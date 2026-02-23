import { create } from 'zustand';

interface TableOrderState {
  tableId: string | null;
  tableNumber: number | null;
  /** Nome do cliente na mesa (para pedidos de autoatendimento via QR). Usado na divisão de conta. */
  tableCustomerName: string | null;
  setTable: (tableId: string, tableNumber: number) => void;
  setTableCustomerName: (name: string | null) => void;
  clearTable: () => void;
}

export const useTableOrderStore = create<TableOrderState>((set) => ({
  tableId: null,
  tableNumber: null,
  tableCustomerName: null,
  setTable: (tableId, tableNumber) => set({ tableId, tableNumber, tableCustomerName: null }),
  setTableCustomerName: (tableCustomerName) => set({ tableCustomerName }),
  clearTable: () => set({ tableId: null, tableNumber: null, tableCustomerName: null }),
}));
