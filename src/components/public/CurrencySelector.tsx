/**
 * Seletor compacto de moeda para o cardápio.
 * Exibe apenas quando o restaurante aceita múltiplas moedas.
 */
import { memo } from 'react';
import { type CurrencyCode } from '@/lib/priceHelper';

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BRL: 'BRL',
  PYG: 'PYG',
  ARS: 'ARS',
  USD: 'USD',
};

interface CurrencySelectorProps {
  value: CurrencyCode;
  options: CurrencyCode[];
  onChange: (c: CurrencyCode) => void;
  baseCurrency: CurrencyCode;
  className?: string;
}

function CurrencySelector({ value, options, onChange, baseCurrency, className = '' }: CurrencySelectorProps) {
  if (options.length <= 1) return null;

  return (
    <div
      className={`flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg ${className}`}
      role="group"
      aria-label="Selecionar moeda"
    >
      {options.map((c) => {
        const isSelected = value === c;
        const isBase = c === baseCurrency;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={isBase ? `${CURRENCY_LABELS[c]} (moeda do restaurante)` : `Ver preços em ${CURRENCY_LABELS[c]}`}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all touch-manipulation min-w-[36px] ${
              isSelected
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {CURRENCY_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}

export default memo(CurrencySelector);
