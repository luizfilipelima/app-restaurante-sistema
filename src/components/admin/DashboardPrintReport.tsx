/**
 * DashboardPrintReport
 *
 * Print-optimized closing report for the admin dashboard.
 * Hidden during normal view; shown exclusively during window.print()
 * when `body.print-dashboard-report` class is active.
 *
 * Supports both A4 paper and thermal paper (58mm / 80mm).
 * All labels use the admin panel language via the `t` prop.
 */

import { forwardRef } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { CurrencyCode } from '@/lib/priceHelper';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardPrintData {
  restaurantName:   string;
  restaurantLogo?:  string;
  period:           string;
  areaLabel:        string;
  generatedAt:      Date;
  currency:         CurrencyCode;
  totalRevenue:     number;
  totalOrders:      number;
  avgTicket:        number;
  grossProfit:      number;
  avgPrepTime:      number;
  avgDeliveryTime:  number;
  paymentMethods:   { name: string; value: number }[];
  topProducts:      { name: string; quantity: number }[];
  dailyRevenue:     { date: string; revenue: number; orders: number }[];
  printPaperWidth?: '58mm' | '80mm' | null;
  t:                (key: string) => string;
}

// ─── Bar mini chart rendered as a plain HTML div (print-safe) ────────────────

function BarRow({
  label,
  value,
  max,
  formatted,
}: {
  label: string;
  value: number;
  max: number;
  formatted: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: '#374151', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827' }}>{formatted}</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#374151', borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        borderBottom: '2px solid #111827',
        paddingBottom: 3,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#111827' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── KPI row: label — value ───────────────────────────────────────────────────

function KpiRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingBottom: 4,
      marginBottom: 4,
      borderBottom: '1px dotted #d1d5db',
    }}>
      <span style={{ fontSize: 10, color: '#374151' }}>{label}</span>
      <span style={{ fontSize: highlight ? 13 : 11, fontWeight: highlight ? 800 : 700, color: '#111827' }}>
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const DashboardPrintReport = forwardRef<HTMLDivElement, DashboardPrintData>(
  (props, ref) => {
    const {
      restaurantName,
      restaurantLogo,
      period,
      areaLabel,
      generatedAt,
      currency,
      totalRevenue,
      totalOrders,
      avgTicket,
      grossProfit,
      avgPrepTime,
      avgDeliveryTime,
      paymentMethods,
      topProducts,
      dailyRevenue,
      printPaperWidth,
      t,
    } = props;

    const isThermal  = !!printPaperWidth;
    const paperWidth = printPaperWidth ?? 'A4';

    // hours saved: total_orders × 4 min / 60
    const totalMinSaved = totalOrders * 4;
    const hoursSaved    = Math.floor(totalMinSaved / 60);
    const minsSaved     = totalMinSaved % 60;
    const hoursSavedStr = hoursSaved > 0
      ? `${hoursSaved}h ${minsSaved > 0 ? `${minsSaved}min` : ''}`.trim()
      : `${minsSaved}min`;

    const paymentMethodNames: Record<string, string> = {
      pix:   'PIX',
      card:  'Cartão / Tarjeta',
      cash:  'Dinheiro / Efectivo',
      table: 'Mesa / Mesa',
    };

    const totalPayments = paymentMethods.reduce((s, p) => s + p.value, 0);
    const maxPayment    = paymentMethods.reduce((m, p) => Math.max(m, p.value), 0);
    const maxDailyRev   = dailyRevenue.reduce((m, d) => Math.max(m, d.revenue), 0);

    // ── Typography scale by format ────────────────────────────────────────────
    const fs = isThermal
      ? { title: 13, subtitle: 10, kpiLabel: 9, kpiValue: 10, section: 9 }
      : { title: 18, subtitle: 11, kpiLabel: 10, kpiValue: 12, section: 10 };

    const containerStyle: React.CSSProperties = {
      fontFamily:      isThermal ? "'Courier New', Courier, monospace" : 'Arial, Helvetica, sans-serif',
      fontSize:        fs.kpiLabel,
      color:           '#111827',
      background:      'white',
      width:           isThermal ? paperWidth : '100%',
      maxWidth:        isThermal ? paperWidth : '210mm',
      padding:         isThermal ? '4mm 3mm' : '10mm 14mm',
      margin:          '0 auto',
      boxSizing:       'border-box' as const,
    };

    return (
      <div id="dashboard-print-report" ref={ref}>
        <div style={containerStyle}>

          {/* ── Cabeçalho ────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: '3px solid #111827',
          }}>
            {restaurantLogo && (
              <img
                src={restaurantLogo}
                alt={restaurantName}
                style={{ width: isThermal ? 28 : 48, height: isThermal ? 28 : 48, objectFit: 'cover', borderRadius: 4 }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: fs.title, fontWeight: 900, color: '#111827', lineHeight: 1.1 }}>
                {restaurantName}
              </div>
              <div style={{ fontSize: fs.subtitle, fontWeight: 700, color: '#374151', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('print.title')}
              </div>
            </div>
            {!isThermal && (
              <div style={{ textAlign: 'right', fontSize: 9, color: '#6b7280', lineHeight: 1.6 }}>
                <div><strong>{t('print.generatedAt')}:</strong></div>
                <div>{format(generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                <div><strong>{t('print.period')}:</strong> {period}</div>
                {areaLabel && areaLabel !== t('dashboard.filters.all') && (
                  <div><strong>{t('print.area')}:</strong> {areaLabel}</div>
                )}
              </div>
            )}
          </div>

          {/* Thermal header info (compact) */}
          {isThermal && (
            <div style={{ fontSize: 9, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}>
              <div>{t('print.generatedAt')}: {format(generatedAt, 'dd/MM/yyyy HH:mm')}</div>
              <div>{t('print.period')}: {period}</div>
              {areaLabel && areaLabel !== t('dashboard.filters.all') && (
                <div>{t('print.area')}: {areaLabel}</div>
              )}
            </div>
          )}

          {/* ── Bloco Financeiro ─────────────────────────────────────────── */}
          <Section title={t('print.financial')}>
            <KpiRow
              label={t('print.revenue')}
              value={formatCurrency(totalRevenue, currency)}
              highlight
            />
            <KpiRow
              label={t('print.estimatedProfit')}
              value={formatCurrency(grossProfit, currency)}
              highlight={grossProfit > 0}
            />
            <KpiRow
              label={t('print.avgTicket')}
              value={formatCurrency(avgTicket, currency)}
            />
            <KpiRow
              label={t('print.totalOrders')}
              value={String(totalOrders)}
            />
          </Section>

          {/* ── Bloco Operacional ─────────────────────────────────────────── */}
          <Section title={t('print.operations')}>
            <KpiRow
              label={t('print.kitchenAvg')}
              value={avgPrepTime > 0 ? `${Math.round(avgPrepTime)} min` : t('print.noData')}
            />
            <KpiRow
              label={t('print.deliveryAvg')}
              value={avgDeliveryTime > 0 ? `${Math.round(avgDeliveryTime)} min` : t('print.noData')}
            />
            {totalOrders > 0 && (
              <KpiRow
                label={t('print.hoursSaved')}
                value={`${hoursSavedStr}  (${totalOrders} ${t('print.hoursSavedDetail')})`}
              />
            )}
          </Section>

          {/* ── Formas de Pagamento ──────────────────────────────────────── */}
          {paymentMethods.length > 0 && (
            <Section title={t('print.paymentMethods')}>
              {paymentMethods.map((pm) => {
                const pct  = totalPayments > 0 ? ((pm.value / totalPayments) * 100).toFixed(0) : '0';
                const name = paymentMethodNames[pm.name] ?? pm.name;
                return isThermal ? (
                  <KpiRow
                    key={pm.name}
                    label={`${name} (${pct}%)`}
                    value={formatCurrency(pm.value, currency)}
                  />
                ) : (
                  <BarRow
                    key={pm.name}
                    label={`${name}  (${pct}%)`}
                    value={pm.value}
                    max={maxPayment}
                    formatted={formatCurrency(pm.value, currency)}
                  />
                );
              })}
            </Section>
          )}

          {/* ── Itens Mais Vendidos ──────────────────────────────────────── */}
          {topProducts.length > 0 && (
            <Section title={t('print.topItems')}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #9ca3af' }}>
                    <th style={{ textAlign: 'left', padding: '2px 0', fontWeight: 700, width: '4%' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '2px 4px', fontWeight: 700 }}>Produto</th>
                    <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 700 }}>Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, isThermal ? 8 : 12).map((item, i) => (
                    <tr key={item.name} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                      <td style={{ padding: '2px 0', color: '#6b7280', fontSize: 9 }}>{i + 1}</td>
                      <td style={{ padding: '2px 4px', maxWidth: isThermal ? '45mm' : '120mm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </td>
                      <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 700 }}>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Faturamento Diário (tabela — print-safe, sem SVG) ────────── */}
          {dailyRevenue.length > 0 && (
            <Section title={t('print.dailyRevenue')}>
              {isThermal ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <tbody>
                    {dailyRevenue.map((d) => (
                      <tr key={d.date} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                        <td style={{ padding: '2px 0', fontWeight: 600 }}>{d.date}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0' }}>{formatCurrency(d.revenue, currency)}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0', color: '#6b7280', fontSize: 8 }}>({d.orders}p)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <>
                  {/* A4: mini bar chart via CSS */}
                  {dailyRevenue.map((d) => (
                    <div key={d.date} style={{ marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                        <span style={{ fontWeight: 600 }}>{d.date}</span>
                        <span>
                          {formatCurrency(d.revenue, currency)}
                          <span style={{ color: '#6b7280', fontSize: 9, marginLeft: 6 }}>({d.orders} ped.)</span>
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${maxDailyRev > 0 ? (d.revenue / maxDailyRev) * 100 : 0}%`,
                          background: '#1f2937',
                          borderRadius: 4,
                        }} />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </Section>
          )}

          {/* ── Rodapé ───────────────────────────────────────────────────── */}
          <div style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: '1px solid #9ca3af',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 8,
            color: '#6b7280',
          }}>
            <span>{t('print.footer')}</span>
            <span>{format(generatedAt, 'dd/MM/yyyy HH:mm')}</span>
          </div>

        </div>
      </div>
    );
  }
);

DashboardPrintReport.displayName = 'DashboardPrintReport';
export default DashboardPrintReport;
