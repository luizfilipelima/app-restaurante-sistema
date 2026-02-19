import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import type { DashboardMenuMatrix, DashboardMenuMatrixItem } from '@/types/dashboard-analytics';

export type Quadrant = 'estrela' | 'burro' | 'quebra_cabeca' | 'cao';

const QUADRANT_INFO: Record<
  Quadrant,
  { label: string; color: string; advice: string }
> = {
  estrela: {
    label: 'Estrela',
    color: '#10b981',
    advice: 'Produto forte. Mantenha no cardápio e invista em divulgação.',
  },
  burro: {
    label: 'Burro de Carga',
    color: '#3b82f6',
    advice: 'Vende bem mas margem baixa. Considere subir preço ou reduzir custos.',
  },
  quebra_cabeca: {
    label: 'Quebra-cabeças',
    color: '#8b5cf6',
    advice: 'Margem boa mas pouco vendido. Promova para aumentar o volume.',
  },
  cao: {
    label: 'Cão',
    color: '#ef4444',
    advice: 'Considere remover do cardápio ou reposicionar.',
  },
};

function getQuadrant(
  item: { total_sold: number; avg_margin: number },
  avgSalesCut: number,
  avgMarginCut: number
): Quadrant {
  const highSales = item.total_sold >= avgSalesCut;
  const highMargin = item.avg_margin >= avgMarginCut;
  if (highSales && highMargin) return 'estrela';
  if (highSales && !highMargin) return 'burro';
  if (!highSales && highMargin) return 'quebra_cabeca';
  return 'cao';
}

interface MenuMatrixBCGProps {
  menuMatrix: DashboardMenuMatrix | null | undefined;
  currency?: CurrencyCode;
}

export interface ScatterPoint extends DashboardMenuMatrixItem {
  quadrant: Quadrant;
}

function BCGTooltipContent({
  payload,
  currency = 'BRL',
}: {
  payload?: Array<{ payload: ScatterPoint }>;
  currency?: CurrencyCode;
}) {
  const point = payload?.[0]?.payload;
  if (!point) return null;
  const info = QUADRANT_INFO[point.quadrant];
  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg min-w-[200px]">
      <p className="font-semibold text-slate-900">{point.name}</p>
      <p className="text-sm text-slate-600 mt-0.5">
        Vendas: {point.total_sold} un. · Margem: {formatCurrency(point.avg_margin, currency)}
      </p>
      <p className="text-xs font-medium mt-2" style={{ color: info.color }}>
        {info.label}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{info.advice}</p>
    </div>
  );
}

export function MenuMatrixBCG({ menuMatrix, currency = 'BRL' }: MenuMatrixBCGProps) {
  const { byQuadrant, avgSalesCut, avgMarginCut } = useMemo(() => {
    const items = menuMatrix?.items ?? [];
    const cutSales = menuMatrix?.avg_sales_cut ?? 0;
    const cutMargin = menuMatrix?.avg_margin_cut ?? 0;
    const scatterData: ScatterPoint[] = items.map((item) => ({
      ...item,
      quadrant: getQuadrant(item, cutSales, cutMargin),
    }));
    const byQuadrant: Record<Quadrant, ScatterPoint[]> = {
      estrela: scatterData.filter((p) => p.quadrant === 'estrela'),
      burro: scatterData.filter((p) => p.quadrant === 'burro'),
      quebra_cabeca: scatterData.filter((p) => p.quadrant === 'quebra_cabeca'),
      cao: scatterData.filter((p) => p.quadrant === 'cao'),
    };
    return { byQuadrant, avgSalesCut: cutSales, avgMarginCut: cutMargin };
  }, [menuMatrix]);

  const allData = useMemo(
    () => Object.values(byQuadrant).flat(),
    [byQuadrant]
  );

  if (!allData.length) {
    return (
      <div className="flex items-center justify-center h-[320px] text-slate-500">
        <p>Sem dados do cardápio no período</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[320px] min-w-0">
      <ResponsiveContainer width="100%" height={320} minWidth={0}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            dataKey="total_sold"
            name="Volume de Vendas"
            unit=" un"
            stroke="#888"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            type="number"
            dataKey="avg_margin"
            name="Margem"
            stroke="#888"
            style={{ fontSize: '12px' }}
            tickFormatter={(v) => formatCurrency(v, currency)}
          />
          <Tooltip
            content={<BCGTooltipContent currency={currency} />}
            cursor={{ strokeDasharray: '3 3' }}
          />
          <ReferenceLine
            x={avgSalesCut}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <ReferenceLine
            y={avgMarginCut}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          {(Object.keys(QUADRANT_INFO) as Quadrant[]).map((q) => (
            <Scatter
              key={q}
              data={byQuadrant[q]}
              fill={QUADRANT_INFO[q].color}
              name={QUADRANT_INFO[q].label}
              shape="circle"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center mt-3 text-xs">
        {Object.entries(QUADRANT_INFO).map(([key, info]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: info.color }}
            />
            <span className="text-slate-600">{info.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
