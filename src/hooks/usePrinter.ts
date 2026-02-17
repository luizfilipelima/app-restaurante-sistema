import { useState, useCallback, useEffect } from 'react';
import type { DatabaseOrder } from '@/types';
import type { OrderReceiptData } from '@/components/receipt/OrderReceipt';

const BODY_PRINT_CLASS = 'print-receipt';
const BODY_PAPER_58_CLASS = 'receipt-paper-58';

export function usePrinter() {
  const [receiptData, setReceiptData] = useState<OrderReceiptData | null>(null);

  const cleanupPrint = useCallback(() => {
    document.body.classList.remove(BODY_PRINT_CLASS, BODY_PAPER_58_CLASS);
    setReceiptData(null);
  }, []);

  useEffect(() => {
    const onAfterPrint = () => cleanupPrint();
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [cleanupPrint]);

  const printOrder = useCallback(
    (order: DatabaseOrder, restaurantName: string, paperWidth: '58mm' | '80mm', currency?: 'BRL' | 'PYG') => {
      setReceiptData({ order, restaurantName, paperWidth, currency });
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

  return { printOrder, receiptData };
}
