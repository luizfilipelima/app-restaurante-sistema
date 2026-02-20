/**
 * DashboardPrintReport
 *
 * Relatório de Fechamento Premium — otimizado para impressão/PDF A4.
 * Oculto na visualização normal; exibido apenas durante window.print()
 * quando a classe body.print-dashboard-report está ativa.
 *
 * Estrutura: Cabeçalho de marca → KPIs → Operacional → Gráficos → Rankings.
 * Cores: fundo branco, laranja em títulos/detalhes.
 * Quebras de página: break-inside: avoid em cards e gráficos.
 */

import { forwardRef } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { CurrencyCode } from '@/lib/priceHelper';
import { format } from 'date-fns';
import { ptBR, es, enUS } from 'date-fns/locale';

const ORANGE = '#f97316';

export interface MovementByHourItem {
  hour: string;
  count: number;
  isLowMovement?: boolean;
}

export interface DashboardPrintData {
  restaurantName:   string;
  restaurantLogo?:  string;
  period:           string;
  periodDates?:     string;
  areaLabel:        string;
  generatedAt:     Date;
  currency:         CurrencyCode;
  totalRevenue:     number;
  totalOrders:      number;
  avgTicket:        number;
  grossProfit:      number;
  avgPrepTime:      number;
  avgDeliveryTime:  number;
  paymentMethods:   { name: string; value: number }[];
  topProducts:      { name: string; quantity: number }[];
  bottomProducts?:  { name: string; quantity: number }[];
  movementByHour?:  MovementByHourItem[];
  dailyRevenue:     { date: string; revenue: number; orders: number }[];
  printPaperWidth?: '58mm' | '80mm' | null;
  t:                (key: string) => string;
  /** Idioma do painel para formatação de datas (pt, es, en) */
  lang?: 'pt' | 'es' | 'en';
}

const dateLocales = { pt: ptBR, es, en: enUS };

// ─── Bar mini chart (print-safe, HTML) ───────────────────────────────────────

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
    <div style={{ marginBottom: 4 }}>
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

// ─── Section (A4: break-inside avoid, título laranja) ─────────────────────────

