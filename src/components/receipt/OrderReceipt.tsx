import { DatabaseOrder } from '@/types';
import type { PrintSettingsBySector } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SEP = '--------------------------------';

/** Determina o setor do pedido para aplicar config de impressão. */
function getOrderSector(order: DatabaseOrder): 'delivery' | 'table' | 'pickup' | 'buffet' {
  const src = order.order_source;
  if (src === 'table') return 'table';
  if (src === 'buffet') return 'buffet';
  if (src === 'delivery' || order.delivery_type === 'delivery') return 'delivery';
  if (src === 'pickup' || order.delivery_type === 'pickup') return 'pickup';
  return 'table'; // default para mesa quando não há order_source
}

export interface OrderReceiptData {
  order: DatabaseOrder;
  restaurantName: string;
  paperWidth: '58mm' | '80mm';
  currency?: CurrencyCode;
  /** Config de impressão por setor (taxa de garçom). */
  sectorPrintSettings?: PrintSettingsBySector;
  /** Título do destino (ex: "COZINHA CENTRAL"). Quando definido, exibe cabeçalho de destino. */
  destinationLabel?: string;
  /** IDs dos itens a exibir neste cupom. Quando vazio/undefined exibe todos. */
  filteredItemIds?: string[];
}

interface OrderReceiptProps {
  data: OrderReceiptData | null;
  /** Classe do container para impressão (ex: receipt-print-area) */
  className?: string;
}

export function OrderReceipt({ data, className = 'receipt-print-area' }: OrderReceiptProps) {
  if (!data) {
    return <div className={className} aria-hidden />;
  }

  const { order, restaurantName, paperWidth, currency = 'BRL', sectorPrintSettings, destinationLabel, filteredItemIds } = data;
  const allItems = order.order_items ?? [];
  const items = filteredItemIds && filteredItemIds.length > 0
    ? allItems.filter((it) => filteredItemIds.includes(it.id))
    : allItems;
  const subtotal = Number(order.subtotal);
  const deliveryFee = Number(order.delivery_fee ?? 0);
  let total = Number(order.total);

  const sector = getOrderSector(order);
  const sectorConfig = sectorPrintSettings?.[sector];
  const waiterTipEnabled = !!sectorConfig?.waiter_tip_enabled;
  const waiterTipPct = Math.max(0, Math.min(100, Number(sectorConfig?.waiter_tip_pct) || 10));
  const waiterTipAmount = waiterTipEnabled
    ? Math.round(subtotal * (waiterTipPct / 100))
    : 0;
  if (waiterTipAmount > 0) total += waiterTipAmount;
  const zoneName = order.delivery_zone?.location_name;
  const paymentLabel =
    order.payment_method === 'table' || order.order_source === 'table' || order.table_id
      ? 'Pagar na mesa'
      : order.payment_method === 'pix'
        ? 'PIX'
        : order.payment_method === 'card'
          ? 'Cartão'
          : order.payment_method === 'qrcode'
            ? 'QR Code'
            : order.payment_method === 'bank_transfer'
              ? 'Transferência'
              : 'Dinheiro';

  const widthClass = paperWidth === '58mm' ? 'receipt-width-58' : 'receipt-width-80';

  return (
    <div
      className={`receipt-root ${widthClass} ${className}`}
      data-receipt
      role="document"
      aria-label="Cupom do pedido"
    >
      <div className="receipt-inner">
        <header className="receipt-header">
          <h1 className="receipt-title">{restaurantName}</h1>
          {destinationLabel && (
            <div className="receipt-destination-label">{destinationLabel}</div>
          )}
        </header>

        <div className="receipt-line">{SEP}</div>

        <section className="receipt-section">
          <div className="receipt-row">
            <strong>Cliente:</strong> {order.customer_name}
          </div>
          <div className="receipt-row">
            <strong>Tel:</strong> {order.customer_phone}
          </div>
          <div className="receipt-row">
            <strong>Entrega:</strong>{' '}
            {order.delivery_type === 'delivery' ? `Delivery${zoneName ? ` - ${zoneName}` : ''}` : 'Retirada'}
          </div>
          {order.delivery_address && (
            <div className="receipt-row receipt-address">{order.delivery_address}</div>
          )}
          <div className="receipt-row">
            <strong>Pagamento:</strong> {paymentLabel}
            {order.payment_method === 'cash' && order.payment_change_for != null && paymentLabel === 'Dinheiro' && (
              <> (Troco p/ {formatCurrency(Number(order.payment_change_for), currency)})</>
            )}
          </div>
          <div className="receipt-row receipt-date">
            {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </section>

        <div className="receipt-line">{SEP}</div>

        <section className="receipt-section">
          <div className="receipt-row receipt-row-header">
            <span>Qtd</span>
            <span>Item</span>
            <span>Total</span>
          </div>
          {items.map((item) => {
            const addons = (item as { addons?: Array<{ name: string; price?: number }> }).addons;
            const addonsStr = addons && Array.isArray(addons) && addons.length > 0
              ? ' + ' + addons.map((a) => a.name).join(', ')
              : '';
            return (
              <div key={item.id} className="receipt-row receipt-row-item">
                <span>{item.quantity}x</span>
                <span className="receipt-item-name">
                  {item.product_name}{addonsStr}
                  {item.observations ? ` (${item.observations})` : ''}
                </span>
                <span>{formatCurrency(Number(item.total_price), currency)}</span>
              </div>
            );
          })}
        </section>

        <div className="receipt-line">{SEP}</div>

        <section className="receipt-section receipt-totals">
          <div className="receipt-row">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="receipt-row">
              <span>Taxa de entrega</span>
              <span>{formatCurrency(deliveryFee, currency)}</span>
            </div>
          )}
          {waiterTipAmount > 0 && (
            <div className="receipt-row">
              <span>Taxa de garçom ({waiterTipPct}%)</span>
              <span>{formatCurrency(waiterTipAmount, currency)}</span>
            </div>
          )}
          <div className="receipt-row receipt-total">
            <span>TOTAL</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </section>

        {order.notes && (
          <>
            <div className="receipt-line">{SEP}</div>
            <div className="receipt-row receipt-obs">
              <strong>Obs:</strong> {order.notes}
            </div>
          </>
        )}

        <div className="receipt-line">{SEP}</div>

        <footer className="receipt-footer">
          <div className="receipt-row">Sistema Quiero - Pedido #{order.id.slice(0, 8).toUpperCase()}</div>
        </footer>
      </div>
    </div>
  );
}
