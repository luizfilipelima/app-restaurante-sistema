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

export type CurrencyCode = 'BRL' | 'PYG';

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
    // Guaraní: formato nativo com ponto para milhares (ex: Gs. 25.000)
    return `Gs. ${formatIntegerWithDotsPyG(Number(value))}`;
  }

  // Real: divide por 100 para converter centavos em reais
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
    // PYG: remover pontos (milhares), trocar vírgula por ponto (decimal), depois arredondar
    const normalized = String(inputValue).replace(/\./g, '').replace(',', '.');
    const numValue = parseFloat(normalized) || 0;
    return Math.round(numValue);
  }

  const numValue =
    typeof inputValue === 'string'
      ? parseFloat(inputValue.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      : inputValue;
  // Real: multiplica por 100 para converter reais em centavos
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
  return new Intl.NumberFormat('pt-BR', {
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

/**
 * Obtém o símbolo da moeda para uso em labels e placeholders.
 * 
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns Símbolo da moeda ('R$' ou 'Gs.')
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  return currency === 'PYG' ? 'Gs.' : 'R$';
}
