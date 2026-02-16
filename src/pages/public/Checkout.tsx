import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { supabase } from '@/lib/supabase';
import { DeliveryZone, PaymentMethod, DeliveryType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRestaurantStore } from '@/store/restaurantStore';
import { formatCurrency, formatGuarani, generateWhatsAppLink, normalizePhoneWithCountryCode } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Bike, Store, Smartphone, CreditCard, Banknote, Send } from 'lucide-react';

export default function PublicCheckout() {
  const { restaurantSlug } = useParams();
  const navigate = useNavigate();
  const { items, restaurantId, updateQuantity, getSubtotal, clearCart } =
    useCartStore();
  const { currentRestaurant } = useRestaurantStore();

  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'BR' | 'PY'>('BR');
  
  // Delivery State
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.DELIVERY);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [address, setAddress] = useState('');
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (restaurantId) {
      loadZones();
    }
  }, [restaurantId]);

  // Garantir restaurante no store (ex.: usuário entrou direto no checkout)
  useEffect(() => {
    if (!restaurantId || currentRestaurant?.id === restaurantId) return;
    const loadRestaurant = async () => {
      const { data } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single();
      if (data) useRestaurantStore.getState().setCurrentRestaurant(data);
    };
    loadRestaurant();
  }, [restaurantId, currentRestaurant?.id]);

  const loadZones = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);
    if (data) setZones(data);
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const deliveryFee = deliveryType === DeliveryType.DELIVERY ? (selectedZone?.fee || 0) : 0;
  const subtotal = getSubtotal();
  const total = subtotal + deliveryFee;

  const handleCheckout = async () => {
    if (!customerName || !customerPhone) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' });
      return;
    }

    if (deliveryType === DeliveryType.DELIVERY && !selectedZoneId) {
      toast({ title: 'Selecione o bairro/região de entrega', variant: 'destructive' });
      return;
    }

    // Troco em dinheiro é opcional e em Guaranies

    setLoading(true);

    try {
      const orderData = {
        restaurant_id: restaurantId,
        customer_name: customerName,
        customer_phone: normalizePhoneWithCountryCode(customerPhone, phoneCountry),
        delivery_type: deliveryType,
        delivery_zone_id: deliveryType === DeliveryType.DELIVERY ? selectedZoneId : null,
        delivery_address: deliveryType === DeliveryType.DELIVERY ? address : null,
        delivery_fee: deliveryFee,
        subtotal,
        total,
        payment_method: paymentMethod,
        payment_change_for: changeFor ? (parseFloat(changeFor.replace(/\D/g, '')) || null) : null,
        status: 'pending',
        notes: notes || null,
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.unitPrice * item.quantity,
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

      // WhatsApp: mensagem organizada para o estabelecimento
      const itemsText = items
        .map(
          (i) =>
            `  • ${i.quantity}x ${i.productName}${i.pizzaSize ? ` (${i.pizzaSize})` : ''} — ${formatCurrency(i.unitPrice * i.quantity)}`
        )
        .join('\n');
      const sections: string[] = [
        '🆕 *NOVO PEDIDO*',
        '',
        '👤 *Cliente:* ' + customerName,
        '📱 *Tel/WhatsApp:* +' + normalizePhoneWithCountryCode(customerPhone, phoneCountry),
        '🚚 *Entrega:* ' + (deliveryType === DeliveryType.DELIVERY ? 'Entrega' : 'Retirada'),
      ];
      if (deliveryType === DeliveryType.DELIVERY && address) {
        sections.push('📍 *Endereço:* ' + address);
      }
      if (deliveryType === DeliveryType.DELIVERY && selectedZoneId) {
        const zone = zones.find((z) => z.id === selectedZoneId);
        if (zone) sections.push('🏘️ *Bairro/Região:* ' + zone.location_name);
      }
      sections.push('');
      sections.push('💳 *Pagamento:* ' + (paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão na entrega' : 'Dinheiro'));
      if (paymentMethod === PaymentMethod.CASH && changeFor) {
        const gs = changeFor.replace(/\D/g, '');
        sections.push('🔄 *Troco para:* ' + (gs ? formatGuarani(parseInt(gs, 10)) : changeFor));
      }
      sections.push('');
      sections.push('📋 *Resumo:*');
      sections.push('  Subtotal: ' + formatCurrency(subtotal));
      if (deliveryFee > 0) sections.push('  Taxa entrega: ' + formatCurrency(deliveryFee));
      sections.push('  *Total: ' + formatCurrency(total) + '*' + '\n');
      sections.push('🍽️ *Itens:*');
      sections.push(itemsText);
      if (notes) sections.push('\n📝 *Obs:* ' + notes);
      const message = sections.join('\n');
      const restaurantWhatsApp = (currentRestaurant?.whatsapp || '').replace(/\D/g, '');
      const whatsappNumber = restaurantWhatsApp.length >= 10
        ? (restaurantWhatsApp.startsWith('55') || restaurantWhatsApp.startsWith('595') ? restaurantWhatsApp : '55' + restaurantWhatsApp)
        : '5511999999999';
      const link = generateWhatsAppLink(whatsappNumber, message);
      window.open(link, '_blank');

      clearCart();
      toast({ 
        title: 'Pedido realizado!', 
        description: 'Seu pedido foi enviado para o WhatsApp.',
        className: 'bg-green-50 border-green-200'
      });
      navigate(`/${restaurantSlug}`);
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      toast({ 
        title: 'Erro ao finalizar pedido', 
        description: 'Tente novamente.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <Store className="h-10 w-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Seu carrinho está vazio</h2>
          <Button 
            onClick={() => navigate(`/${restaurantSlug}`)}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
          >
            Voltar ao Cardápio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-6 w-6 text-slate-600" />
          </Button>
          <h1 className="text-xl font-bold text-slate-900">Finalizar Pedido</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-6 max-w-2xl space-y-6">
        
        {/* Lista de Itens */}
        <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
          <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg text-slate-800">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                  {item.quantity}x
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-slate-900">{item.productName}</h3>
                    <span className="font-bold text-slate-700">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                  {(item.pizzaSize || item.pizzaFlavors) && (
                    <p className="text-sm text-slate-500 mt-1">
                      {item.pizzaSize} - {item.pizzaFlavors?.join(', ')}
                    </p>
                  )}
                  {item.observations && (
                    <p className="text-xs text-orange-600 mt-1 italic">Obs: {item.observations}</p>
                  )}
                  <div className="mt-2 flex gap-3">
                    <button 
                      onClick={() => updateQuantity(index, Math.max(0, item.quantity - 1))}
                      className="text-xs text-slate-400 hover:text-orange-500 font-medium"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tipo de Entrega */}
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-200/50 rounded-xl">
          <button
            onClick={() => setDeliveryType(DeliveryType.DELIVERY)}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${
              deliveryType === DeliveryType.DELIVERY
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100'
                : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <Bike className="h-5 w-5" /> Entrega
          </button>
          <button
            onClick={() => setDeliveryType(DeliveryType.PICKUP)}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${
              deliveryType === DeliveryType.PICKUP
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100'
                : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <Store className="h-5 w-5" /> Retirada
          </button>
        </div>

        {/* Formulário de Entrega */}
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu Nome</Label>
                <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Como te chamamos?" className="bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular / WhatsApp</Label>
                <div className="flex gap-2">
                  <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR' | 'PY')}>
                    <SelectTrigger className="w-[100px] bg-slate-50 border-slate-200 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BR">🇧🇷 +55</SelectItem>
                      <SelectItem value="PY">🇵🇾 +595</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={phoneCountry === 'BR' ? '(11) 99999-9999' : '981 123 456'}
                    className="bg-slate-50 border-slate-200 flex-1"
                  />
                </div>
              </div>
            </div>

            {deliveryType === DeliveryType.DELIVERY && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="space-y-2">
                  <Label>Bairro / Região de Entrega</Label>
                  <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Selecione seu bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.location_name} ({formatCurrency(zone.fee)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço completo (opcional)</Label>
                  <Input 
                    id="address" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Rua, número, complemento — ou envie a localização no WhatsApp" 
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagamento */}
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-slate-800">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="gap-3">
              <div className={`flex items-center space-x-3 border p-4 rounded-xl transition-all ${paymentMethod === PaymentMethod.PIX ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200'}`}>
                <RadioGroupItem value={PaymentMethod.PIX} id="pix" />
                <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                  <Smartphone className="h-5 w-5 text-emerald-500" /> PIX
                </Label>
              </div>
              <div className={`flex items-center space-x-3 border p-4 rounded-xl transition-all ${paymentMethod === PaymentMethod.CARD ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200'}`}>
                <RadioGroupItem value={PaymentMethod.CARD} id="card" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                  <CreditCard className="h-5 w-5 text-blue-500" /> Cartão na Entrega
                </Label>
              </div>
              <div className={`flex flex-col space-y-3 border p-4 rounded-xl transition-all ${paymentMethod === PaymentMethod.CASH ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200'}`}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value={PaymentMethod.CASH} id="cash" />
                  <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                    <Banknote className="h-5 w-5 text-green-600" /> Dinheiro
                  </Label>
                </div>
                {paymentMethod === PaymentMethod.CASH && (
                  <div className="pl-7">
                    <Label className="text-xs text-slate-500">Troco para quanto? (em Guaranies)</Label>
                    <Input 
                      placeholder="Ex: 50.000" 
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      className="mt-1 bg-white"
                    />
                  </div>
                )}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações Gerais</Label>
          <Input 
            id="notes" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="Ex: Campainha quebrada, deixar na portaria..." 
            className="bg-white border-slate-200"
          />
        </div>

      </div>

      {/* Footer Fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="container mx-auto max-w-2xl space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {deliveryType === DeliveryType.DELIVERY && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Taxa de Entrega</span>
              <span className="font-semibold text-red-600">{formatCurrency(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-xl font-bold border-t border-slate-100 pt-2 mb-2">
            <span>Total</span>
            <span className="text-slate-900">{formatCurrency(total)}</span>
          </div>
          
          <Button 
            size="lg" 
            className="w-full bg-[#25D366] hover:bg-[#1ebc57] text-white font-bold h-14 rounded-xl shadow-lg flex items-center justify-center gap-2 text-lg"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? 'Enviando...' : (
              <>
                Enviar Pedido no WhatsApp <Send className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}