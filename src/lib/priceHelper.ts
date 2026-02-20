/**
 * Utilitário para formatação e conversão de preços
 *
 * Estratégia de armazenamento no banco:
 * - BRL (Real): valor em centavos (ex: 2500 = R$ 25,00)
 * - PYG (Guaraní): valor inteiro (ex: 25000 = Gs. 25.000)
 *
 * Formato nativo Guaraní: ponto (.) para milhares, vírgula (,) para decimais.
 * Ex.: Gs. 25.000 ou Gs. 25.000,50
 */

export type CurrencyCode = 'BRL' | 'PYG' | 'ARS' | 'USD';

/** Alias para moeda de custo (compatível com CurrencyCode) */
export type CostCurrencyCode = CurrencyCode;

/** Formata inteiro com ponto como separador de milhar (formato Paraguai). */
function formatIntegerWithDotsPyG(n: number): string {
  const s = Math.round(Math.max(0, n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata um valor numérico do banco de dados para exibição na moeda informada.
 *
 * @param value - Valor armazenado no banco (centavos para BRL, inteiro para PYG)
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns String formatada com símbolo da moeda
 */
export function formatPrice(value: number, currency: CurrencyCode): string {
  if (currency === 'PYG') {
    return `Gs. ${formatIntegerWithDotsPyG(Number(value))}`;
  }
  if (currency === 'ARS') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  // BRL default
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/**
 * Converte um valor digitado pelo usuário para o formato de armazenamento no banco.
 *
 * Para PYG aceita formato nativo: ponto como milhar e vírgula como decimal (ex: "25.000" ou "25.000,50").
 *
 * @param inputValue - Valor digitado (ex: "25.000", "25.000,50" para PYG; "25,00" para BRL)
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns Número inteiro pronto para salvar no banco
 */
export function convertPriceToStorage(inputValue: string | number, currency: CurrencyCode): number {
  if (currency === 'PYG') {
    if (typeof inputValue === 'number') return Math.round(inputValue);
    const normalized = String(inputValue).replace(/\./g, '').replace(',', '.');
    const numValue = parseFloat(normalized) || 0;
    return Math.round(numValue);
  }
  // BRL, ARS, USD: centavos
  const numValue =
    typeof inputValue === 'string'
      ? parseFloat(inputValue.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      : inputValue;
  return Math.round(numValue * 100);
}

/**
 * Converte um valor do banco de dados para o formato de edição (exibição no input).
 *
 * PYG: formato nativo com ponto para milhares (ex: "25.000").
 *
 * @param storageValue - Valor armazenado no banco
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns String formatada para exibição no input (sem símbolo de moeda)
 */
export function convertPriceFromStorage(storageValue: number, currency: CurrencyCode): string {
  if (currency === 'PYG') {
    return formatIntegerWithDotsPyG(Number(storageValue));
  }
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(storageValue / 100);
}

/**
 * Formata o valor do campo de preço em Guaraní enquanto o usuário digita:
 * apenas dígitos e uma vírgula (decimal); insere ponto como separador de milhar.
 * Ex.: "25000" → "25.000", "25000,50" → "25.000,50"
 *
 * @param displayValue - Valor atual do input (pode já conter pontos e vírgula)
 * @returns Valor formatado para exibição no input
 */
export function formatPriceInputPyG(displayValue: string): string {
  const onlyDigitsAndComma = displayValue.replace(/[^\d,]/g, '');
  const firstComma = onlyDigitsAndComma.indexOf(',');
  const hasComma = firstComma !== -1;
  const intPart = hasComma ? onlyDigitsAndComma.slice(0, firstComma) : onlyDigitsAndComma;
  const decPart = hasComma ? onlyDigitsAndComma.slice(firstComma + 1).replace(/\D/g, '') : '';
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${intFormatted},${decPart}` : intFormatted;
}

/** Cotações por 1 BRL (ex: pyg_per_brl: 3600, ars_per_brl: 1150) */
export interface ExchangeRates {
  pyg_per_brl?: number;
  ars_per_brl?: number;
}

/**
 * Converte valor entre moedas usando as cotações (base: 1 BRL).
 * BRL/ARS/USD: armazenados em centavos. PYG: inteiro.
 *
 * @param value - Valor no formato de armazenamento da moeda de origem
 * @param from - Moeda de origem
 * @param to - Moeda de destino
 * @param rates - Cotações (ex: pyg_per_brl, ars_per_brl)
 */
export function convertBetweenCurrencies(
  value: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates
): number {
  if (from === to) return value;
  const pyg = rates.pyg_per_brl ?? 3600;
  const ars = rates.ars_per_brl ?? 1150;

  // Converter tudo para BRL (centavos) como intermediário
  let brlCentavos: number;
  if (from === 'BRL') brlCentavos = value;
  else if (from === 'PYG') brlCentavos = Math.round((value / pyg) * 100);
  else if (from === 'ARS') brlCentavos = Math.round((value / ars) * 100);
  else brlCentavos = value; // USD: sem cotação, mantém

  // BRL (centavos) -> destino
  if (to === 'BRL') return brlCentavos;
  if (to === 'PYG') return Math.round((brlCentavos / 100) * pyg);
  if (to === 'ARS') return Math.round((brlCentavos / 100) * ars * 100); // ARS em centavos
  return brlCentavos;
}

/**
 * Obtém o símbolo da moeda para uso em labels e placeholders.
 * 
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns Símbolo da moeda ('R$' ou 'Gs.')
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  switch (currency) {
    case 'PYG': return 'Gs.';
    case 'ARS': return '$';
    case 'USD': return 'US$';
    default:    return 'R$';
  }
}