function SectionA4({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        borderBottom: `2px solid ${ORANGE}`,
        paddingBottom: 2,
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: ORANGE }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── KPI row ─────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

const DashboardPrintReport = forwardRef<HTMLDivElement, DashboardPrintData>(
  (props, ref) => {
    const {
      restaurantName,
      restaurantLogo,
      period,
      periodDates,
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
      bottomProducts = [],
      movementByHour = [],
      dailyRevenue,
      printPaperWidth,
      t,
      lang = 'pt',
    } = props;

    const isThermal  = !!printPaperWidth;
    const isA4      = !isThermal;
    const dateLocale = dateLocales[lang] ?? ptBR;

    const totalMinSaved = totalOrders * 4;
    const hoursSaved    = Math.floor(totalMinSaved / 60);
    const minsSaved     = totalMinSaved % 60;
    const hoursSavedStr = hoursSaved > 0
      ? `${hoursSaved}h ${minsSaved > 0 ? `${minsSaved}min` : ''}`.trim()
      : `${minsSaved}min`;

    const paymentMethodNames: Record<string, string> = {
      pix:   'PIX',
      card:  'Cartão / Tarjeta / Card',
      cash:  'Dinheiro / Efectivo / Cash',
      table: 'Mesa / Mesa / Table',
    };

    const totalPayments = paymentMethods.reduce((s, p) => s + p.value, 0);
    const maxPayment    = paymentMethods.reduce((m, p) => Math.max(m, p.value), 0);
    const maxDailyRev   = dailyRevenue.reduce((m, d) => Math.max(m, d.revenue), 0);
    const maxMovement   = movementByHour.reduce((m, h) => Math.max(m, h.count), 0);

    const fs = isThermal
      ? { title: 13, subtitle: 10, kpiLabel: 9, kpiValue: 10 }
      : { title: 16, subtitle: 10, kpiLabel: 9, kpiValue: 11 };

    const containerStyle: React.CSSProperties = {
      fontFamily:      isThermal ? "'Courier New', Courier, monospace" : 'system-ui, -apple-system, Segoe UI, sans-serif',
      fontSize:        fs.kpiLabel,
      color:           '#111827',
      background:      'white',
      width:           isThermal ? (printPaperWidth ?? '80mm') : '100%',
      maxWidth:        isA4 ? '210mm' : undefined,
      padding:         isThermal ? '4mm 3mm' : '4mm 6mm',
      margin:          '0 auto',
      boxSizing:       'border-box' as const,
    };

    return (
      <div id="dashboard-print-report" ref={ref} className="dashboard-print-report-a4">
        <div style={containerStyle}>

          {/* ── Cabeçalho de Marca ───────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: `2px solid ${ORANGE}`,
          }}>
            {restaurantLogo && (
              <img
                src={restaurantLogo}
                alt={restaurantName}
                style={{
                  width: isA4 ? 40 : 28,
                  height: isA4 ? 40 : 28,
                  objectFit: 'contain',
                  borderRadius: 6,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: fs.title, fontWeight: 900, color: '#111827', lineHeight: 1.1 }}>
                {restaurantName}
              </div>
              <div style={{ fontSize: fs.subtitle, fontWeight: 700, color: ORANGE, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('print.title')}
              </div>
            </div>
            {isA4 && (
              <div style={{ textAlign: 'right', fontSize: 9, color: '#6b7280', lineHeight: 1.4 }}>
                {periodDates && (
                  <div><strong>{t('print.periodDates')}:</strong> {periodDates}</div>
                )}
                <div><strong>{t('print.generatedAt')}:</strong> {format(generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}</div>
                <div><strong>{t('print.period')}:</strong> {period}</div>
                {areaLabel && areaLabel !== t('dashboard.filters.all') && (
                  <div><strong>{t('print.area')}:</strong> {areaLabel}</div>
                )}
              </div>
            )}
          </div>

          {isThermal && (
            <div style={{ fontSize: 9, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}>
              <div>{t('print.generatedAt')}: {format(generatedAt, 'dd/MM/yyyy HH:mm', { locale: dateLocale })}</div>
              <div>{t('print.period')}: {period}</div>
            </div>
          )}

          {/* ── Seção 1: KPIs Financeiros (cards lado a lado) ───────────────── */}
          {isA4 && (
            <SectionA4 title={t('print.financial')}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{
                  flex: '1 1 100px',
                  minWidth: 0,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 6,
                  background: '#fafafa',
                }}>
                  <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 2 }}>{t('print.revenue')}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{formatCurrency(totalRevenue, currency)}</div>
                </div>
                <div style={{
                  flex: '1 1 100px',
                  minWidth: 0,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 6,
                  background: '#fafafa',
                }}>
                  <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 2 }}>{t('print.estimatedProfit')}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: grossProfit >= 0 ? '#059669' : '#dc2626' }}>{formatCurrency(grossProfit, currency)}</div>
                </div>
                <div style={{
                  flex: '1 1 100px',
                  minWidth: 0,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 6,
                  background: '#fafafa',
                }}>
                  <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 2 }}>{t('print.avgTicket')}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{formatCurrency(avgTicket, currency)}</div>
                </div>
              </div>
              <KpiRow label={t('print.totalOrders')} value={String(totalOrders)} />
            </SectionA4>
          )}

          {isThermal && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 800, marginBottom: 4, color: '#111827' }}>{t('print.financial')}</div>
              <KpiRow label={t('print.revenue')} value={formatCurrency(totalRevenue, currency)} highlight />
              <KpiRow label={t('print.estimatedProfit')} value={formatCurrency(grossProfit, currency)} />
              <KpiRow label={t('print.avgTicket')} value={formatCurrency(avgTicket, currency)} />
              <KpiRow label={t('print.totalOrders')} value={String(totalOrders)} />
            </div>
          )}

          {/* ── Seção 2: Eficiência Operacional ─────────────────────────────── */}
          <SectionA4 title={t('print.operations')}>
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
                value={`${hoursSavedStr} (${totalOrders} ${t('print.hoursSavedDetail')})`}
              />
            )}
          </SectionA4>

          {/* ── Seção 3: Gráficos de Performance ─────────────────────────────── */}
          {isA4 && movementByHour.length > 0 && (
            <SectionA4 title={t('print.hourlyMovement')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
                {movementByHour.map((h) => {
                  const pct = maxMovement > 0 ? (h.count / maxMovement) * 100 : 0;
                  const fill = h.isLowMovement ? '#f59e0b' : '#3b82f6';
                  return (
                    <div
                      key={h.hour}
                      style={{
                        flex: '1 1 24px',
                        minWidth: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 8, color: '#6b7280', whiteSpace: 'nowrap' }}>{h.hour}</div>
                      <div style={{
                        width: '100%',
                        height: 24,
                        background: '#e5e7eb',
                        borderRadius: 4,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}>
                        <div style={{
                          width: '80%',
                          height: `${Math.max(pct, 4)}%`,
                          background: fill,
                          borderRadius: 2,
                        }} />
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 600 }}>{h.count}</div>
                    </div>
                  );
                })}
              </div>
            </SectionA4>
          )}

          {paymentMethods.length > 0 && (
            <SectionA4 title={t('print.paymentMethods')}>
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
                    label={`${name} (${pct}%)`}
                    value={pm.value}
                    max={maxPayment}
                    formatted={formatCurrency(pm.value, currency)}
                  />
                );
              })}
            </SectionA4>
          )}

          {/* ── Seção 4: Ranking de Produtos ─────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {topProducts.length > 0 && (
              <SectionA4 title={t('print.topItems')}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #9ca3af' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 700, width: '4%' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>Produto</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.slice(0, isThermal ? 8 : 8).map((item, i) => (
                      <tr key={`top-${item.name}-${i}`} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                        <td style={{ padding: '4px 0', color: '#6b7280', fontSize: 9 }}>{i + 1}</td>
                        <td style={{ padding: '4px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionA4>
            )}

            {bottomProducts.length > 0 && isA4 && (
              <SectionA4 title={t('print.bottomItems')}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #9ca3af' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 700, width: '4%' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>Produto</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottomProducts.slice(0, 8).map((item, i) => (
                      <tr key={`bot-${item.name}-${i}`} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                        <td style={{ padding: '4px 0', color: '#6b7280', fontSize: 9 }}>{i + 1}</td>
                        <td style={{ padding: '4px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionA4>
            )}
          </div>

          {/* ── Faturamento Diário (gráfico em barras) ───────────────────────── */}
          {dailyRevenue.length > 0 && (
            <SectionA4 title={t('print.dailyRevenue')}>
              {dailyRevenue.map((d) => (
                <div key={d.date} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1, fontSize: 9 }}>
                    <span style={{ fontWeight: 600 }}>{d.date}</span>
                    <span>
                      {formatCurrency(d.revenue, currency)}
                      <span style={{ color: '#6b7280', fontSize: 9, marginLeft: 6 }}>({d.orders})</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${maxDailyRev > 0 ? (d.revenue / maxDailyRev) * 100 : 0}%`,
                      background: ORANGE,
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))}
            </SectionA4>
          )}

          {/* ── Rodapé ──────────────────────────────────────────────────────── */}
          <div style={{
            marginTop: 8,
            paddingTop: 4,
            borderTop: '1px solid #9ca3af',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#6b7280',
          }}>
            <span>{t('print.footer')}</span>
            <span>{format(generatedAt, 'dd/MM/yyyy HH:mm', { locale: dateLocale })}</span>
          </div>

        </div>
      </div>
    );
  }
);

DashboardPrintReport.displayName = 'DashboardPrintReport';
export default DashboardPrintReport;
