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
}

export enum DeliveryType {
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
}

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

export type PhoneCountry = 'BR' | 'PY';

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
  primary_color?: string;
  secondary_color?: string;
  is_active: boolean;
  opening_hours?: Record<DayKey, OpeningHoursSlot | null>;
  is_manually_closed?: boolean;
  created_at: string;
  updated_at: string;
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
  image_url?: string;
  is_pizza: boolean;
  is_active: boolean;
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
  delivery_fee: number;
  subtotal: number;
  total: number;
  payment_method: PaymentMethod;
  payment_change_for?: number; // Se pagamento em dinheiro, quanto o cliente vai pagar
  status: OrderStatus;
  notes?: string;
  is_paid: boolean; // Se pagamento foi confirmado (para priorização na cozinha)
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

// ==================== UI/APP TYPES ====================

export interface CartItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  observations?: string;
  // Pizza específico
  isPizza?: boolean;
  pizzaSize?: string;
  pizzaFlavors?: string[];
  pizzaDough?: string;
  pizzaEdge?: string;
  pizzaEdgePrice?: number;
  pizzaDoughPrice?: number;
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
}

export interface RestaurantWithMetrics extends Restaurant {
  total_orders?: number;
  total_revenue?: number;
  active_orders?: number;
}
