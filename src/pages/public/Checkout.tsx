import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useRestaurantStore } from '@/store/restaurantStore';
import { useTableOrderStore } from '@/store/tableOrderStore';
import { useSharingMeta } from '@/hooks/useSharingMeta';
import { formatCurrency, generateWhatsAppLink, normalizePhoneWithCountryCode, isWithinOpeningHours } from '@/lib/utils';
import { processTemplate, getTemplate } from '@/lib/whatsappTemplates';
import i18n, { setStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Bike, Store, Smartphone, CreditCard, Banknote, Send, Trash2, MapPin, Loader2, Gift } from 'lucide-react';
import MapAddressPicker from '@/components/public/MapAddressPicker';
import { fetchLoyaltyStatus, redeemLoyalty } from '@/hooks/queries';
import LoyaltyCard from '@/components/public/LoyaltyCard';

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
  const { t } = useTranslation();
  const { currentRestaurant } = useRestaurantStore();
  const currency = (currentRestaurant as { currency?: 'BRL' | 'PYG' })?.currency === 'PYG' ? 'PYG' : 'BRL';

  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'BR' | 'PY'>('BR');

  // ── Fidelidade ──
  const [loyaltyStatus, setLoyaltyStatus] = useState<{ points: number; orders_required: number; reward_description: string; enabled: boolean; redeemed_count: number } | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [loyaltyRedeemed, setLoyaltyRedeemed] = useState(false);
  
  // Delivery State
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.DELIVERY);
  const [searchParams] = useSearchParams();
  const tableIdFromUrl = searchParams.get('tableId');
  const tableNumberFromUrl = searchParams.get('tableNumber');
  const { tableId: tableIdStore, tableNumber: tableNumberStore, clearTable } = useTableOrderStore();
  const tableId = tableIdFromUrl || tableIdStore;
  const tableNumber = tableNumberFromUrl ? parseInt(tableNumberFromUrl, 10) : tableNumberStore;
  const isTableOrder = !!(tableId && tableNumber);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressDetails, setAddressDetails] = useState('');
  const [geolocating, setGeolocating] = useState(false);

  const geoStorageKey = `checkout_geo_${restaurantId || 'default'}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(geoStorageKey);
      if (saved) {
        const data = JSON.parse(saved) as { lat?: number; lng?: number; details?: string };
        if (data.lat != null && data.lng != null) {
          setLatitude(data.lat);
          setLongitude(data.lng);
        }
        if (data.details) setAddressDetails(data.details);
      }
    } catch {
      // ignore
    }
  }, [restaurantId, geoStorageKey]);

  useEffect(() => {
    if (latitude != null && longitude != null) {
      try {
        localStorage.setItem(
          geoStorageKey,
          JSON.stringify({ lat: latitude, lng: longitude, details: addressDetails })
        );
      } catch {
        // ignore
      }
    }
  }, [latitude, longitude, addressDetails, geoStorageKey]);
  
  // Carregar telefone salvo e dados de fidelidade
  useEffect(() => {
    if (!restaurantId) return;
    try {
      const savedPhone = localStorage.getItem(`checkout_phone_${restaurantId}`);
      const savedName = localStorage.getItem(`checkout_name_${restaurantId}`);
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedName) setCustomerName(savedName);
    } catch { /* ignore */ }
  }, [restaurantId]);

  // Buscar status de fidelidade quando telefone muda (debounce implícito pelo useEffect)
  useEffect(() => {
    const phone = customerPhone.replace(/\D/g, '');
    if (!restaurantId || phone.length < 8) { setLoyaltyStatus(null); return; }
    fetchLoyaltyStatus(restaurantId, customerPhone).then((s) => setLoyaltyStatus(s));
  }, [customerPhone, restaurantId]);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const isSubdomain = subdomain && !['app', 'www', 'localhost'].includes(subdomain);

  const handleBackToMenu = () => {
    if (isTableOrder && isSubdomain) {
      navigate(`/cardapio/${tableNumber}`);
    } else if (isTableOrder && restaurantSlug) {
      navigate(`/${restaurantSlug}/cardapio/${tableNumber}`);
    } else if (isSubdomain) {
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
      if (data) {
        useRestaurantStore.getState().setCurrentRestaurant(data);
        const lang: MenuLanguage = data.language === 'es' ? 'es' : 'pt';
        i18n.changeLanguage(lang);
        setStoredMenuLanguage(lang);
      }
    };
    loadRestaurant();
  }, [restaurantId, currentRestaurant?.id]);

  // Atualizar título e meta tags de compartilhamento (logo do restaurante como imagem destacada)
  useEffect(() => {
    if (currentRestaurant?.name) {
      document.title = `${currentRestaurant.name} - ${t('checkout.title')}`;
    } else {
      document.title = t('checkout.title');
    }
  }, [currentRestaurant?.name, t]);
  useSharingMeta(currentRestaurant ? { name: currentRestaurant.name, logo: currentRestaurant.logo } : null);

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
    const nameToUse = isTableOrder ? `Mesa ${tableNumber}` : customerName;
    const phoneToUse = isTableOrder
      ? ((currentRestaurant?.phone || '').replace(/\D/g, '').length >= 9
          ? (currentRestaurant?.phone || '0')
          : '0000000000')
      : customerPhone;

    if (!isTableOrder && (!customerName || !customerPhone)) {
      toast({ title: t('checkout.errorFillNamePhone'), variant: 'destructive' });
      return;
    }

    // Salvar phone/name no localStorage para uso futuro (fidelidade)
    if (!isTableOrder && restaurantId) {
      try {
        localStorage.setItem(`checkout_phone_${restaurantId}`, customerPhone);
        localStorage.setItem(`checkout_name_${restaurantId}`, customerName);
      } catch { /* ignore */ }
    }

    // Verificar se pode resgatar fidelidade (antes de continuar)
    if (!isTableOrder && loyaltyStatus?.enabled && loyaltyStatus.points >= loyaltyStatus.orders_required && !loyaltyRedeemed) {
      setShowRedeemDialog(true);
      return;
    }

    if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && !selectedZoneId) {
      toast({ title: t('checkout.errorSelectZone'), variant: 'destructive' });
      return;
    }

    // Delivery: exige localização (mapa) OU detalhes do endereço (fluxo tradicional)
    if (
      !isTableOrder &&
      deliveryType === DeliveryType.DELIVERY &&
      (latitude == null || longitude == null) &&
      !addressDetails?.trim()
    ) {
      toast({
        title: 'Defina o endereço',
        description: 'Use "Minha Localização Atual" ou preencha os detalhes do endereço.',
        variant: 'destructive',
      });
      return;
    }

    if (!restaurantId) {
      toast({
        title: t('checkout.errorInvalidCart'),
        description: t('checkout.errorInvalidCartDesc'),
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
          title: t('checkout.errorRestaurantClosed'),
          description: t('checkout.errorRestaurantClosedDesc'),
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    const finalDeliveryType = isTableOrder ? DeliveryType.PICKUP : deliveryType;
    const finalDeliveryFee = isTableOrder ? 0 : deliveryFee;
    const finalTotal = subtotal + finalDeliveryFee;

    try {
      const orderPayload = {
        restaurant_id: restaurantId,
        customer_name: nameToUse,
        customer_phone: normalizePhoneWithCountryCode(phoneToUse, phoneCountry),
        delivery_type: finalDeliveryType,
        delivery_zone_id: finalDeliveryType === DeliveryType.DELIVERY ? (selectedZoneId || null) : null,
        delivery_address:
          finalDeliveryType === DeliveryType.DELIVERY
            ? latitude != null && longitude != null
              ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : addressDetails?.trim() || null
            : null,
        latitude: finalDeliveryType === DeliveryType.DELIVERY && latitude != null ? latitude : null,
        longitude: finalDeliveryType === DeliveryType.DELIVERY && longitude != null ? longitude : null,
        address_details: finalDeliveryType === DeliveryType.DELIVERY && addressDetails.trim() ? addressDetails.trim() : null,
        delivery_fee: finalDeliveryFee,
        subtotal,
        total: finalTotal,
        payment_method: isTableOrder ? PaymentMethod.TABLE : paymentMethod,
        payment_change_for: isTableOrder ? null : (changeFor ? (parseFloat(changeFor.replace(/\D/g, '')) || null) : null),
        order_source: isTableOrder ? 'table' : (finalDeliveryType === DeliveryType.DELIVERY ? 'delivery' : 'pickup'),
        table_id: isTableOrder && tableId ? tableId : null,
        status: 'pending',
        notes: notes || null,
        is_paid: isTableOrder ? false : true,
        loyalty_redeemed: loyaltyRedeemed,
      };

      const orderItemsPayload = items.map((item) => {
        const itemTotal =
          item.unitPrice * item.quantity +
          (item.pizzaEdgePrice ?? 0) * item.quantity +
          (item.pizzaDoughPrice ?? 0) * item.quantity;
        return {
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
          is_upsell: item.isUpsell ?? false,
        };
      });

      // Usa RPC SECURITY DEFINER que bypassa RLS — funciona para clientes anônimos
      const { data: rpcResult, error: rpcError } = await supabase.rpc('place_order', {
        p_order: orderPayload,
        p_items: orderItemsPayload,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult?.ok) throw new Error(rpcResult?.error ?? 'Erro ao registrar pedido.');

      // Se o cliente resgatou, executar o débito de pontos no banco
      if (loyaltyRedeemed && restaurantId) {
        await redeemLoyalty(restaurantId, normalizePhoneWithCountryCode(customerPhone, phoneCountry));
        setLoyaltyRedeemed(false);
      }

      if (isTableOrder) {
        clearTable();
      }

      // WhatsApp: apenas para pedidos não-mesa (delivery/pickup)
      if (!isTableOrder) {
      const itemsText = items
        .map((i) => {
          const itemTotal =
            i.unitPrice * i.quantity +
            (i.pizzaEdgePrice ?? 0) * i.quantity +
            (i.pizzaDoughPrice ?? 0) * i.quantity;
          return `  • ${i.quantity}x ${i.productName}${i.pizzaSize ? ` (${i.pizzaSize})` : ''} — ${formatCurrency(itemTotal, currency)}`;
        })
        .join('\n');

      const bairro = deliveryType === DeliveryType.DELIVERY && selectedZoneId
        ? (zones.find((z) => z.id === selectedZoneId)?.location_name ?? '')
        : '';
      const endereco =
        deliveryType === DeliveryType.DELIVERY
          ? latitude != null && longitude != null
            ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : addressDetails?.trim() ?? ''
          : '';
      const trocoRaw = paymentMethod === PaymentMethod.CASH && changeFor
        ? changeFor.replace(/\D/g, '')
        : '';
      const trocoFormatted = trocoRaw ? formatCurrency(parseInt(trocoRaw, 10), currency) : '';
      const paymentLabel = paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão na entrega' : 'Dinheiro';
      const taxaLine = deliveryFee > 0 ? `Taxa entrega: ${formatCurrency(deliveryFee, currency)}` : '';

      const restaurantTemplates = (currentRestaurant as { whatsapp_templates?: Record<string, string> | null })?.whatsapp_templates;
      const message = processTemplate(
        getTemplate('new_order', restaurantTemplates),
        {
          cliente_nome:      customerName,
          cliente_telefone:  '+' + normalizePhoneWithCountryCode(customerPhone, phoneCountry),
          tipo_entrega:      deliveryType === DeliveryType.DELIVERY ? 'Entrega' : 'Retirada',
          bairro,
          endereco,
          detalhes_endereco: deliveryType === DeliveryType.DELIVERY ? (addressDetails?.trim() ?? '') : '',
          pagamento:         paymentLabel,
          troco:             trocoFormatted,
          subtotal:          formatCurrency(subtotal, currency),
          taxa_entrega:      taxaLine,
          total:             formatCurrency(total, currency),
          itens:             itemsText,
          observacoes:       notes?.trim() ?? '',
        },
      );
      
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
        title: '✅ ' + t('checkout.successOrderTitle'), 
        description: t('checkout.successOrderDesc'),
        className: 'bg-green-50 border-green-200'
      });
      
      // Abrir WhatsApp em nova aba
      window.open(link, '_blank', 'noopener,noreferrer');

      // Redirecionar para a tela de rastreamento do pedido
      const newOrderId = (rpcResult as { order_id?: string })?.order_id;
      if (newOrderId) {
        const trackPath = isSubdomain
          ? `/track/${newOrderId}`
          : `/${restaurantSlug}/track/${newOrderId}`;
        setTimeout(() => navigate(trackPath), 600);
      } else {
        setTimeout(() => handleBackToMenu(), 800);
      }
      } else {
        // Pedido de mesa: não abre WhatsApp
        clearCart();
        toast({
          title: '✅ Pedido enviado!',
          description: 'Seu pedido foi enviado para a cozinha. Mesa ' + tableNumber,
          className: 'bg-green-50 border-green-200',
        });
        setTimeout(() => handleBackToMenu(), 1500);
      }
    } catch (error: unknown) {
      console.error('[Checkout] Erro ao finalizar pedido:', error);
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : t('checkout.errorGeneric');
      toast({
        title: t('checkout.errorFinalizeTitle'),
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
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t('checkout.emptyTitle')}</h2>
          <Button 
            onClick={handleBackToMenu}
            className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base touch-manipulation active:scale-95"
          >
            {t('checkout.backToMenu')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-6 sm:pb-8 safe-area-inset-bottom">
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
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t('checkout.title')}</h1>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 mt-3 sm:mt-5 mb-6 sm:mb-8 max-w-xl space-y-3">

        {/* Lista de Itens */}
        <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
          <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100 px-4 pt-3">
            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{t('checkout.orderItems')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 space-y-1 px-4 pb-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold text-xs flex-shrink-0">
                  {item.quantity}x
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{item.productName}</p>
                  {(item.pizzaSize || item.pizzaFlavors) && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {[item.pizzaSize, item.pizzaFlavors?.join(', ')].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {item.observations && (
                    <p className="text-xs text-orange-500 mt-0.5 italic line-clamp-1">Obs: {item.observations}</p>
                  )}
                </div>
                {!isTableOrder && (
                  <span className="font-bold text-slate-700 text-sm flex-shrink-0">{formatCurrency(item.unitPrice * item.quantity, currency)}</span>
                )}
                <button
                  onClick={() => updateQuantity(index, 0)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all touch-manipulation flex-shrink-0"
                  aria-label={t('checkout.remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pedido de mesa: badge */}
        {isTableOrder && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
            <Store className="h-5 w-5 text-amber-600" />
            <span className="font-semibold">Pedido da Mesa {tableNumber}</span>
          </div>
        )}

        {/* Tipo de Entrega - oculto em pedidos de mesa */}
        {!isTableOrder && (
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/40 rounded-xl">
          <button
            onClick={() => setDeliveryType(DeliveryType.DELIVERY)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all touch-manipulation active:scale-95 ${
              deliveryType === DeliveryType.DELIVERY
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100'
                : 'text-slate-500 active:bg-white/50'
            }`}
          >
            <Bike className="h-4 w-4" /> {t('checkout.delivery')}
          </button>
          <button
            onClick={() => setDeliveryType(DeliveryType.PICKUP)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all touch-manipulation active:scale-95 ${
              deliveryType === DeliveryType.PICKUP
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100'
                : 'text-slate-500 active:bg-white/50'
            }`}
          >
            <Store className="h-4 w-4" /> {t('checkout.pickup')}
          </button>
        </div>
        )}

        {/* Formulário de Entrega - oculto em pedidos de mesa */}
        {!isTableOrder && (
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="pt-4 space-y-3 px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('checkout.yourName')}</Label>
                <Input 
                  id="name" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder={t('checkout.namePlaceholder')} 
                  className="bg-slate-50 border-slate-200 h-11 text-base touch-manipulation" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('checkout.phoneLabel')}</Label>
                <div className="flex gap-2">
                  <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR' | 'PY')}>
                    <SelectTrigger className="w-12 bg-slate-50 border-slate-200 shrink-0 h-11 px-2 justify-center text-lg">
                      <span>{phoneCountry === 'BR' ? '🇧🇷' : '🇵🇾'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BR">🇧🇷 +55 (Brasil)</SelectItem>
                      <SelectItem value="PY">🇵🇾 +595 (Paraguay)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={phoneCountry === 'BR' ? '(11) 99999-9999' : '981 123 456'}
                    className="bg-slate-50 border-slate-200 flex-1 h-11 text-base touch-manipulation"
                    type="tel"
                  />
                </div>
              </div>
            </div>

            {deliveryType === DeliveryType.DELIVERY && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('checkout.zoneLabel')}</Label>
                  <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 text-base touch-manipulation">
                      <SelectValue placeholder={t('checkout.zonePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id} className="text-sm">
                          {zone.location_name} ({formatCurrency(zone.fee, currency)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('checkout.addressLabel')}</Label>
                  <p className="text-xs text-slate-500 mb-1">
                    Use o botão para GPS ou preencha o endereço manualmente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-slate-200 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 font-medium touch-manipulation"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        toast({ title: 'Seu navegador não suporta geolocalização.', variant: 'destructive' });
                        return;
                      }
                      setGeolocating(true);
                      const opts: PositionOptions = {
                        enableHighAccuracy: true,
                        timeout: 30000,
                        maximumAge: 60000,
                      };
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setLatitude(pos.coords.latitude);
                          setLongitude(pos.coords.longitude);
                          setGeolocating(false);
                          toast({ title: 'Localização obtida! Ajuste o pino no mapa se precisar.', variant: 'default' });
                        },
                        (err) => {
                          setGeolocating(false);
                          const msg =
                            err.code === err.PERMISSION_DENIED
                              ? 'Permissão negada. Habilite o acesso à localização nas configurações do navegador ou do celular.'
                              : err.code === err.POSITION_UNAVAILABLE
                              ? 'Localização indisponível. Verifique se o GPS está ativo e tente novamente.'
                              : err.code === err.TIMEOUT
                              ? 'Tempo esgotado. Verifique se o GPS está ativo e tente em um local com melhor sinal.'
                              : 'Não foi possível obter sua localização. Você pode preencher o endereço manualmente abaixo.';
                          toast({ title: msg, variant: 'destructive' });
                        },
                        opts
                      );
                    }}
                    disabled={geolocating}
                  >
                    {geolocating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <MapPin className="h-4 w-4 mr-2" />
                    )}
                    Minha Localização Atual
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="addressDetails" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Endereço completo {latitude == null && longitude == null && '(obrigatório se o GPS falhar)'}
                  </Label>
                  <Input
                    id="addressDetails"
                    value={addressDetails}
                    onChange={(e) => setAddressDetails(e.target.value)}
                    placeholder="Rua, número, bairro, referência..."
                    className="bg-slate-50 border-slate-200 h-11 text-base touch-manipulation"
                  />
                </div>
                {latitude != null && longitude != null && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ajuste no mapa</Label>
                    <MapAddressPicker
                      lat={latitude}
                      lng={longitude}
                      onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                      height="180px"
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Pagamento - oculto em pedidos de mesa */}
        {!isTableOrder && (
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardHeader className="pb-2 px-4 pt-3">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('checkout.payment')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="gap-2">
              <div className={`flex items-center gap-3 border p-3 rounded-xl transition-all touch-manipulation active:scale-[0.98] cursor-pointer ${paymentMethod === PaymentMethod.PIX ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 active:bg-slate-50'}`}>
                <RadioGroupItem value={PaymentMethod.PIX} id="pix" className="h-4 w-4 shrink-0" />
                <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer w-full font-semibold text-sm">
                  <Smartphone className="h-4 w-4 text-emerald-500 flex-shrink-0" /> PIX
                </Label>
              </div>
              <div className={`flex items-center gap-3 border p-3 rounded-xl transition-all touch-manipulation active:scale-[0.98] cursor-pointer ${paymentMethod === PaymentMethod.CARD ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 active:bg-slate-50'}`}>
                <RadioGroupItem value={PaymentMethod.CARD} id="card" className="h-4 w-4 shrink-0" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer w-full font-semibold text-sm">
                  <CreditCard className="h-4 w-4 text-blue-500 flex-shrink-0" /> {t('checkout.cardOnDelivery')}
                </Label>
              </div>
              <div className={`flex flex-col gap-2 border p-3 rounded-xl transition-all ${paymentMethod === PaymentMethod.CASH ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 touch-manipulation active:scale-[0.98] cursor-pointer">
                  <RadioGroupItem value={PaymentMethod.CASH} id="cash" className="h-4 w-4 shrink-0" />
                  <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer w-full font-semibold text-sm">
                    <Banknote className="h-4 w-4 text-green-600 flex-shrink-0" /> {t('checkout.cash')}
                  </Label>
                </div>
                {paymentMethod === PaymentMethod.CASH && (
                  <div className="pl-7">
                    <Label className="text-xs text-slate-500">{t('checkout.changeFor')} ({currency === 'PYG' ? t('checkout.changeForGuarani') : t('checkout.changeForReal')})</Label>
                    <Input 
                      placeholder="Ex: 50.000" 
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      className="mt-1.5 bg-white h-10 text-base touch-manipulation"
                    />
                  </div>
                )}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
        )}

        {/* Observações - oculto em pedidos de mesa */}
        {!isTableOrder && (
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('checkout.notesLabel')}</Label>
          <Input 
            id="notes" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder={t('checkout.notesPlaceholder')} 
            className="bg-white border-slate-200 h-11 text-base touch-manipulation"
          />
        </div>
        )}

        {/* ── Fidelidade: progresso + badge de resgate ── */}
        {!isTableOrder && loyaltyStatus?.enabled && (
          <div className="space-y-2">
            {loyaltyRedeemed ? (
              <div className="rounded-xl border border-yellow-400 bg-yellow-50 px-4 py-3 flex items-center gap-2.5">
                <Gift className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-yellow-700">{t('loyalty.redemptionLabel')}</p>
                  <p className="text-xs text-yellow-600">{loyaltyStatus.reward_description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLoyaltyRedeemed(false)}
                  className="ml-auto text-xs text-muted-foreground underline"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <LoyaltyCard status={loyaltyStatus} />
            )}
          </div>
        )}

        {/* Resumo e Botão Finalizar */}
        <Card className="border-0 shadow-lg bg-white rounded-xl">
          <CardContent className="pt-4 px-4 pb-4 space-y-3">
            {!isTableOrder && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('checkout.subtotal')}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal, currency)}</span>
              </div>
              {deliveryType === DeliveryType.DELIVERY && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{t('checkout.deliveryFee')}</span>
                  <span className="font-semibold text-red-600">{formatCurrency(deliveryFee, currency)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-base font-bold border-t border-slate-200 pt-2.5">
                <span className="text-slate-900">{t('checkout.total')}</span>
                <span className="text-slate-900">{formatCurrency(total, currency)}</span>
              </div>
            </div>
            )}
            
            <Button 
              size="lg" 
              className={`w-full font-bold h-12 rounded-xl shadow-lg flex items-center justify-center gap-2 text-base touch-manipulation active:scale-[0.98] ${
                isTableOrder
                  ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white'
                  : 'bg-[#25D366] hover:bg-[#1ebc57] active:bg-[#1aa34a] text-white'
              }`}
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  {t('checkout.sending')}
                </span>
              ) : isTableOrder ? (
                <>
                  <span>Fazer Pedido</span>
                  <Send className="h-4 w-4 flex-shrink-0" />
                </>
              ) : (
                <>
                  <span>{t('checkout.sendWhatsApp')}</span>
                  <Send className="h-4 w-4 flex-shrink-0" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* ── Dialog de Resgate de Fidelidade ── */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {t('loyalty.redeemTitle')}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {t('loyalty.redeemDesc', {
                count: loyaltyStatus?.orders_required ?? 0,
                reward: loyaltyStatus?.reward_description ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex justify-center">
            <Gift className="h-14 w-14 text-yellow-500 animate-bounce" />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:brightness-105 text-white font-bold h-11 rounded-xl shadow-lg"
              onClick={async () => {
                setLoyaltyRedeemed(true);
                setShowRedeemDialog(false);
                toast({ title: t('loyalty.redeemSuccess'), description: t('loyalty.redeemSuccessDesc', { reward: loyaltyStatus?.reward_description ?? '' }) });
                // Continuar com o pedido
                await handleCheckout();
              }}
            >
              {t('loyalty.redeemYes')}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={async () => {
                setShowRedeemDialog(false);
                // Continuar sem resgatar
                await handleCheckout();
              }}
            >
              {t('loyalty.redeemNo')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}