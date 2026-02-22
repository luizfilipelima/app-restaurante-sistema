import { useState, useEffect, useCallback } from 'react';
import { convertBetweenCurrencies, type CurrencyCode, type ExchangeRates } from '@/lib/priceHelper';
import { formatCurrency } from '@/lib/utils';

interface RestaurantLike {
  id?: string;
  currency?: string;
  payment_currencies?: string[] | null;
  exchange_rates?: ExchangeRates | null;
}

const VALID_CURRENCIES = ['BRL', 'PYG', 'ARS', 'USD'] as const;
const STORAGE_KEY_PREFIX = 'menu_display_currency_';

function getBaseCurrency(restaurant: RestaurantLike | null): CurrencyCode {
  if (!restaurant?.currency) return 'BRL';
  return VALID_CURRENCIES.includes(restaurant.currency as CurrencyCode)
    ? (restaurant.currency as CurrencyCode)
    : 'BRL';
}

function getPaymentCurrencies(restaurant: RestaurantLike | null, baseCurrency: CurrencyCode): CurrencyCode[] {
  const arr = restaurant && Array.isArray(restaurant.payment_currencies) && restaurant.payment_currencies.length > 0
    ? restaurant.payment_currencies
    : [baseCurrency];
  return arr.filter((c): c is CurrencyCode => VALID_CURRENCIES.includes(c as CurrencyCode));
}

/**
 * Hook para gerenciar moeda de exibição no cardápio.
 * Persiste a preferência por restaurante no localStorage.
 * Retorna displayCurrency e helpers para conversão/formatação.
 */
export function useMenuCurrency(restaurant: RestaurantLike | null) {
  const baseCurrency = getBaseCurrency(restaurant);
  const paymentCurrencies = getPaymentCurrencies(restaurant, baseCurrency);
  const exchangeRates: ExchangeRates = restaurant?.exchange_rates ?? { pyg_per_brl: 3600, ars_per_brl: 1150 };

  const storageKey = restaurant?.id ? `${STORAGE_KEY_PREFIX}${restaurant.id}` : null;
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(() => {
    if (!storageKey) return baseCurrency;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && paymentCurrencies.includes(saved as CurrencyCode)) return saved as CurrencyCode;
    } catch { /* ignore */ }
    return baseCurrency;
  });

  // Sincronizar ao mudar restaurante
  useEffect(() => {
    if (!storageKey) {
      setDisplayCurrencyState(baseCurrency);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey) as CurrencyCode | null;
      if (saved && paymentCurrencies.includes(saved)) {
        setDisplayCurrencyState(saved);
        return;
      }
    } catch { /* ignore */ }
    setDisplayCurrencyState(baseCurrency);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id, baseCurrency, storageKey]);

  const setDisplayCurrency = useCallback((c: CurrencyCode) => {
    if (!paymentCurrencies.includes(c)) return;
    setDisplayCurrencyState(c);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, c);
      } catch { /* ignore */ }
    }
  }, [paymentCurrencies, storageKey]);

  const convertForDisplay = useCallback(
    (value: number) =>
      displayCurrency === baseCurrency
        ? value
        : convertBetweenCurrencies(value, baseCurrency, displayCurrency, exchangeRates),
    [displayCurrency, baseCurrency, exchangeRates]
  );

  const formatForDisplay = useCallback(
    (value: number) => formatCurrency(convertForDisplay(value), displayCurrency),
    [displayCurrency, convertForDisplay]
  );

  const hasMultipleCurrencies = paymentCurrencies.length > 1;
  const effectiveDisplayCurrency = paymentCurrencies.includes(displayCurrency)
    ? displayCurrency
    : baseCurrency;

  return {
    baseCurrency,
    displayCurrency: effectiveDisplayCurrency,
    setDisplayCurrency,
    paymentCurrencies,
    hasMultipleCurrencies,
    convertForDisplay,
    formatForDisplay,
    exchangeRates,
  };
}
