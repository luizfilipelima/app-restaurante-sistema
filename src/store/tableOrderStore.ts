import { create } from 'zustand';

const STORAGE_KEY = (tableId: string) => `table-order-${tableId}`;

interface TableOrderState {
  tableId: string | null;
  tableNumber: number | null;
  /** Nome do cliente na mesa (para pedidos de autoatendimento via QR). Usado na divisão de conta. */
  tableCustomerName: string | null;
  setTable: (tableId: string, tableNumber: number, options?: { skipLoadFromStorage?: boolean }) => void;
  setTableCustomerName: (name: string | null) => void;
  clearTable: () => void;
  /** Remove dados persistidos da mesa no localStorage (quando conta foi fechada) */
  clearTableStorage: (tableId: string) => void;
}

export const useTableOrderStore = create<TableOrderState>((set, get) => ({
  tableId: null,
  tableNumber: null,
  tableCustomerName: null,
  setTable: (tableId, tableNumber, options) => {
    let tableCustomerName: string | null = null;
    if (!options?.skipLoadFromStorage) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY(tableId));
        if (raw) {
          const parsed = JSON.parse(raw) as { tableCustomerName?: string };
          if (parsed?.tableCustomerName?.trim()) tableCustomerName = parsed.tableCustomerName.trim();
        }
      } catch { /* ignore */ }
    }
    set({ tableId, tableNumber, tableCustomerName });
  },
  clearTableStorage: (tableId) => {
    try {
      localStorage.removeItem(STORAGE_KEY(tableId));
    } catch { /* ignore */ }
    const { tableId: currentId } = get();
    if (currentId === tableId) {
      set({ tableCustomerName: null });
    }
  },
  setTableCustomerName: (tableCustomerName) => {
    const { tableId, tableNumber } = get();
    set({ tableCustomerName });
    if (tableId && tableNumber != null) {
      try {
        localStorage.setItem(STORAGE_KEY(tableId), JSON.stringify({ tableNumber, tableCustomerName }));
      } catch { /* ignore */ }
    }
  },
  clearTable: () => {
    set({ tableId: null, tableNumber: null, tableCustomerName: null });
  },
}));
