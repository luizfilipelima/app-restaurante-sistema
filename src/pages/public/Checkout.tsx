import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import {
  DeliveryZone,
  DeliveryType,
  PaymentMethod,
  OrderStatus,
  OrderItem,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, generateWhatsAppLink, formatPhone } from '@/lib/utils';
import { ArrowLeft, ShoppingBag, Bike, CreditCard } from 'lucide-react';

export default function PublicCheckout() {
  const { restaurantSlug } = useParams();
  const navigate = useNavigate();
  const { currentRestaurant } = useRestaurantStore();
  const { items, getSubtotal, clearCart } = useCartStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.DELIVERY);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [paymentChangeFor, setPaymentChangeFor] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentRestaurant) return;
    loadDeliveryZones();
  }, [currentRestaurant]);

  useEffect(() => {
    if (items.length === 0) {
      navigate(`/${restaurantSlug}`);
    }
  }, [items, restaurantSlug, navigate]);

  const loadDeliveryZones = async () => {
    if (!currentRestaurant) return;

    const { data } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('restaurant_id', currentRestaurant.id)
      .eq('is_active', true)
      .order('location_name');

    if (data) {
      setDeliveryZones(data);
      if (data.length > 0) {
        setSelectedZone(data[0]);
      }
    }
  };

  const getDeliveryFee = () => {
    if (deliveryType === DeliveryType.PICKUP) return 0;
    return selectedZone?.fee || 0;
  };

  const getTotal = () => {
    return getSubtotal() + getDeliveryFee();
  };

  const generateOrderMessage = () => {
    if (!currentRestaurant) return '';

    let message = `🍕 *NOVO PEDIDO*\n\n`;
    message += `👤 *Cliente:* ${customerName}\n`;
    message += `📱 *Telefone:* ${formatPhone(customerPhone)}\n\n`;

    // Tipo de entrega
    if (deliveryType === DeliveryType.DELIVERY) {
      message += `🚴 *Entrega*\n`;
      message += `📍 *Bairro:* ${selectedZone?.location_name || 'N/A'}\n`;
      message += `📮 *Endereço:* ${deliveryAddress}\n`;
      message += `💵 *Taxa de Entrega:* ${formatCurrency(getDeliveryFee())}\n\n`;
    } else {
      message += `🏃 *Retirada no Local*\n\n`;
    }

    // Itens
    message += `🛒 *Itens do Pedido:*\n`;
    items.forEach((item) => {
      message += `\n• ${item.quantity}x ${item.productName}\n`;
      
      if (item.isPizza) {
        message += `  Tamanho: ${item.pizzaSize}\n`;
        if (item.pizzaFlavors && item.pizzaFlavors.length > 0) {
          message += `  Sabores: ${item.pizzaFlavors.join(', ')}\n`;
        }
        if (item.pizzaDough) {
          message += `  Massa: ${item.pizzaDough}\n`;
        }
        if (item.pizzaEdge) {
          message += `  Borda: ${item.pizzaEdge}\n`;
        }
      }
      
      if (item.observations) {
        message += `  Obs: ${item.observations}\n`;
      }

      const itemTotal =
        (item.unitPrice + (item.pizzaDoughPrice || 0) + (item.pizzaEdgePrice || 0)) *
        item.quantity;
      message += `  ${formatCurrency(itemTotal)}\n`;
    });

    // Valores
    message += `\n💰 *Resumo:*\n`;
    message += `Subtotal: ${formatCurrency(getSubtotal())}\n`;
    if (deliveryType === DeliveryType.DELIVERY) {
      message += `Taxa de Entrega: ${formatCurrency(getDeliveryFee())}\n`;
    }
    message += `*Total: ${formatCurrency(getTotal())}*\n\n`;

    // Pagamento
    message += `💳 *Forma de Pagamento:* `;
    switch (paymentMethod) {
      case PaymentMethod.PIX:
        message += 'PIX\n';
        break;
      case PaymentMethod.CARD:
        message += 'Cartão (Maquininha)\n';
        break;
      case PaymentMethod.CASH:
        message += 'Dinheiro\n';
        if (paymentChangeFor) {
          message += `Troco para: ${formatCurrency(paymentChangeFor)}\n`;
        }
        break;
    }

    if (notes) {
      message += `\n📝 *Observações:* ${notes}\n`;
    }

    message += `\n---\n_Pedido enviado via ${currentRestaurant.name}_`;

    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentRestaurant) return;

    setLoading(true);

    try {
      // Cria o pedido no Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: currentRestaurant.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_type: deliveryType,
          delivery_zone_id: deliveryType === DeliveryType.DELIVERY ? selectedZone?.id : null,
          delivery_address: deliveryType === DeliveryType.DELIVERY ? deliveryAddress : null,
          delivery_fee: getDeliveryFee(),
          subtotal: getSubtotal(),
          total: getTotal(),
          payment_method: paymentMethod,
          payment_change_for: paymentMethod === PaymentMethod.CASH ? paymentChangeFor : null,
          status: OrderStatus.PENDING,
          notes,
          is_paid: false,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Cria os itens do pedido
      const orderItems: Partial<OrderItem>[] = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price:
          (item.unitPrice + (item.pizzaDoughPrice || 0) + (item.pizzaEdgePrice || 0)) *
          item.quantity,
        observations: item.observations,
        pizza_size: item.pizzaSize,
        pizza_flavors: item.pizzaFlavors,
        pizza_dough: item.pizzaDough,
        pizza_edge: item.pizzaEdge,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Gera mensagem e redireciona para WhatsApp
      const message = generateOrderMessage();
      const whatsappLink = generateWhatsAppLink(currentRestaurant.whatsapp, message);

      // Limpa o carrinho
      clearCart();

      // Redireciona
      window.location.href = whatsappLink;

    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      alert('Erro ao criar pedido. Tente novamente.');
      setLoading(false);
    }
  };

  const isValid = () => {
    if (!customerName || !customerPhone) return false;
    if (deliveryType === DeliveryType.DELIVERY) {
      if (!selectedZone || !deliveryAddress) return false;
    }
    if (paymentMethod === PaymentMethod.CASH && paymentChangeFor) {
      if (paymentChangeFor < getTotal()) return false;
    }
    return true;
  };

  if (!currentRestaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground sticky top-0 z-40 shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/${restaurantSlug}`)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Finalizar Pedido</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Seus Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Digite seu nome"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Entrega */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryType(DeliveryType.DELIVERY)}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                    deliveryType === DeliveryType.DELIVERY
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Bike className="h-6 w-6" />
                  <span className="font-semibold">Entrega</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType(DeliveryType.PICKUP)}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                    deliveryType === DeliveryType.PICKUP
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <ShoppingBag className="h-6 w-6" />
                  <span className="font-semibold">Retirada</span>
                </button>
              </div>

              {deliveryType === DeliveryType.DELIVERY && (
                <>
                  <div>
                    <Label htmlFor="zone">Bairro *</Label>
                    <select
                      id="zone"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={selectedZone?.id || ''}
                      onChange={(e) => {
                        const zone = deliveryZones.find((z) => z.id === e.target.value);
                        setSelectedZone(zone || null);
                      }}
                      required
                    >
                      {deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.location_name} - {formatCurrency(zone.fee)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="address">Endereço Completo *</Label>
                    <Textarea
                      id="address"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Rua, número, complemento, ponto de referência..."
                      rows={3}
                      required
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle>Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {[
                  { value: PaymentMethod.PIX, label: 'PIX' },
                  { value: PaymentMethod.CARD, label: 'Cartão (Maquininha)' },
                  { value: PaymentMethod.CASH, label: 'Dinheiro' },
                ].map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                      paymentMethod === method.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <span className="font-semibold">{method.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {paymentMethod === PaymentMethod.CASH && (
                <div>
                  <Label htmlFor="change">Troco para quanto? (Opcional)</Label>
                  <Input
                    id="change"
                    type="number"
                    step="0.01"
                    value={paymentChangeFor || ''}
                    onChange={(e) =>
                      setPaymentChangeFor(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    placeholder="Ex: 50.00"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações (Opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alguma observação adicional?"
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Resumo do Pedido */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(getSubtotal())}</span>
              </div>
              {deliveryType === DeliveryType.DELIVERY && (
                <div className="flex justify-between">
                  <span>Taxa de Entrega:</span>
                  <span>{formatCurrency(getDeliveryFee())}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>{formatCurrency(getTotal())}</span>
              </div>
            </CardContent>
          </Card>

          {/* Botão de Finalizar */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isValid() || loading}
          >
            {loading ? 'Processando...' : 'Enviar Pedido pelo WhatsApp'}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Ao finalizar, você será redirecionado para o WhatsApp para confirmar seu pedido
          </p>
        </form>
      </div>
    </div>
  );
}
