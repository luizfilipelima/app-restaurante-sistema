import { useState, useCallback, useEffect } from 'react';
import type { DatabaseOrder, PrintSettingsBySector } from '@/types';
import type { OrderReceiptData } from '@/components/receipt/OrderReceipt';
import type { CurrencyCode } from '@/lib/utils';

const BODY_PRINT_CLASS = 'print-receipt';
const BODY_PAPER_58_CLASS = 'receipt-paper-58';

export interface DualReceiptSlot {
  filteredItemIds: string[];
  destinationLabel: string;
}

export function usePrinter() {
  const [receiptData, setReceiptData] = useState<OrderReceiptData | null>(null);
  const [secondReceiptData, setSecondReceiptData] = useState<OrderReceiptData | null>(null);

  const cleanupPrint = useCallback(() => {
    document.body.classList.remove(BODY_PRINT_CLASS, BODY_PAPER_58_CLASS);
    setReceiptData(null);
    setSecondReceiptData(null);
  }, []);

  useEffect(() => {
    const onAfterPrint = () => cleanupPrint();
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [cleanupPrint]);

  const printOrder = useCallback(
    (
      order: DatabaseOrder,
      restaurantName: string,
      paperWidth: '58mm' | '80mm',
      currency?: CurrencyCode,
      sectorPrintSettings?: PrintSettingsBySector,
      /** Quando fornecido, gera dois cupons (cozinha + bar) numa única chamada de window.print(). */
      dualSlots?: [DualReceiptSlot, DualReceiptSlot] | [DualReceiptSlot]
    ) => {
      const base: Omit<OrderReceiptData, 'destinationLabel' | 'filteredItemIds'> = {
        order,
        restaurantName,
        paperWidth,
        currency,
        sectorPrintSettings,
      };

      if (dualSlots && dualSlots.length === 2) {
        setReceiptData({ ...base, destinationLabel: dualSlots[0].destinationLabel, filteredItemIds: dualSlots[0].filteredItemIds });
        setSecondReceiptData({ ...base, destinationLabel: dualSlots[1].destinationLabel, filteredItemIds: dualSlots[1].filteredItemIds });
      } else if (dualSlots && dualSlots.length === 1) {
        setReceiptData({ ...base, destinationLabel: dualSlots[0].destinationLabel, filteredItemIds: dualSlots[0].filteredItemIds });
        setSecondReceiptData(null);
      } else {
        setReceiptData(base);
        setSecondReceiptData(null);
      }

      document.body.classList.add(BODY_PRINT_CLASS);
      if (paperWidth === '58mm') document.body.classList.add(BODY_PAPER_58_CLASS);
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.print();
        }, 150);
      });
    },
    []
  );

  return { printOrder, receiptData, secondReceiptData };
}
