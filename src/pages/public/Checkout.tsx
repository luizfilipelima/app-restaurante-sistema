import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { supabase } from '@/lib/supabase';
import { getSubdomain } from '@/lib/subdomain';
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
import { formatCurrency, formatGuarani, generateWhatsAppLink, normalizePhoneWithCountryCode, isWithinOpeningHours } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Bike, Store, Smartphone, CreditCard, Banknote, Send } from 'lucide-react';

interface PublicCheckoutProps {
  /** Quando renderizado dentro de StoreLayout (subdomínio), o slug é passado por prop */
  tenantSlug?: string;
}

export default function PublicCheckout({ tenantSlug: tenantSlugProp }: PublicCheckoutProps = {}) {
  const params = useParams();
  const subdomain = getSubdomain();
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

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
  const isSubdomain = subdomain && !['app', 'www', 'localhost'].includes(subdomain);

  const handleBackToMenu = () => {
    if (isSubdomain) {
      navigate('/');
    } else {
      navigate(`/${restaurantSlug}`);
    }
  };

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

    if (!restaurantId) {
      toast({
        title: 'Carrinho inválido',
        description: 'Volte ao cardápio e adicione os itens novamente.',
        variant: 'destructive',
      });
      handleBackToMenu();
      return;
    }

    // Horário de funcionamento: bloquear se o restaurante estiver fechado
    if (currentRestaurant) {
      const hasHours = currentRestaurant.opening_hours && Object.keys(currentRestaurant.opening_hours).length > 0;
      const alwaysOpen = !!currentRestaurant.always_open;
      const isOpen = currentRestaurant.is_manually_closed
        ? false
        : alwaysOpen
          ? true
          : hasHours
            ? isWithinOpeningHours(currentRestaurant.opening_hours as Record<string, { open: string; close: string } | null>)
            : true;
      if (!isOpen) {
        toast({
          title: 'Restaurante fechado',
          description: 'No momento estamos fora do horário de funcionamento. Tente novamente mais tarde.',
          variant: 'destructive',
        });
        return;
      }
    }

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
        is_paid: true, // Todos os pedidos são considerados pagos por padrão
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      const orderItems = items.map((item) => {
        const itemTotal =
          item.unitPrice * item.quantity +
          (item.pizzaEdgePrice ?? 0) * item.quantity +
          (item.pizzaDoughPrice ?? 0) * item.quantity;
        return {
          order_id: order.id,
          product_id: item.productId ?? null,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: itemTotal,
          observations: item.observations ?? null,
          pizza_size: item.pizzaSize ?? null,
          pizza_flavors: item.pizzaFlavors ?? null,
          pizza_dough: item.pizzaDough ?? null,
          pizza_edge: item.pizzaEdge ?? null,
        };
      });

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
      
      // Obter e validar número do WhatsApp do restaurante
      const restaurantWhatsApp = (currentRestaurant?.whatsapp || '').replace(/\D/g, '');
      const country = (currentRestaurant as { phone_country?: 'BR' | 'PY' })?.phone_country || 'BR';
      const prefix = country === 'PY' ? '595' : '55';
      
      let whatsappNumber: string;
      
      if (!restaurantWhatsApp || restaurantWhatsApp.length < 9) {
        // Se não houver WhatsApp configurado, usar o telefone do restaurante como fallback
        const restaurantPhone = (currentRestaurant?.phone || '').replace(/\D/g, '');
        if (restaurantPhone && restaurantPhone.length >= 9) {
          const hasPhonePrefix = restaurantPhone.startsWith('55') || restaurantPhone.startsWith('595');
          whatsappNumber = hasPhonePrefix ? restaurantPhone : prefix + restaurantPhone;
        } else {
          // Se não houver telefone também, mostrar erro
          throw new Error('WhatsApp do restaurante não configurado. Entre em contato com o estabelecimento.');
        }
      } else {
        const hasPrefix = restaurantWhatsApp.startsWith('55') || restaurantWhatsApp.startsWith('595');
        whatsappNumber = hasPrefix ? restaurantWhatsApp : prefix + restaurantWhatsApp;
      }
      
      // Gerar link do WhatsApp
      const link = generateWhatsAppLink(whatsappNumber, message);
      
      // Limpar carrinho antes de redirecionar
      clearCart();
      
      // Mostrar toast de sucesso
      toast({ 
        title: '✅ Pedido realizado!', 
        description: 'Redirecionando para o WhatsApp...',
        className: 'bg-green-50 border-green-200'
      });
      
      // Abrir WhatsApp
      // Em mobile, window.location.href funciona melhor e redireciona diretamente
      // Em desktop, tentamos window.open primeiro
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile: redirecionar diretamente (melhor experiência)
        setTimeout(() => {
          window.location.href = link;
        }, 500); // Pequeno delay para o toast aparecer
      } else {
        // Desktop: tentar abrir em nova aba
        const opened = window.open(link, '_blank', 'noopener,noreferrer');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
          // Pop-up bloqueado, redirecionar na mesma aba
          setTimeout(() => {
            window.location.href = link;
          }, 500);
        } else {
          // Pop-up aberto com sucesso, voltar ao menu após um tempo
          setTimeout(() => {
            handleBackToMenu();
          }, 1000);
        }
      }
    } catch (error: unknown) {
      console.error('Erro ao finalizar:', error);
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : 'Tente novamente.';
      toast({
        title: 'Erro ao finalizar pedido',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 safe-area-inset-bottom">
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <Store className="h-8 w-8 sm:h-10 sm:w-10 text-orange-500" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Seu carrinho está vazio</h2>
          <Button 
            onClick={handleBackToMenu}
            className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base touch-manipulation active:scale-95"
          >
            Voltar ao Cardápio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-24 safe-area-inset-bottom">
      {/* Header - Mobile First */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 safe-area-inset-top">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="-ml-1 sm:-ml-2 h-10 w-10 sm:h-11 sm:w-11 touch-manipulation active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Finalizar Pedido</h1>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 mt-4 sm:mt-6 max-w-2xl space-y-4 sm:space-y-6">
        
        {/* Lista de Itens - Mobile First */}
        <Card className="border-0 shadow-sm bg-white rounded-xl sm:rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 bg-slate-50/50 border-b border-slate-100 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-lg text-slate-800">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 sm:gap-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold text-xs sm:text-sm flex-shrink-0">
                  {item.quantity}x
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm sm:text-base leading-tight flex-1 min-w-0">{item.productName}</h3>
                    <span className="font-bold text-slate-700 text-sm sm:text-base flex-shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                  {(item.pizzaSize || item.pizzaFlavors) && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2">
                      {item.pizzaSize} - {item.pizzaFlavors?.join(', ')}
                    </p>
                  )}
                  {item.observations && (
                    <p className="text-xs text-orange-600 mt-1 italic line-clamp-2">Obs: {item.observations}</p>
                  )}
                  <div className="mt-2 flex gap-3">
                    <button 
                      onClick={() => updateQuantity(index, Math.max(0, item.quantity - 1))}
                      className="text-xs text-slate-400 hover:text-orange-500 active:text-orange-600 font-medium touch-manipulation"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tipo de Entrega - Mobile First */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1 bg-slate-200/50 rounded-xl">
          <button
            onClick={() => setDeliveryType(DeliveryType.DELIVERY)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all touch-manipulation active:scale-95 ${
              deliveryType === DeliveryType.DELIVERY
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100'
                : 'text-slate-500 active:bg-white/50'
            }`}
          >
            <Bike className="h-4 w-4 sm:h-5 sm:w-5" /> <span className="hidden xs:inline">Entrega</span><span className="xs:hidden">Ent.</span>
          </button>
          <button
            onClick={() => setDeliveryType(DeliveryType.PICKUP)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all touch-manipulation active:scale-95 ${
              deliveryType === DeliveryType.PICKUP
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100'
                : 'text-slate-500 active:bg-white/50'
            }`}
          >
            <Store className="h-4 w-4 sm:h-5 sm:w-5" /> <span className="hidden xs:inline">Retirada</span><span className="xs:hidden">Ret.</span>
          </button>
        </div>

        {/* Formulário de Entrega - Mobile First */}
        <Card className="border-0 shadow-sm bg-white rounded-xl sm:rounded-2xl">
          <CardContent className="pt-4 sm:pt-6 space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base">Seu Nome</Label>
                <Input 
                  id="name" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="Como te chamamos?" 
                  className="bg-slate-50 border-slate-200 h-11 sm:h-12 text-sm sm:text-base touch-manipulation" 
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="phone" className="text-sm sm:text-base">Celular / WhatsApp</Label>
                <div className="flex gap-2">
                  <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR' | 'PY')}>
                    <SelectTrigger className="w-[90px] sm:w-[100px] bg-slate-50 border-slate-200 shrink-0 h-11 sm:h-12 text-sm sm:text-base">
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
                    className="bg-slate-50 border-slate-200 flex-1 h-11 sm:h-12 text-sm sm:text-base touch-manipulation"
                    type="tel"
                  />
                </div>
              </div>
            </div>

            {deliveryType === DeliveryType.DELIVERY && (
              <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-slate-100">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">Bairro / Região de Entrega</Label>
                  <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 sm:h-12 text-sm sm:text-base touch-manipulation">
                      <SelectValue placeholder="Selecione seu bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id} className="text-sm sm:text-base">
                          {zone.location_name} ({formatCurrency(zone.fee)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="address" className="text-sm sm:text-base">Endereço completo (opcional)</Label>
                  <Input 
                    id="address" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Rua, número, complemento — ou envie a localização no WhatsApp" 
                    className="bg-slate-50 border-slate-200 h-11 sm:h-12 text-sm sm:text-base touch-manipulation"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagamento - Mobile First */}
        <Card className="border-0 shadow-sm bg-white rounded-xl sm:rounded-2xl">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-base sm:text-lg text-slate-800">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-3 sm:px-6 pb-4 sm:pb-6">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="gap-2.5 sm:gap-3">
              <div className={`flex items-center space-x-2 sm:space-x-3 border p-3 sm:p-4 rounded-xl transition-all touch-manipulation active:scale-[0.98] ${paymentMethod === PaymentMethod.PIX ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 active:bg-slate-50'}`}>
                <RadioGroupItem value={PaymentMethod.PIX} id="pix" className="h-5 w-5 sm:h-6 sm:w-6" />
                <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm sm:text-base">
                  <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 flex-shrink-0" /> PIX
                </Label>
              </div>
              <div className={`flex items-center space-x-2 sm:space-x-3 border p-3 sm:p-4 rounded-xl transition-all touch-manipulation active:scale-[0.98] ${paymentMethod === PaymentMethod.CARD ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 active:bg-slate-50'}`}>
                <RadioGroupItem value={PaymentMethod.CARD} id="card" className="h-5 w-5 sm:h-6 sm:w-6" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm sm:text-base">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" /> <span className="hidden xs:inline">Cartão na Entrega</span><span className="xs:hidden">Cartão</span>
                </Label>
              </div>
              <div className={`flex flex-col space-y-2.5 sm:space-y-3 border p-3 sm:p-4 rounded-xl transition-all ${paymentMethod === PaymentMethod.CASH ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200'}`}>
                <div className="flex items-center space-x-2 sm:space-x-3 touch-manipulation active:scale-[0.98]">
                  <RadioGroupItem value={PaymentMethod.CASH} id="cash" className="h-5 w-5 sm:h-6 sm:w-6" />
                  <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm sm:text-base">
                    <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" /> Dinheiro
                  </Label>
                </div>
                {paymentMethod === PaymentMethod.CASH && (
                  <div className="pl-7 sm:pl-9">
                    <Label className="text-xs sm:text-sm text-slate-500">Troco para quanto? (em Guaranies)</Label>
                    <Input 
                      placeholder="Ex: 50.000" 
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      className="mt-1.5 sm:mt-2 bg-white h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                    />
                  </div>
                )}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="space-y-1.5 sm:space-y-2 px-1">
          <Label htmlFor="notes" className="text-sm sm:text-base">Observações Gerais</Label>
          <Input 
            id="notes" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="Ex: Campainha quebrada, deixar na portaria..." 
            className="bg-white border-slate-200 h-11 sm:h-12 text-sm sm:text-base touch-manipulation"
          />
        </div>

      </div>

      {/* Footer Fixo - Mobile First */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 sm:p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-area-inset-bottom">
        <div className="container mx-auto max-w-2xl space-y-2 sm:space-y-3">
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {deliveryType === DeliveryType.DELIVERY && (
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-500">Taxa de Entrega</span>
              <span className="font-semibold text-red-600">{formatCurrency(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-lg sm:text-xl font-bold border-t border-slate-100 pt-2 mb-1 sm:mb-2">
            <span>Total</span>
            <span className="text-slate-900">{formatCurrency(total)}</span>
          </div>
          
          <Button 
            size="lg" 
            className="w-full bg-[#25D366] hover:bg-[#1ebc57] active:bg-[#1aa34a] text-white font-bold h-12 sm:h-14 rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base sm:text-lg touch-manipulation active:scale-[0.98]"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Enviando...
              </span>
            ) : (
              <>
                <span className="hidden xs:inline">Enviar Pedido no WhatsApp</span>
                <span className="xs:hidden">Enviar no WhatsApp</span>
                <Send className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}