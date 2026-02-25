import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardAdvancedStatsResponse } from '@/types/dashboard-analytics';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  card: 'Cartão',
  cash: 'Dinheiro',
  table: 'Mesa',
};

const CHANNEL_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  pickup: 'Retirada',
  table: 'Mesa',
  buffet: 'Buffet',
  outros: 'Outros',
};

function sanitize(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/"/g, '""');
}

function csvRows(rows: string[][]): string {
  return rows.map((row) => row.map((c) => `"${sanitize(c)}"`).join(',')).join('\r\n');
}

function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface ExportParams {
  analytics: DashboardAdvancedStatsResponse;
  restaurantName: string;
  currency: CurrencyCode;
  periodLabel: string;
  areaLabel: string;
}

// ─────────────────────────────────────────────────────────
// CSV: single file with all sections separated by headers
// ─────────────────────────────────────────────────────────
export function exportDashboardCSV({
  analytics,
  restaurantName,
  currency,
  periodLabel,
  areaLabel,
}: ExportParams) {
  const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const sections: string[] = [];

  // ── Cabeçalho
  sections.push(csvRows([
    ['Relatório de Dashboard', restaurantName],
    ['Período', periodLabel],
    ['Área', areaLabel],
    ['Gerado em', dateStr],
    [],
  ]));

  // ── KPIs
  const k = analytics.kpis;
  sections.push(csvRows([
    ['=== INDICADORES PRINCIPAIS ==='],
    ['Faturamento', formatPrice(k.total_faturado, currency)],
    ['Total de Pedidos', String(k.total_pedidos)],
    ['Ticket Médio', formatPrice(k.ticket_medio, currency)],
    ['Pedidos Pendentes', String(k.pedidos_pendentes)],
    [],
  ]));

  // ── Financeiro
  if (analytics.financial) {
    const f = analytics.financial;
    sections.push(csvRows([
      ['=== FINANCEIRO ==='],
      ['Lucro Estimado (Receita - CMV)', formatPrice(f.gross_profit, currency)],
      [],
    ]));
  }

  // ── Clientes
  const r = analytics.retention;
  sections.push(csvRows([
    ['=== CLIENTES (por telefone) ==='],
    ['Novos', String(r.clientes_novos)],
    ['Recorrentes', String(r.clientes_recorrentes)],
    [],
  ]));

  // ── Faturamento Diário
  if (analytics.sales_trend?.length) {
    sections.push(csvRows([
      ['=== FATURAMENTO DIÁRIO ==='],
      ['Data', 'Faturamento', 'Pedidos'],
      ...analytics.sales_trend.map((d) => [
        format(new Date(d.date), 'dd/MM/yyyy', { locale: ptBR }),
        formatPrice(d.revenue, currency),
        String(d.orders),
      ]),
      [],
    ]));
  }

  // ── Formas de Pagamento
  if (analytics.payment_methods?.length) {
    sections.push(csvRows([
      ['=== FORMAS DE PAGAMENTO ==='],
      ['Método', 'Total'],
      ...analytics.payment_methods.map((pm) => [
        PAYMENT_LABELS[pm.name] ?? pm.name,
        formatPrice(pm.value, currency),
      ]),
      [],
    ]));
  }

  // ── Canais
  if (analytics.channels?.length) {
    sections.push(csvRows([
      ['=== CANAIS DE VENDA ==='],
      ['Canal', 'Faturamento', 'Pedidos', 'Ticket Médio'],
      ...analytics.channels.map((c) => [
        CHANNEL_LABELS[c.channel] ?? c.channel,
        formatPrice(c.total_vendas, currency),
        String(c.total_pedidos),
        formatPrice(
          c.total_pedidos > 0 ? c.total_vendas / c.total_pedidos : 0,
          currency
        ),
      ]),
      [],
    ]));
  }

  // ── Região
  if (analytics.top_zone) {
    sections.push(csvRows([
      ['=== REGIÃO MAIS PEDIDA ==='],
      ['Região', 'Pedidos'],
      [analytics.top_zone.name, String(analytics.top_zone.count)],
      [],
    ]));
  }

  // ── Horários de Pico
  if (analytics.peak_hours?.length) {
    sections.push(csvRows([
      ['=== HORÁRIOS DE PICO ==='],
      ['Faixa Horária', 'Pedidos'],
      ...analytics.peak_hours.map((h) => [`${h.hour}h – ${h.hour + 1}h`, String(h.count)]),
      [],
    ]));
  }

  // ── Itens mais pedidos
  if (analytics.top_products?.length) {
    sections.push(csvRows([
      ['=== ITENS MAIS PEDIDOS ==='],
      ['Item', 'Quantidade'],
      ...analytics.top_products.map((p) => [p.name, String(p.quantity)]),
      [],
    ]));
  }

  // ── Itens menos pedidos
  if (analytics.bottom_products?.length) {
    sections.push(csvRows([
      ['=== ITENS MENOS PEDIDOS ==='],
      ['Item', 'Quantidade'],
      ...analytics.bottom_products.map((p) => [p.name, String(p.quantity)]),
      [],
    ]));
  }

  // ── Recuperação de clientes
  if (analytics.retention_risk?.length) {
    sections.push(csvRows([
      ['=== RECUPERAÇÃO DE CLIENTES (sem pedido há 30+ dias) ==='],
      ['Nome', 'Telefone', 'Total Gasto'],
      ...analytics.retention_risk.map((c) => [
        c.nome,
        c.telefone,
        formatPrice(c.total_gasto, currency),
      ]),
      [],
    ]));
  }

  // ── Operacional
  if (analytics.operational) {
    const op = analytics.operational;
    sections.push(csvRows([
      ['=== OPERACIONAL ==='],
      ['Tempo Médio de Preparo (min)', op.avg_prep_time > 0 ? String(Math.round(op.avg_prep_time)) : 'N/D'],
      ['Tempo Médio de Entrega (min)', op.avg_delivery_time > 0 ? String(Math.round(op.avg_delivery_time)) : 'N/D'],
      [],
    ]));
  }

  const bom = '\uFEFF';
  const blob = new Blob([bom + sections.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const slug = restaurantName.replace(/\s+/g, '-').toLowerCase();
  const dateFile = format(new Date(), 'yyyy-MM-dd');
  downloadBlob(blob, `dashboard-${slug}-${dateFile}.csv`);
}

// ─────────────────────────────────────────────────────────
// XLSX: multi-sheet workbook
// ─────────────────────────────────────────────────────────
export function exportDashboardXLSX({
  analytics,
  restaurantName,
  currency,
  periodLabel,
  areaLabel,
}: ExportParams) {
  const wb = XLSX.utils.book_new();
  const fmtCurr = (v: number) => formatPrice(v, currency);
  const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  // ── Aba 1: Resumo
  const k = analytics.kpis;
  const f = analytics.financial;
  const r = analytics.retention;
  const resumoData = [
    ['Relatório de Dashboard', restaurantName],
    ['Período', periodLabel],
    ['Área', areaLabel],
    ['Gerado em', dateStr],
    [],
    ['INDICADORES PRINCIPAIS', ''],
    ['Faturamento', fmtCurr(k.total_faturado)],
    ['Total de Pedidos', k.total_pedidos],
    ['Ticket Médio', fmtCurr(k.ticket_medio)],
    ['Pedidos Pendentes', k.pedidos_pendentes],
    ...(f ? [
      [],
      ['FINANCEIRO', ''],
      ['Lucro Estimado (Receita - CMV)', fmtCurr(f.gross_profit)],
    ] : []),
    [],
    ['CLIENTES (por telefone)', ''],
    ['Novos', r.clientes_novos],
    ['Recorrentes', r.clientes_recorrentes],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 36 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // ── Aba 2: Faturamento Diário
  if (analytics.sales_trend?.length) {
    const trendData = [
      ['Data', 'Faturamento', 'Pedidos'],
      ...analytics.sales_trend.map((d) => [
        format(new Date(d.date), 'dd/MM/yyyy', { locale: ptBR }),
        fmtCurr(d.revenue),
        d.orders,
      ]),
    ];
    const wsTrend = XLSX.utils.aoa_to_sheet(trendData);
    wsTrend['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsTrend, 'Faturamento Diário');
  }

  // ── Aba 3: Pagamentos e Canais
  const payData = [
    ['FORMAS DE PAGAMENTO', '', '', 'CANAIS DE VENDA', '', '', ''],
    ['Método', 'Total', '', 'Canal', 'Faturamento', 'Pedidos', 'Ticket Médio'],
    ...Array.from({
      length: Math.max(
        analytics.payment_methods?.length ?? 0,
        analytics.channels?.length ?? 0
      ),
    }).map((_, i) => {
      const pm = analytics.payment_methods?.[i];
      const ch = analytics.channels?.[i];
      return [
        pm ? (PAYMENT_LABELS[pm.name] ?? pm.name) : '',
        pm ? fmtCurr(pm.value) : '',
        '',
        ch ? (CHANNEL_LABELS[ch.channel] ?? ch.channel) : '',
        ch ? fmtCurr(ch.total_vendas) : '',
        ch ? ch.total_pedidos : '',
        ch ? fmtCurr(ch.total_pedidos > 0 ? ch.total_vendas / ch.total_pedidos : 0) : '',
      ];
    }),
  ];
  const wsPay = XLSX.utils.aoa_to_sheet(payData);
  wsPay['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 2 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsPay, 'Pagamentos e Canais');

  // ── Aba 4: Produtos
  const prodData = [
    ['ITENS MAIS PEDIDOS', '', 'ITENS MENOS PEDIDOS', ''],
    ['Item', 'Qtd', 'Item', 'Qtd'],
    ...Array.from({
      length: Math.max(
        analytics.top_products?.length ?? 0,
        analytics.bottom_products?.length ?? 0
      ),
    }).map((_, i) => [
      analytics.top_products?.[i]?.name ?? '',
      analytics.top_products?.[i]?.quantity ?? '',
      analytics.bottom_products?.[i]?.name ?? '',
      analytics.bottom_products?.[i]?.quantity ?? '',
    ]),
  ];
  const wsProd = XLSX.utils.aoa_to_sheet(prodData);
  wsProd['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsProd, 'Produtos');

  // ── Aba 5: Clientes
  const peakData = analytics.peak_hours?.map((h) => [
    `${h.hour}h – ${h.hour + 1}h`,
    h.count,
  ]) ?? [];
  const churnData = analytics.retention_risk?.map((c) => [
    c.nome,
    c.telefone,
    fmtCurr(c.total_gasto),
  ]) ?? [];
  const maxRows = Math.max(peakData.length, churnData.length) + 2;
  const clientesData: unknown[][] = [
    ['HORÁRIOS DE PICO', '', '', 'RECUPERAÇÃO DE CLIENTES', '', ''],
    ['Faixa Horária', 'Pedidos', '', 'Nome', 'Telefone', 'Total Gasto'],
  ];
  for (let i = 0; i < maxRows - 2; i++) {
    clientesData.push([
      peakData[i]?.[0] ?? '',
      peakData[i]?.[1] ?? '',
      '',
      churnData[i]?.[0] ?? '',
      churnData[i]?.[1] ?? '',
      churnData[i]?.[2] ?? '',
    ]);
  }
  const wsClientes = XLSX.utils.aoa_to_sheet(clientesData);
  wsClientes['!cols'] = [
    { wch: 16 }, { wch: 10 }, { wch: 2 },
    { wch: 28 }, { wch: 20 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

  // ── Aba 6: Matriz BCG
  if (analytics.menu_matrix?.items?.length) {
    const bcgData = [
      ['MATRIZ BCG DO CARDÁPIO'],
      ['Avg Volume de Corte', analytics.menu_matrix.avg_sales_cut],
      ['Avg Margem de Corte', fmtCurr(analytics.menu_matrix.avg_margin_cut)],
      [],
      ['Produto', 'Volume Vendido', 'Margem Média', 'Quadrante'],
      ...analytics.menu_matrix.items.map((item) => {
        const highSales = item.total_sold >= analytics.menu_matrix!.avg_sales_cut;
        const highMargin = item.avg_margin >= analytics.menu_matrix!.avg_margin_cut;
        const q = highSales && highMargin ? 'Estrela ⭐'
          : highSales && !highMargin ? 'Burro de Carga 🐂'
          : !highSales && highMargin ? 'Quebra-cabeças 🧩'
          : 'Cão 🐕';
        return [item.name, item.total_sold, fmtCurr(item.avg_margin), q];
      }),
    ];
    const wsBCG = XLSX.utils.aoa_to_sheet(bcgData);
    wsBCG['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsBCG, 'Matriz BCG');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const slug = restaurantName.replace(/\s+/g, '-').toLowerCase();
  const dateFile = format(new Date(), 'yyyy-MM-dd');
  downloadBlob(blob, `dashboard-${slug}-${dateFile}.xlsx`);
}
