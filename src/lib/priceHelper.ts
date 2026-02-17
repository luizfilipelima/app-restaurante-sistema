/**
 * Utilitário para formatação e conversão de preços
 * 
 * Estratégia de armazenamento no banco:
 * - BRL (Real): valor em centavos (ex: 2500 = R$ 25,00)
 * - PYG (Guaraní): valor inteiro (ex: 25000 = Gs. 25.000)
 */

export type CurrencyCode = 'BRL' | 'PYG';

/**
 * Formata um valor numérico do banco de dados para exibição na moeda informada.
 * 
 * @param value - Valor armazenado no banco (centavos para BRL, inteiro para PYG)
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns String formatada com símbolo da moeda
 */
export function formatPrice(value: number, currency: CurrencyCode): string {
  if (currency === 'PYG') {
    // Guaraní: valor já é inteiro, formata com ponto como separador de milhar
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
 * @param inputValue - Valor digitado pelo usuário (ex: "25.00" ou "25000")
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns Número inteiro pronto para salvar no banco
 */
export function convertPriceToStorage(inputValue: string | number, currency: CurrencyCode): number {
  const numValue = typeof inputValue === 'string' 
    ? parseFloat(inputValue.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
    : inputValue;

  if (currency === 'PYG') {
    // Guaraní: salva o valor inteiro como digitado
    return Math.round(numValue);
  }

  // Real: multiplica por 100 para converter reais em centavos
  return Math.round(numValue * 100);
}

/**
 * Converte um valor do banco de dados para o formato de edição (exibição no input).
 * 
 * @param storageValue - Valor armazenado no banco
 * @param currency - Moeda do restaurante ('BRL' ou 'PYG')
 * @returns String formatada para exibição no input (sem símbolo de moeda)
 */
export function convertPriceFromStorage(storageValue: number, currency: CurrencyCode): string {
  if (currency === 'PYG') {
    // Guaraní: retorna o valor inteiro formatado com ponto como separador de milhar
    return new Intl.NumberFormat('es-PY', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(storageValue);
  }

  // Real: divide por 100 e formata com vírgula decimal
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(storageValue / 100);
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
