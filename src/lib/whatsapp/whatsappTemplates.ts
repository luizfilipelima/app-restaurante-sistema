/**
 * Sistema de Templates de Mensagens WhatsApp
 *
 * Templates usam a sintaxe {{variavel}}.
 * Linhas que contenham apenas uma variável vazia são removidas automaticamente,
 * o que implementa condicionais de forma transparente para o usuário.
 */

// ─── Definição de variáveis por template ─────────────────────────────────────

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
  description: string;
}

export const TEMPLATE_VARS = {
  new_order: [
    { key: 'cliente_nome',       label: 'Nome do cliente',      example: 'João Silva',        description: 'Nome completo do cliente' },
    { key: 'cliente_telefone',   label: 'Telefone',             example: '+55 11 99999-9999', description: 'Número de WhatsApp do cliente' },
    { key: 'tipo_entrega',       label: 'Tipo de entrega',      example: 'Entrega',           description: 'Entrega ou Retirada' },
    { key: 'bairro',             label: 'Bairro / Região',      example: 'Centro',            description: 'Zona de entrega selecionada' },
    { key: 'endereco',           label: 'Endereço / Coords',    example: '-23.550520, -46.633308', description: 'Coordenadas GPS ou endereço' },
    { key: 'detalhes_endereco',  label: 'Detalhes do endereço', example: 'Apto 12, Bloco B',  description: 'Complemento do endereço' },
    { key: 'pagamento',          label: 'Pagamento',            example: 'PIX',               description: 'Método de pagamento' },
    { key: 'pagamento_detalhes', label: 'Detalhes do pagamento', example: 'Chave PIX: 11999999999', description: 'Chave PIX do cliente ou conta para transferência' },
    { key: 'pix_restaurante',    label: 'Chave PIX do restaurante', example: '11999999999',   description: 'Chave PIX onde o cliente deve enviar o pagamento' },
    { key: 'conta_restaurante',  label: 'Dados bancários do restaurante', example: 'Banco X - Ag 123 - Cc 456 - Titular Y', description: 'Conta para transferência bancária' },
    { key: 'troco',              label: 'Troco para',           example: 'R$ 50,00',          description: 'Valor do troco (dinheiro)' },
    { key: 'subtotal',           label: 'Subtotal',             example: 'R$ 38,90',          description: 'Subtotal do pedido' },
    { key: 'taxa_entrega',       label: 'Taxa de entrega',      example: 'Taxa entrega: R$ 5,00', description: 'Linha com a taxa de entrega' },
    { key: 'taxa_garcom',       label: 'Taxa de garçom',     example: 'Taxa garçom (10%): R$ 3,89', description: 'Linha com a taxa de garçom (quando ativa)' },
    { key: 'total',             label: 'Total',               example: 'R$ 43,90',          description: 'Total final do pedido' },
    { key: 'itens',              label: 'Itens do pedido',      example: '  • 2x Pizza Margherita — R$ 38,90', description: 'Lista formatada dos itens' },
    { key: 'observacoes',        label: 'Observações',          example: 'Sem cebola',        description: 'Obs gerais do pedido' },
  ] as TemplateVariable[],

  delivery_notification: [
    { key: 'cliente_nome',      label: 'Primeiro nome',    example: 'João',                description: 'Primeiro nome do cliente' },
    { key: 'restaurante_nome',  label: 'Nome do restaurante', example: 'Pizzaria da Vitória', description: 'Nome do restaurante' },
  ] as TemplateVariable[],

  courier_dispatch: [
    { key: 'codigo_pedido',     label: 'Código do pedido',     example: '#F8737EBC',          description: 'Código único do pedido (ex: #F8737EBC)' },
    { key: 'cliente_nome',      label: 'Nome do cliente',      example: 'João Silva',        description: 'Nome completo do cliente' },
    { key: 'cliente_telefone',  label: 'WhatsApp do cliente',  example: '+55 11 99999-9999',  description: 'Número de WhatsApp do cliente' },
    { key: 'detalhes_endereco', label: 'Detalhes do endereço', example: 'Apto 12, Bloco B',  description: 'Complemento/referência do endereço' },
    { key: 'endereco',          label: 'Endereço / Coords',    example: '-23.550520, -46.633308', description: 'Coordenadas GPS do endereço' },
    { key: 'mapa',              label: 'Link do mapa',         example: 'https://maps.google.com/?q=-23.55,-46.63', description: 'Link do Google Maps' },
    { key: 'restaurante_nome',  label: 'Nome do restaurante',  example: 'Pizzaria da Vitória', description: 'Nome do restaurante' },
    { key: 'itens',             label: 'Itens do pedido',      example: '  • 2x Pizza — R$ 38,90', description: 'Lista resumida dos itens' },
    { key: 'subtotal',          label: 'Subtotal',             example: 'R$ 38,90',           description: 'Subtotal do pedido (sem taxa)' },
    { key: 'taxa_entrega',      label: 'Taxa de entrega',      example: 'R$ 5,00',            description: 'Valor da taxa de entrega' },
    { key: 'total',             label: 'Total do pedido',      example: 'R$ 43,90',           description: 'Valor total completo do pedido' },
  ] as TemplateVariable[],
} as const;

