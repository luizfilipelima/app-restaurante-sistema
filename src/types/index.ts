// ==================== ENUMS ====================

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  RESTAURANT_ADMIN = 'restaurant_admin',
  KITCHEN = 'kitchen',
}

export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  PIX = 'pix',
  CARD = 'card',
  CASH = 'cash',
  /** Pedido de mesa: cliente paga posteriormente no local */
  TABLE = 'table',
  /** QR Code na entrega */
  QRCODE = 'qrcode',
  /** Transferência bancária */
  BANK_TRANSFER = 'bank_transfer',
}

export enum DeliveryType {
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
}

/** Origem do pedido para BI e filtros */
export type OrderSource = 'delivery' | 'pickup' | 'table' | 'buffet' | 'comanda';

export enum ProductCategory {
  PIZZA = 'pizza',
  BURGER = 'burger',
  PASTA = 'pasta',
  DRINKS = 'drinks',
  DESSERTS = 'desserts',
  APPETIZERS = 'appetizers',
}

// ==================== DATABASE TYPES ====================

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface OpeningHoursSlot {
  open: string;
  close: string;
}

export type PhoneCountry = 'BR' | 'PY' | 'AR';

export type CourierStatus = 'available' | 'busy' | 'offline';

export interface Courier {
  id: string;
  restaurant_id: string;
  name: string;
  phone?: string;
  /** País do número de telefone: BR, PY ou AR */
  phone_country?: 'BR' | 'PY' | 'AR' | null;
  status: CourierStatus;
  vehicle_plate?: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

/** Largura do papel para cupom térmico */
export type PrintPaperWidth = '58mm' | '80mm';

/** Config de impressão por setor (delivery, table, pickup, buffet) */
export interface SectorPrintSettings {
  waiter_tip_enabled: boolean;
  waiter_tip_pct: number;
}

export type PrintSettingsBySector = Partial<
  Record<'delivery' | 'table' | 'pickup' | 'buffet', SectorPrintSettings>
>;

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  phone: string;
  whatsapp: string;
  /** País do número de telefone/WhatsApp: BR ou PY */
  phone_country?: PhoneCountry;
  instagram_url?: string;
  is_active: boolean;
  opening_hours?: Record<DayKey, OpeningHoursSlot | null>;
  is_manually_closed?: boolean;
  /** Se true, considerado aberto 24h (ignora horários por dia) */
  always_open?: boolean;
  /** Impressão automática ao receber novo pedido */
  print_auto_on_new_order?: boolean;
  /** Largura do papel: 58mm ou 80mm */
  print_paper_width?: PrintPaperWidth;
  /** Config de impressão por setor: { delivery, table, pickup, buffet } */
  print_settings_by_sector?: PrintSettingsBySector;
  /** Moeda de exibição dos valores no cardápio */
  currency?: 'BRL' | 'PYG' | 'ARS' | 'USD';
  /** Cotações para conversão: unidades por 1 BRL (ex: pyg_per_brl: 3600) */
  exchange_rates?: { pyg_per_brl?: number; ars_per_brl?: number } | null;
  /** Moedas disponíveis no alternador de pagamento no checkout */
  payment_currencies?: string[] | null;
  /** Chave PIX do restaurante — onde o cliente envia o pagamento */
  pix_key?: string | null;
  /** Dados bancários para transferência (PYG/ARS): {bank_name, agency, account, holder} */
  bank_account?: { bank_name?: string; agency?: string; account?: string; holder?: string } | null;
  /** Idioma da interface do cardápio público */
  language?: 'pt' | 'es' | 'en';
  /** Templates personalizáveis de mensagens WhatsApp */
  whatsapp_templates?: WhatsAppTemplates | null;
  created_at: string;
  updated_at: string;
}

/** Templates de mensagens WhatsApp configuráveis por restaurante */
export interface WhatsAppTemplates {
  /** Mensagem enviada ao restaurante quando o cliente faz um pedido no Checkout */
  new_order?: string;
  /** Mensagem enviada ao cliente quando o pedido sai para entrega */
  delivery_notification?: string;
  /** Mensagem enviada ao entregador quando despachado */
  courier_dispatch?: string;
}

