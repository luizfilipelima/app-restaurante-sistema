/**
 * Exportação PDF detalhada da Caja Diaria
 *
 * Gera um relatório completo com todos os pedidos do período selecionado,
 * incluindo itens, preços, tempo de preparo, forma de pagamento etc.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPrice } from '@/lib/priceHelper';
import type { CurrencyCode } from '@/lib/priceHelper';
import type { CashierDailyOrderItem } from '@/hooks/queries/useCashierDailyOrders';
import type { CashierSession } from '@/hooks/queries/useCashierSessions';

export interface CashierDailyPDFParams {
  restaurantName: string;
  periodLabel: string;
  currency: CurrencyCode;
  orders: CashierDailyOrderItem[];
  totalRevenue: number;
  totalOrders: number;
  session?: CashierSession | null;
  tagLabels: Record<string, string>;
  t: {
    title: string;
    period: string;
    generatedAt: string;
    summary: string;
    totalOrders: string;
    totalSales: string;
    openingAmount: string;
    expectedClosing: string;
    ordersDetail: string;
    date: string;
    tag: string;
    customer: string;
    items: string;
    qty: string;
    unitPrice: string;
    total: string;
    prepTime: string;
    prepTimeMin: string;
    paymentMethod: string;
    noOrders: string;
  };
}

const TAG_ORDER: Record<string, number> = {
  delivery: 1,
  pickup: 2,
  table: 3,
  buffet: 4,
  comanda: 5,
};

export function exportCashierDailyPDF(params: CashierDailyPDFParams): void {
  const {
    restaurantName,
    periodLabel,
    currency,
    orders,
    totalRevenue,
    totalOrders,
    session,
    tagLabels,
    t,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // ─── Cabeçalho ─────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(t.title, margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(restaurantName, margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${t.period}: ${periodLabel}`, margin, y);
  y += 5;
  doc.text(`${t.generatedAt}: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // ─── Resumo ────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t.summary, margin, y);
  y += 8;

  const summaryRows: [string, string][] = [
    [t.totalOrders, String(totalOrders)],
    [t.totalSales, formatPrice(totalRevenue, currency)],
  ];

  const today = new Date().toDateString();
  const sessionDateStr = session?.date ? new Date(session.date).toDateString() : '';
  if (session && sessionDateStr === today) {
    summaryRows.push([t.openingAmount, formatPrice(session.opening_amount, currency)]);
    const expected = session.opening_amount + totalRevenue;
    summaryRows.push([t.expectedClosing, formatPrice(expected, currency)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin },
    tableWidth: pageWidth - margin * 2,
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ─── Pedidos detalhados ────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t.ordersDetail, margin, y);
  y += 10;

  if (orders.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(t.noOrders, margin, y);
    doc.save(getFilename(restaurantName, periodLabel));
    return;
  }

  const sortedOrders = [...orders].sort((a, b) => {
    const ta = TAG_ORDER[a.tag] ?? 99;
    const tb = TAG_ORDER[b.tag] ?? 99;
    if (ta !== tb) return ta - tb;
    return new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime();
  });

  for (let i = 0; i < sortedOrders.length; i++) {
    const order = sortedOrders[i];
    const tagLabel = tagLabels[order.tag] ?? order.tag;
    const orderLabel = order.tableNumber != null
      ? `${tagLabel} ${order.tableNumber}`
      : order.comandaNumber != null
        ? `${tagLabel} #${order.comandaNumber}`
        : `${tagLabel} - ${order.label}`;

    // Verificar quebra de página
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`#${i + 1} ${orderLabel}`, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 6;

    doc.setFontSize(9);
    doc.text(`${t.date}: ${format(new Date(order.closedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margin, y);
    y += 5;
    doc.text(`${t.customer}: ${order.customerName ?? '—'}`, margin, y);
    y += 5;
    doc.text(`${t.paymentMethod}: ${order.paymentMethod}`, margin, y);
    if (order.prepTimeMinutes != null) {
      doc.text(`${t.prepTime}: ${order.prepTimeMinutes} ${t.prepTimeMin}`, margin + 90, y - 10);
    }
    y += 6;

    // Tabela de itens
    const itemRows = order.items.map((it) => [
      String(it.quantity),
      it.name,
      formatPrice(it.unitPrice, currency),
      formatPrice(it.totalPrice, currency),
    ]);

    autoTable(doc, {
      startY: y,
      head: [[t.qty, t.items, t.unitPrice, t.total]],
      body: itemRows,
      theme: 'striped',
      headStyles: { fillColor: [226, 232, 240], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: margin },
      tableWidth: pageWidth - margin * 2,
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${t.total}: ${formatPrice(order.total, currency)}`, pageWidth - margin - 50, y);
    doc.setFont('helvetica', 'normal');
    y += 12;
  }

  doc.save(getFilename(restaurantName, periodLabel));
}

function getFilename(restaurantName: string, periodLabel: string): string {
  const slug = restaurantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const periodSlug = periodLabel
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 30) || 'periodo';
  const datePart = format(new Date(), 'yyyy-MM-dd');
  return `caja-diaria-${slug}-${periodSlug}-${datePart}.pdf`;
}