// ─── Templates padrão ─────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES = {
  new_order:
`🆕 *NOVO PEDIDO*

👤 *Cliente:* {{cliente_nome}}
📱 *Tel/WhatsApp:* {{cliente_telefone}}
🚚 *Entrega:* {{tipo_entrega}}
🏘️ *Bairro/Região:* {{bairro}}
📍 *Endereço:* {{endereco}}
📋 *Detalhes:* {{detalhes_endereco}}

💳 *Pagamento:* {{pagamento}}
{{pagamento_detalhes}}
🔄 *Troco para:* {{troco}}

📋 *Resumo:*
  Subtotal: {{subtotal}}
  {{taxa_entrega}}
  {{taxa_garcom}}
  *Total: {{total}}*

🍽️ *Itens:*
{{itens}}
📝 *Obs:* {{observacoes}}`,

  delivery_notification:
`Olá {{cliente_nome}}! 🛵 Seu pedido acabou de sair para entrega. Em breve estará na sua porta! 😊`,

  courier_dispatch:
`🛵 *Novo pedido para entrega*

*Pedido:* {{codigo_pedido}}
*Cliente:* {{cliente_nome}}
*WhatsApp:* {{cliente_telefone}}

*Valores:*
  Subtotal: {{subtotal}}
  Taxa entrega: {{taxa_entrega}}
  *Total: {{total}}*

*Detalhes da Entrega:* {{detalhes_endereco}}
*Google Maps:* {{mapa}}
*Itens:*
{{itens}}`,
} as const;

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

/** Templates padrão em espanhol (para clientes que navegaram em ES). */
export const DEFAULT_TEMPLATES_ES = {
  new_order:
`🆕 *NUEVO PEDIDO*

👤 *Cliente:* {{cliente_nome}}
📱 *Tel/WhatsApp:* {{cliente_telefone}}
🚚 *Entrega:* {{tipo_entrega}}
🏘️ *Barrio/Región:* {{bairro}}
📍 *Dirección:* {{endereco}}
📋 *Detalles:* {{detalhes_endereco}}

💳 *Pago:* {{pagamento}}
{{pagamento_detalhes}}
🔄 *Cambio para:* {{troco}}

📋 *Resumen:*
  Subtotal: {{subtotal}}
  {{taxa_entrega}}
  *Total: {{total}}*

🍽️ *Items:*
{{itens}}
📝 *Obs:* {{observacoes}}`,

  delivery_notification:
`¡Hola {{cliente_nome}}! 🛵 Tu pedido acaba de salir para entrega. ¡En breve estará en tu puerta! 😊`,

  courier_dispatch:
`🛵 *Nuevo pedido para entrega*

*Pedido:* {{codigo_pedido}}
*Cliente:* {{cliente_nome}}
*WhatsApp:* {{cliente_telefone}}

*Valores:*
  Subtotal: {{subtotal}}
  Taxa entrega: {{taxa_entrega}}
  *Total: {{total}}*

*Detalles de Entrega:* {{detalhes_endereco}}
*Google Maps:* {{mapa}}
*Items:*
{{itens}}`,
} as const;

export type MenuLanguage = 'pt' | 'es';

// ─── Processador de template ──────────────────────────────────────────────────

/**
 * Substitui variáveis `{{key}}` pelo valor correspondente.
 * Linhas que contenham APENAS uma variável cujo valor seja vazio
 * são removidas automaticamente (implementa condicionais de forma implícita).
 */
export function processTemplate(
  template: string,
  variables: Record<string, string | null | undefined>,
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const tag = `{{${key}}}`;
    if (value === null || value === undefined || value === '') {
      // Remove linhas que contêm apenas esta variável (com possível prefixo/sufixo)
      const lineRegex = new RegExp(`^[^\n]*\\{\\{${key}\\}\\}[^\n]*\n?`, 'gm');
      result = result.replace(lineRegex, '');
    } else {
      result = result.split(tag).join(value);
    }
  }

  // Limpa linhas em branco múltiplas consecutivas
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Retorna o template para a chave especificada:
 * usa o template salvo no restaurante se disponível,
 * caso contrário o padrão no idioma informado (pt | es).
 *
 * @param lang - Idioma do cliente/contexto ('pt' | 'es'). Usado quando não há template customizado.
 */
export function getTemplate(
  key: TemplateKey,
  templates?: { new_order?: string | null; delivery_notification?: string | null; courier_dispatch?: string | null } | null,
  lang: MenuLanguage = 'pt',
): string {
  if (templates && templates[key]) return templates[key]!;
  return lang === 'es' ? DEFAULT_TEMPLATES_ES[key] : DEFAULT_TEMPLATES[key];
}