export interface User {
  id: string;
  email: string;
  /** Login/usuário opcional para entrar no sistema (além do email) */
  login?: string | null;
  role: UserRole;
  restaurant_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description?: string;
  price: number;
  price_sale?: number; // Preço de venda (para buffet)
  price_cost?: number; // Custo do produto (para cálculo de CMV)
  /** Moeda do custo: BRL, PYG ou ARS. Null usa moeda base do restaurante */
  cost_currency?: 'BRL' | 'PYG' | 'ARS' | null;
  image_url?: string;
  is_pizza: boolean;
  is_marmita?: boolean;
  is_by_weight?: boolean; // Se true, produto vendido por peso (buffet)
  sku?: string; // Código SKU do produto
  is_active: boolean;
  /** Ordem de exibição dentro da categoria (admin e cardápio público) */
  order_index?: number;
  /** Subcategoria opcional (ex: agrupamento dentro da categoria) */
  subcategory_id?: string | null;
  /** Destino de impressão do cupom por produto: 'kitchen' = Cozinha Central | 'bar' = Garçom/Bar */
  print_destination?: 'kitchen' | 'bar' | null;
  /** Se true, produto é um combo; composição em product_combo_items */
  is_combo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PizzaSize {
  id: string;
  restaurant_id: string;
  name: string; // Ex: Pequena, Média, Grande
  max_flavors: number; // Quantos sabores permite
  price_multiplier: number; // Multiplicador de preço (ex: 1.0, 1.5, 2.0)
  order_index: number;
  created_at: string;
}

export interface PizzaFlavor {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface PizzaDough {
  id: string;
  restaurant_id: string;
  name: string; // Ex: Tradicional, Integral, Sem Glúten
  extra_price: number;
  is_active: boolean;
  created_at: string;
}

export interface PizzaEdge {
  id: string;
  restaurant_id: string;
  name: string; // Ex: Catupiry, Cheddar, Chocolate
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface MarmitaSize {
  id: string;
  restaurant_id: string;
  name: string; // Ex: 300g, 500g, 700g
  weight_grams: number; // Peso em gramas
  base_price: number; // Preço base
  price_per_gram: number; // Preço por grama (opcional)
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface MarmitaProtein {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  price_per_gram: number; // Preço por grama da proteína
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

/** Grupo de adicionais do produto (ex: Borda, Extras) */
export interface ProductAddonGroup {
  id: string;
  product_id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/** Item de adicional (ex: Borda Catupiry +R$5) */
export interface ProductAddonItem {
  id: string;
  addon_group_id: string;
  name: string;
  price: number;
  cost?: number;
  cost_currency?: 'BRL' | 'PYG' | 'ARS';
  in_stock: boolean;
  ingredient_id?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/** Dias da semana para oferta recorrente: mon, tue, wed, thu, fri, sat, sun. Null = oferta única. */
export type OfferRepeatDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ProductOffer {
  id: string;
  restaurant_id: string;
  product_id: string;
  offer_price: number;
  original_price: number;
  starts_at: string;
  ends_at: string;
  label?: string | null;
  /** Dias da semana em que a oferta repete. Null/vazio = oferta única */
  repeat_days?: OfferRepeatDay[] | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  product?: Product;
}

export interface ProductComboItem {
  id: string;
  combo_product_id: string;
  product_id: string;
  quantity: number;
  sort_order: number;
  created_at?: string;
  /** Populated via join — produto incluído no combo */
  product?: Product;
}

export interface MarmitaSide {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  price_per_gram: number; // Preço por grama do acompanhamento
  category?: string; // Ex: 'arroz', 'feijao', 'salada', 'legumes'
  is_active: boolean;
  created_at: string;
}

export interface ProductModifier {
  id: string;
  product_id: string;
  name: string;
  type: string; // Ex: 'size', 'extra', 'remove'
  price: number;
  created_at: string;
}

export interface DeliveryZone {
  id: string;
  restaurant_id: string;
  location_name: string;
  fee: number; // 0 para entrega grátis
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: DeliveryType;
  delivery_zone_id?: string;
  delivery_address?: string;
  /** Latitude do endereço de entrega */
  latitude?: number | null;
  /** Longitude do endereço de entrega */
  longitude?: number | null;
  /** Detalhes: Apto, Bloco, Referência */
  address_details?: string | null;
  delivery_fee: number;
  subtotal: number;
  total: number;
  payment_method: PaymentMethod;
  payment_change_for?: number; // Se pagamento em dinheiro, quanto o cliente vai pagar
  /** Chave PIX do cliente (quando pagamento PIX) */
  payment_pix_key?: string | null;
  /** Dados da conta bancária do cliente para transferência (PYG/ARS) */
  payment_bank_account?: { bank_name?: string; agency?: string; account?: string; holder?: string } | null;
  status: OrderStatus;
  notes?: string;
  is_paid: boolean; // Se pagamento foi confirmado (para priorização na cozinha)
  courier_id?: string | null;
  /** Origem do pedido: delivery, pickup, table, buffet, comanda */
  order_source?: OrderSource;
  /** Mesa associada (quando order_source = 'table') */
  table_id?: string | null;
  /** Comanda digital de origem (quando order_source = 'comanda') */
  virtual_comanda_id?: string | null;
  /** Pedido marcado como resgate de fidelidade */
  loyalty_redeemed?: boolean;
  /** Ponto de fidelidade já creditado para este pedido */
  loyalty_points_credited?: boolean;
  /** Idioma em que o cliente navegou no cardápio (pt/es). Usado para templates WhatsApp. */
  customer_language?: 'pt' | 'es' | null;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  restaurant_id: string;
  number: number;
  name?: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_id?: string | null;
  table_number: number;
  status: 'pending' | 'attended';
  created_at: string;
  attended_at?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  observations?: string;
  // Para pizzas
  pizza_size?: string;
  pizza_flavors?: string[]; // Array de nomes dos sabores
  pizza_dough?: string;
  pizza_edge?: string;
  /** Adicionais do produto (ex: Borda Catupiry +R$5) */
  addons?: Array<{ addonItemId?: string; name: string; price?: number }>;
  created_at: string;
}

// ==================== UI/APP TYPES ====================

export interface CartItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  observations?: string;
  /** Item adicionado via sugestão de upsell */
  isUpsell?: boolean;
  // Pizza específico
  isPizza?: boolean;
  pizzaSize?: string;
  pizzaFlavors?: string[];
  pizzaDough?: string;
  pizzaEdge?: string;
  pizzaEdgePrice?: number;
  pizzaDoughPrice?: number;
  // Marmita específico
  isMarmita?: boolean;
  marmitaSize?: string;
  marmitaWeight?: number;
  marmitaProteins?: string[];
  marmitaSides?: string[];
  /** Adicionais do produto (ex: Borda Catupiry +R$5) */
  addons?: Array<{ addonItemId: string; name: string; price: number }>;
}

export interface CheckoutData {
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  paymentMethod: PaymentMethod;
  paymentChangeFor?: number;
  notes?: string;
}

export interface DashboardMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  ordersToday: number;
  revenueToday: number;
  ordersByStatus: {
    pending: number;
    preparing: number;
    ready: number;
    delivering: number;
    completed: number;
  };
  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
  revenueByPaymentMethod: {
    method: PaymentMethod;
    total: number;
  }[];
  dailyRevenue: {
    date: string;
    revenue: number;
    orders: number;
  }[];
}

// ==================== SUPABASE RESPONSE TYPES ====================

export interface DatabaseOrder extends Order {
  delivery_zone?: DeliveryZone;
  order_items?: OrderItem[];
  courier?: Courier | null;
  /** Para pedidos de comanda: short_code da comanda (ex: CMD-A7F2) */
  virtual_comandas?: { short_code: string } | null;
}

export interface RestaurantWithMetrics extends Restaurant {
  total_orders?: number;
  total_revenue?: number;
  active_orders?: number;
}

// ==================== CATEGORIES TYPES ====================

/** Destino do cupom de impressão para a categoria */
export type PrintDestination = 'kitchen' | 'bar';

// ==================== LOYALTY ====================

export interface LoyaltyProgram {
  id?: string;
  restaurant_id: string;
  enabled: boolean;
  orders_required: number;
  reward_description: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoyaltyPoints {
  customer_phone: string;
  points: number;
  redeemed_count: number;
}

/** Resultado do RPC get_loyalty_points */
export interface LoyaltyStatus {
  points: number;
  redeemed_count: number;
  orders_required: number;
  reward_description: string;
  enabled: boolean;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  order_index: number;
  is_pizza?: boolean;
  is_marmita?: boolean;
  has_inventory?: boolean;
  extra_field?: string | null;
  extra_label?: string | null;
  extra_placeholder?: string | null;
  /** Destino de impressão: 'kitchen' = Cozinha Central | 'bar' = Garçom/Bar */
  print_destination?: PrintDestination;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// ==================== INVENTORY TYPES ====================

export type InventoryMovementType = 'sale' | 'restock' | 'adjustment' | 'loss' | 'return';

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  product_id: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  cost_price: number;
  sale_price: number;
  /** Moeda do custo: BRL, PYG ou ARS. Null usa moeda base do restaurante */
  cost_currency?: 'BRL' | 'PYG' | 'ARS' | null;
  expiry_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  order_id?: string | null;
  quantity_change: number;
  movement_type: InventoryMovementType;
  notes?: string | null;
  created_at: string;
}

// ==================== INGREDIENTS TYPES ====================

export interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  cost_currency?: 'BRL' | 'PYG' | 'ARS' | null;
  sku?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientStock {
  id: string;
  ingredient_id: string;
  quantity: number;
  min_quantity: number;
  expiry_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientMovement {
  id: string;
  ingredient_stock_id: string;
  order_id?: string | null;
  product_id?: string | null;
  quantity_change: number;
  movement_type: InventoryMovementType;
  notes?: string | null;
  created_at: string;
}

export interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
  unit: string;
  notes?: string | null;
  created_at: string;
  /** Populated via join */
  ingredient?: Ingredient;
}

// ==================== BUFFET COMANDAS TYPES ====================

export type ComandaStatus = 'open' | 'closed';

export interface Comanda {
  id: string;
  restaurant_id: string;
  number: number;
  status: ComandaStatus;
  total_amount: number;
  opened_at: string;
  closed_at?: string;
  last_sync?: string;
  created_at: string;
  updated_at: string;
}

export interface ComandaItem {
  id: string;
  comanda_id: string;
  product_id?: string | null;
  description: string;
  quantity: number; // Pode ser decimal para peso (ex: 0.350 para 350g)
  unit_price: number;
  total_price: number;
  is_pending_sync?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComandaWithItems extends Comanda {
  items?: ComandaItem[];
}
