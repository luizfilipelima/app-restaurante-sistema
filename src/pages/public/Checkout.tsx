import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { supabase } from '@/lib/supabase';
import { getSubdomain } from '@/lib/subdomain';
import { PaymentMethod, DeliveryType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatCurrency, generateWhatsAppLink, normalizePhoneWithCountryCode, isWithinOpeningHours, getBankAccountForCurrency, hasBankAccountData, formatBankAccountLines } from '@/lib/utils';
import { convertBetweenCurrencies, type CurrencyCode } from '@/lib/priceHelper';
import { processTemplate, getTemplate } from '@/lib/whatsappTemplates';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Bike, Store, Smartphone, CreditCard, Banknote,
  Send, Trash2, MapPin, Map, Gift, Minus, Plus,
  User, StickyNote, Check, X as XIcon, ShoppingBag,
  QrCode, Landmark, Info, Copy, AlertCircle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchLoyaltyStatus, redeemLoyalty, useDeliveryZones } from '@/hooks/queries';

const MapAddressPicker = lazy(() => import('@/components/public/MapAddressPicker'));
import LoyaltyCard from '@/components/public/LoyaltyCard';

// Coordenadas padrão por moeda — Tríplice Fronteira
const GEO_DEFAULTS: Record<string, [number, number]> = {
  PYG: [-25.5097, -54.6111], // Ciudad del Este, PY
  ARS: [-25.5991, -54.5735], // Puerto Iguazú, AR
  BRL: [-25.5278, -54.5828], // Foz do Iguaçu, BR
};
function getDefaultCenter(currency: string): [number, number] {
  return GEO_DEFAULTS[currency] ?? GEO_DEFAULTS.BRL;
}

interface PublicCheckoutProps {
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
  const { items, restaurantId, updateQuantity, getSubtotal, clearCart, orderNotes, setOrderNotes } = useCartStore();
  const { t } = useTranslation();
  const { currentRestaurant } = useRestaurantStore();

  // ── Moeda / câmbio ──
  const rawCurrency = (currentRestaurant as { currency?: string })?.currency;
  const baseCurrency: CurrencyCode = ['BRL', 'PYG', 'ARS', 'USD'].includes(rawCurrency || '') ? (rawCurrency as CurrencyCode) : 'BRL';
  const paymentCurrencies: CurrencyCode[] = (() => {
    const arr = (currentRestaurant as { payment_currencies?: string[] })?.payment_currencies;
    if (!Array.isArray(arr) || arr.length === 0) return [baseCurrency];
    return arr.filter((c): c is CurrencyCode => ['BRL', 'PYG', 'ARS', 'USD'].includes(c));
  })();
  const exchangeRates = (currentRestaurant as { exchange_rates?: { pyg_per_brl?: number; ars_per_brl?: number } })?.exchange_rates ?? { pyg_per_brl: 3600, ars_per_brl: 1150 };
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>(baseCurrency);
  const displayCurrency = paymentCurrencies.includes(paymentCurrency) ? paymentCurrency : baseCurrency;
  const convertForDisplay = (value: number) =>
    displayCurrency === baseCurrency ? value : convertBetweenCurrencies(value, baseCurrency, displayCurrency, exchangeRates);
  const bankAccountSnapshot = getBankAccountForCurrency(currentRestaurant?.bank_account, displayCurrency);

  // ── Dados do cliente ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');

  // ── Fidelidade ──
  const [loyaltyStatus, setLoyaltyStatus] = useState<{ points: number; orders_required: number; reward_description: string; enabled: boolean; redeemed_count: number } | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [loyaltyRedeemed, setLoyaltyRedeemed] = useState(false);

  // ── Mesa ──
  const [searchParams] = useSearchParams();
  const tableIdFromUrl = searchParams.get('tableId');
  const tableNumberFromUrl = searchParams.get('tableNumber');
  const { tableId: tableIdStore, tableNumber: tableNumberStore, clearTable } = useTableOrderStore();
  const tableId = tableIdFromUrl || tableIdStore;
  const tableNumber = tableNumberFromUrl ? parseInt(tableNumberFromUrl, 10) : tableNumberStore;
  const isTableOrder = !!(tableId && tableNumber);

  // ── Entrega ──
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.DELIVERY);
  const { data: rawZones = [] } = useDeliveryZones(restaurantId ?? null);
  const zones = rawZones.filter((z) => z.is_active);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [latitude, setLatitude] = useState<number>(-25.5278);
  const [longitude, setLongitude] = useState<number>(-54.5828);
  const [addressDetails, setAddressDetails] = useState('');
  const [mapKey, setMapKey] = useState(0);
  const locationFromStorage = useRef(false);

  // ── Pagamento ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState(() => orderNotes ?? '');
  const [loading, setLoading] = useState(false);

  const [pixCopied, setPixCopied] = useState(false);
  const [bankCopied, setBankCopied] = useState(false);

  // ── Feedback inline (substitui toasts) ──
  const [formError, setFormError] = useState<string | null>(null);

  const isSubdomain = subdomain && !['app', 'www', 'localhost'].includes(subdomain);
  const geoStorageKey = `checkout_geo_${restaurantId || 'default'}`;

  // ── Efeitos ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(geoStorageKey);
      if (saved) {
        const data = JSON.parse(saved) as { lat?: number; lng?: number; details?: string };
        if (data.lat != null && data.lng != null) {
          setLatitude(data.lat);
          setLongitude(data.lng);
          locationFromStorage.current = true;
          setMapKey((k) => k + 1);
        }
        if (data.details) setAddressDetails(data.details);
      }
    } catch { /* ignore */ }
  }, [restaurantId, geoStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(geoStorageKey, JSON.stringify({ lat: latitude, lng: longitude, details: addressDetails }));
    } catch { /* ignore */ }
  }, [latitude, longitude, addressDetails, geoStorageKey]);

  // Centraliza o mapa pela moeda do restaurante quando não há posição salva
  useEffect(() => {
    if (locationFromStorage.current) return;
    const [lat, lng] = getDefaultCenter(baseCurrency);
    setLatitude(lat);
    setLongitude(lng);
    setMapKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCurrency]);

  // Quando o cliente seleciona ou troca de zona, centraliza o mapa no centro da nova zona
  useEffect(() => {
    if (!selectedZoneId) return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (zone?.center_lat != null && zone?.center_lng != null) {
      setLatitude(zone.center_lat);
      setLongitude(zone.center_lng);
      setMapKey((k) => k + 1);
    }
  }, [selectedZoneId, zones]);

  useEffect(() => {
    if (!restaurantId) return;
    try {
      const savedPhone = localStorage.getItem(`checkout_phone_${restaurantId}`);
      const savedName = localStorage.getItem(`checkout_name_${restaurantId}`);
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedName) setCustomerName(savedName);
    } catch { /* ignore */ }
  }, [restaurantId]);

  // Cartão e QR Code só na entrega — ao mudar para retirada, trocar para PIX
  useEffect(() => {
    if (deliveryType === DeliveryType.PICKUP && (paymentMethod === PaymentMethod.CARD || paymentMethod === PaymentMethod.QRCODE)) {
      setPaymentMethod(PaymentMethod.PIX);
    }
  }, [deliveryType]);

  useEffect(() => {
    const phone = customerPhone.replace(/\D/g, '');
    if (!restaurantId || phone.length < 8) { setLoyaltyStatus(null); return; }
    fetchLoyaltyStatus(restaurantId, customerPhone).then((s) => setLoyaltyStatus(s));
  }, [customerPhone, restaurantId]);


  useEffect(() => {
    if (!restaurantId || currentRestaurant?.id === restaurantId) return;
    const load = async () => {
      const { data } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single();
      if (data) {
        useRestaurantStore.getState().setCurrentRestaurant(data);
        const userHasChosen = hasStoredMenuLanguage();
        const lang: MenuLanguage = userHasChosen ? getStoredMenuLanguage() : (data.language === 'es' ? 'es' : 'pt');
        if (!userHasChosen) setStoredMenuLanguage(lang);
        i18n.changeLanguage(lang);
      }
    };
    load();
  }, [restaurantId, currentRestaurant?.id]);

  useEffect(() => {
    document.title = currentRestaurant?.name
      ? `${currentRestaurant.name} - ${t('checkout.title')}`
      : t('checkout.title');
  }, [currentRestaurant?.name, t]);

  useSharingMeta(currentRestaurant ? { name: currentRestaurant.name, logo: currentRestaurant.logo } : null);

  const handleBackToMenu = () => {
    if (isTableOrder && isSubdomain) navigate(`/cardapio/${tableNumber}`);
    else if (isTableOrder && restaurantSlug) navigate(`/${restaurantSlug}/cardapio/${tableNumber}`);
    else if (isSubdomain) navigate('/');
    else navigate(`/${restaurantSlug}`);
  };


  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const deliveryFee = deliveryType === DeliveryType.DELIVERY ? (selectedZone?.fee || 0) : 0;
  const subtotal = getSubtotal();
  const total = subtotal + deliveryFee;
  const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const handleCheckout = async () => {
    setFormError(null);
    const nameToUse = isTableOrder ? `Mesa ${tableNumber}` : customerName;
    const phoneToUse = isTableOrder
      ? ((currentRestaurant?.phone || '').replace(/\D/g, '').length >= 9
          ? (currentRestaurant?.phone || '0')
          : '0000000000')
      : customerPhone;

    if (!isTableOrder && (!customerName.trim() || !customerPhone.trim())) {
      setFormError(t('checkout.errorFillNamePhone'));
      return;
    }

    if (!isTableOrder && restaurantId) {
      try {
        localStorage.setItem(`checkout_phone_${restaurantId}`, customerPhone);
        localStorage.setItem(`checkout_name_${restaurantId}`, customerName);
      } catch { /* ignore */ }
    }

    if (!isTableOrder && loyaltyStatus?.enabled && loyaltyStatus.points >= loyaltyStatus.orders_required && !loyaltyRedeemed) {
      setShowRedeemDialog(true);
      return;
    }

    if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && zones.length > 0 && !selectedZoneId) {
      setFormError(t('checkout.errorSelectZone'));
      return;
    }

    if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && !addressDetails.trim()) {
      setFormError(t('checkout.errorFillAddressDetails'));
      return;
    }

    if (!restaurantId) {
      setFormError(t('checkout.errorInvalidCart'));
      handleBackToMenu();
      return;
    }

    if (currentRestaurant) {
      const hasHours = currentRestaurant.opening_hours && Object.keys(currentRestaurant.opening_hours).length > 0;
      const alwaysOpen = !!currentRestaurant.always_open;
      const isOpen = currentRestaurant.is_manually_closed
        ? false
        : alwaysOpen ? true
        : hasHours ? isWithinOpeningHours(currentRestaurant.opening_hours as Record<string, { open: string; close: string } | null>)
        : true;
      if (!isOpen) {
        setFormError(t('checkout.errorRestaurantClosed'));
        return;
      }
    }

    // Constrói o link do WhatsApp ANTES do await para poder abrir a aba de forma síncrona.
    // Browsers bloqueiam window.open chamado após await; abrir wa.me diretamente na gesture
    // do usuário tem mais chance de sucesso do que abrir janela em branco.
    const finalDeliveryType = isTableOrder ? DeliveryType.PICKUP : deliveryType;
    const finalDeliveryFee = isTableOrder ? 0 : deliveryFee;
    const finalTotal = subtotal + finalDeliveryFee;

    let whatsappWin: Window | null = null;
    if (!isTableOrder && currentRestaurant) {
      const itemsText = items.map((i) => {
        const itemTotal =
          i.unitPrice * i.quantity +
          (i.pizzaEdgePrice ?? 0) * i.quantity +
          (i.pizzaDoughPrice ?? 0) * i.quantity;
        const addonsStr = i.addons && i.addons.length > 0
          ? ' + ' + i.addons.map((a) => a.name + (a.price > 0 ? ` (+${formatCurrency(a.price, baseCurrency)})` : '')).join(', ')
          : '';
        return `  • ${i.quantity}x ${i.productName}${i.pizzaSize ? ` (${i.pizzaSize})` : ''}${addonsStr} — ${formatCurrency(itemTotal, baseCurrency)}`;
      }).join('\n');
      const bairro = deliveryType === DeliveryType.DELIVERY && selectedZoneId
        ? (zones.find((z) => z.id === selectedZoneId)?.location_name ?? '')
        : '';
      const endereco = deliveryType === DeliveryType.DELIVERY
        ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        : '';
      const trocoRaw = paymentMethod === PaymentMethod.CASH && changeFor ? changeFor.replace(/\D/g, '') : '';
      const trocoFormatted = trocoRaw ? formatCurrency(parseInt(trocoRaw, 10), baseCurrency) : '';
      const paymentLabels: Record<string, string> = {
        pix: 'PIX',
        card: 'Cartão na entrega',
        cash: 'Dinheiro',
        qrcode: 'QR Code na entrega',
        bank_transfer: 'Transferência Bancária',
      };
      const paymentLabel = paymentLabels[paymentMethod] ?? paymentMethod;
      let pagamentoDetalhes = '';
      if (paymentMethod === PaymentMethod.PIX || paymentMethod === PaymentMethod.QRCODE) {
        if (paymentMethod === PaymentMethod.PIX) pagamentoDetalhes = '📤 Cliente deve enviar o comprovante de pagamento PIX após confirmar o pedido.';
      }
      if (paymentMethod === PaymentMethod.BANK_TRANSFER && (displayCurrency === 'PYG' || displayCurrency === 'ARS') && bankAccountSnapshot && hasBankAccountData(bankAccountSnapshot)) {
        pagamentoDetalhes = formatBankAccountLines(bankAccountSnapshot).join(' | ');
      }
      const taxaLine = deliveryFee > 0 ? `Taxa entrega: ${formatCurrency(deliveryFee, baseCurrency)}` : '';
      const contaRest = bankAccountSnapshot && hasBankAccountData(bankAccountSnapshot)
        ? formatBankAccountLines(bankAccountSnapshot).join(' | ')
        : '';
      const restaurantTemplates = (currentRestaurant as { whatsapp_templates?: Record<string, string> | null })?.whatsapp_templates;
      const menuLang = getStoredMenuLanguage();
      const message = processTemplate(getTemplate('new_order', restaurantTemplates, menuLang), {
        cliente_nome:      customerName,
        cliente_telefone:  '+' + normalizePhoneWithCountryCode(customerPhone, phoneCountry),
        tipo_entrega:      deliveryType === DeliveryType.DELIVERY ? 'Entrega' : 'Retirada',
        bairro,
        endereco,
        detalhes_endereco: deliveryType === DeliveryType.DELIVERY ? (addressDetails?.trim() ?? '') : '',
        pagamento:         paymentLabel,
        pagamento_detalhes: pagamentoDetalhes,
        pix_restaurante:   (currentRestaurant?.pix_key || '').trim() || undefined,
        conta_restaurante: contaRest || undefined,
        troco:             trocoFormatted,
        subtotal:          formatCurrency(subtotal, baseCurrency),
        taxa_entrega:      taxaLine,
        total:             formatCurrency(total, baseCurrency),
        itens:             itemsText,
        observacoes:       notes?.trim() ?? '',
      });
      const restaurantWhatsApp = (currentRestaurant?.whatsapp || '').replace(/\D/g, '');
      const country = (currentRestaurant as { phone_country?: 'BR' | 'PY' })?.phone_country || 'BR';
      const prefix = country === 'PY' ? '595' : '55';
      let whatsappNumber: string;
      if (!restaurantWhatsApp || restaurantWhatsApp.length < 9) {
        const restaurantPhone = (currentRestaurant?.phone || '').replace(/\D/g, '');
        if (restaurantPhone && restaurantPhone.length >= 9) {
          const hasPhonePrefix = restaurantPhone.startsWith('55') || restaurantPhone.startsWith('595');
          whatsappNumber = hasPhonePrefix ? restaurantPhone : prefix + restaurantPhone;
        } else {
          throw new Error('WhatsApp do restaurante não configurado. Entre em contato com o estabelecimento.');
        }
      } else {
        const hasPrefix = restaurantWhatsApp.startsWith('55') || restaurantWhatsApp.startsWith('595');
        whatsappNumber = hasPrefix ? restaurantWhatsApp : prefix + restaurantWhatsApp;
      }
      const waLink = generateWhatsAppLink(whatsappNumber, message);
      whatsappWin = window.open(waLink, '_blank', 'noopener,noreferrer');
    }

    setLoading(true);

    try {
      const orderPayload = {
        restaurant_id: restaurantId,
        customer_name: nameToUse,
        customer_phone: normalizePhoneWithCountryCode(phoneToUse, phoneCountry),
        delivery_type: finalDeliveryType,
        delivery_zone_id: finalDeliveryType === DeliveryType.DELIVERY ? (selectedZoneId || null) : null,
        delivery_address:
          finalDeliveryType === DeliveryType.DELIVERY
            ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : null,
        latitude: finalDeliveryType === DeliveryType.DELIVERY ? latitude : null,
        longitude: finalDeliveryType === DeliveryType.DELIVERY ? longitude : null,
        address_details: finalDeliveryType === DeliveryType.DELIVERY && addressDetails.trim() ? addressDetails.trim() : null,
        delivery_fee: finalDeliveryFee,
        subtotal,
        total: finalTotal,
        payment_method: isTableOrder ? PaymentMethod.TABLE : paymentMethod,
        payment_change_for: isTableOrder ? null : (paymentMethod === PaymentMethod.CASH && changeFor ? (parseFloat(changeFor.replace(/\D/g, '')) || null) : null),
        payment_pix_key: null,
        payment_bank_account: !isTableOrder && paymentMethod === PaymentMethod.BANK_TRANSFER && (displayCurrency === 'PYG' || displayCurrency === 'ARS') && bankAccountSnapshot && hasBankAccountData(bankAccountSnapshot) ? bankAccountSnapshot : null,
        order_source: isTableOrder ? 'table' : (finalDeliveryType === DeliveryType.DELIVERY ? 'delivery' : 'pickup'),
        table_id: isTableOrder && tableId ? tableId : null,
        status: 'pending',
        notes: notes || null,
        is_paid: isTableOrder ? false : true,
        loyalty_redeemed: loyaltyRedeemed,
        customer_language: getStoredMenuLanguage(),
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
          addons: item.addons && item.addons.length > 0 ? item.addons : null,
        };
      });

      const { data: rpcResult, error: rpcError } = await supabase.rpc('place_order', {
        p_order: orderPayload,
        p_items: orderItemsPayload,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult?.ok) throw new Error(rpcResult?.error ?? 'Erro ao registrar pedido.');

      if (loyaltyRedeemed && restaurantId) {
        await redeemLoyalty(restaurantId, normalizePhoneWithCountryCode(customerPhone, phoneCountry));
        setLoyaltyRedeemed(false);
      }

      if (isTableOrder) clearTable();

      if (!isTableOrder) {
        clearCart();
        const newOrderId = (rpcResult as { order_id?: string })?.order_id;
        const orderType = finalDeliveryType === DeliveryType.DELIVERY ? 'delivery' : 'pickup';

        if (newOrderId) {
          sessionStorage.setItem(`order_just_placed_${newOrderId}`, '1');
          const confirmPath = isSubdomain
            ? `/order-confirmed?orderId=${encodeURIComponent(newOrderId)}&type=${orderType}`
            : `/${restaurantSlug}/order-confirmed?orderId=${encodeURIComponent(newOrderId)}&type=${orderType}`;
          navigate(confirmPath);
        } else {
          setTimeout(() => handleBackToMenu(), 800);
        }
      } else {
        // Pedido de mesa — não usa WhatsApp
        whatsappWin?.close();
        clearCart();
        setTimeout(() => handleBackToMenu(), 1500);
      }
    } catch (error: unknown) {
      // Fecha a aba em branco se o pedido falhou
      whatsappWin?.close();
      console.error('[Checkout] Erro ao finalizar pedido:', error);
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : t('checkout.errorGeneric');
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Carrinho vazio ──
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 safe-area-inset-bottom">
        <div className="text-center space-y-5">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="h-10 w-10 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t('checkout.emptyTitle')}</h2>
            <p className="text-sm text-slate-500 mt-1">Adicione itens ao carrinho para continuar</p>
          </div>
          <Button
            onClick={handleBackToMenu}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-12 px-8 font-semibold touch-manipulation"
          >
            {t('checkout.backToMenu')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Labels de moeda ──
  const currencyLabel = (c: CurrencyCode) =>
    c === 'BRL' ? 'R$ Real' : c === 'PYG' ? 'Gs. Guaraní' : c === 'ARS' ? 'ARS Peso' : 'USD';

  const phonePlaceholder =
    phoneCountry === 'BR' ? '(11) 99999-9999'
    : phoneCountry === 'PY' ? '981 123 456'
    : '11 15 1234-5678';

  const phoneFlagLabel =
    phoneCountry === 'BR' ? '🇧🇷' : phoneCountry === 'PY' ? '🇵🇾' : '🇦🇷';

  return (
    <div className="min-h-screen bg-slate-50 safe-area-inset-bottom">

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:scale-95 transition-all touch-manipulation flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {currentRestaurant?.logo ? (
            <img src={currentRestaurant.logo} width={32} height={32} className="h-8 w-8 rounded-lg object-cover flex-shrink-0" alt="" />
          ) : currentRestaurant?.name ? (
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">{currentRestaurant.name[0].toUpperCase()}</span>
            </div>
          ) : null}

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
              {isTableOrder ? `Mesa ${tableNumber}` : t('checkout.title')}
            </h1>
            {currentRestaurant?.name && (
              <p className="text-xs text-slate-400 truncate leading-tight">{currentRestaurant.name}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-orange-50 border border-orange-100 flex-shrink-0">
            <ShoppingBag className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-bold text-orange-600 tabular-nums">{totalItemCount}</span>
          </div>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="max-w-xl mx-auto px-4 pt-4 pb-36 space-y-4">

        {/* ── 1. Sacola ── */}
        <div className="relative z-10 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
            <div className="h-6 w-6 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Sua sacola</span>
            <span className="ml-auto text-xs text-slate-400">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="divide-y divide-slate-50">
            {items.map((item, index) => {
              const itemTotal =
                item.unitPrice * item.quantity +
                (item.pizzaEdgePrice ?? 0) * item.quantity +
                (item.pizzaDoughPrice ?? 0) * item.quantity;
              const unitDisplay = convertForDisplay(item.unitPrice + (item.pizzaEdgePrice ?? 0) + (item.pizzaDoughPrice ?? 0));

              return (
                <div key={index} className="flex items-start gap-3 px-4 py-3.5">
                  {/* Emoji/avatar */}
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100/60 flex items-center justify-center flex-shrink-0 text-xl mt-0.5">
                    {item.isPizza ? '🍕' : item.isMarmita ? '🍱' : '🍽️'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm leading-tight">{item.productName}</p>

                    {(item.pizzaSize || item.pizzaFlavors?.length) && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {[item.pizzaSize, item.pizzaFlavors?.join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.marmitaSize && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {[item.marmitaSize, item.marmitaProteins?.join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        + {item.addons.map((a) => a.name).join(', ')}
                      </p>
                    )}
                    {item.observations && (
                      <p className="text-xs text-orange-500 mt-0.5 italic line-clamp-1">📝 {item.observations}</p>
                    )}

                    {/* Controles de quantidade */}
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        className={`h-7 w-7 rounded-lg border flex items-center justify-center active:scale-90 transition-all touch-manipulation ${
                          item.quantity <= 1
                            ? 'border-red-200 text-red-400 hover:bg-red-50 hover:border-red-300'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                        aria-label={item.quantity <= 1 ? 'Remover item' : 'Diminuir quantidade'}
                      >
                        {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>

                      <span className="text-sm font-bold text-slate-900 w-6 text-center tabular-nums select-none">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 active:scale-90 transition-all touch-manipulation"
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Preço */}
                  {!isTableOrder && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-1">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatCurrency(convertForDisplay(itemTotal), displayCurrency)}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {formatCurrency(unitDisplay, displayCurrency)} cada
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Mesa badge ── */}
        {isTableOrder && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Store className="h-[18px] w-[18px] text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Mesa {tableNumber}</p>
              <p className="text-xs text-amber-700">Pedido vai direto para a cozinha</p>
            </div>
          </div>
        )}

        {/* ── 2. Tipo de entrega (não-mesa) ── */}
        {!isTableOrder && (
          <div className="relative z-10 flex gap-2">
            {[
              { type: DeliveryType.DELIVERY, icon: Bike, label: t('checkout.delivery'), sub: 'No seu endereço' },
              { type: DeliveryType.PICKUP, icon: Store, label: t('checkout.pickup'), sub: 'Retirar no local' },
            ].map(({ type, icon: Icon, label, sub }) => (
              <button
                key={type}
                onClick={() => setDeliveryType(type)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 font-semibold text-sm transition-all touch-manipulation active:scale-[0.98] ${
                  deliveryType === type
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${deliveryType === type ? 'text-orange-600' : 'text-slate-400'}`} />
                <span>{label}</span>
                <span className="text-[10px] font-normal opacity-70">{sub}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── 3. Dados do cliente (não-mesa) ── */}
        {!isTableOrder && (
          <div className="relative z-10 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="h-6 w-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">Seus dados</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  {t('checkout.yourName')}
                </Label>
                <Input
                  id="name"
                  data-testid="checkout-name"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setFormError(null); }}
                  placeholder={t('checkout.namePlaceholder')}
                  autoComplete="name"
                  className="h-12 text-base bg-slate-50 border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  {t('checkout.phoneLabel')}
                </Label>
                <div className="flex gap-2">
                  <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR' | 'PY' | 'AR')}>
                    <SelectTrigger className="w-[66px] h-12 shrink-0 bg-slate-50 border-slate-200 rounded-xl px-2 justify-center gap-0">
                      <span className="text-xl">{phoneFlagLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BR">🇧🇷 +55 (Brasil)</SelectItem>
                      <SelectItem value="PY">🇵🇾 +595 (Paraguay)</SelectItem>
                      <SelectItem value="AR">🇦🇷 +54 (Argentina)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    value={customerPhone}
                    onChange={(e) => { setCustomerPhone(e.target.value); setFormError(null); }}
                    data-testid="checkout-phone"
                    placeholder={phonePlaceholder}
                    className="flex-1 h-12 text-base bg-slate-50 border-slate-200 rounded-xl focus:bg-white"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. Zona de entrega (apenas delivery, não-mesa) ── */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && (
          <div className="relative z-10 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="h-6 w-6 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Map className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">{t('checkout.zoneLabel')}</span>
              {zones.length > 0 && selectedZoneId && (
                <Check className="h-4 w-4 text-teal-500 ml-auto flex-shrink-0" />
              )}
            </div>
            <div className="p-4">
              {zones.length > 0 ? (
                <Select
                  value={selectedZoneId || undefined}
                  onValueChange={(v) => {
                    setSelectedZoneId(v);
                    setFormError(null);
                  }}
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl text-sm focus:bg-white">
                    <SelectValue placeholder={t('checkout.zonePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        <div className="flex items-center justify-between gap-6 w-full">
                          <span>{zone.location_name}</span>
                          <span className="text-muted-foreground text-xs font-semibold">
                            {zone.fee === 0 ? t('checkout.free') : formatCurrency(convertForDisplay(zone.fee), displayCurrency)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-500">{t('checkout.zoneNoZones')}</p>
              )}
            </div>
          </div>
        )}

        {/* ── 5. Endereço de entrega com mapa — só aparece após selecionar zona (ou se não há zonas) ── */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && (zones.length === 0 || selectedZoneId) && (
          <div className="relative z-10 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="h-6 w-6 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3.5 w-3.5 text-green-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">Endereço de entrega</span>
              {addressDetails.trim() && (
                <Check className="h-4 w-4 text-green-500 ml-auto flex-shrink-0" />
              )}
            </div>

            <div className="p-4 space-y-3">
              {(() => {
                const centerLat = selectedZone?.center_lat != null ? Number(selectedZone.center_lat) : latitude;
                const centerLng = selectedZone?.center_lng != null ? Number(selectedZone.center_lng) : longitude;
                const hasValidCoords = Number.isFinite(centerLat) && Number.isFinite(centerLng);
                if (!hasValidCoords) return <Skeleton className="h-64 w-full rounded-xl" />;
                return (
                  <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
                    <MapAddressPicker
                      key={mapKey}
                      lat={latitude}
                      lng={longitude}
                      onLocationChange={(lat, lng) => {
                        locationFromStorage.current = true;
                        setLatitude(lat);
                        setLongitude(lng);
                      }}
                      height="256px"
                      zoneCenterLat={selectedZone?.center_lat != null ? Number(selectedZone.center_lat) : undefined}
                      zoneCenterLng={selectedZone?.center_lng != null ? Number(selectedZone.center_lng) : undefined}
                      zoneRadiusMeters={selectedZone?.radius_meters != null ? Number(selectedZone.radius_meters) : undefined}
                    />
                  </Suspense>
                );
              })()}

              {/* Complemento / Referência */}
              <div>
                <Label htmlFor="addressDetails" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Complemento / Referência <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addressDetails"
                  value={addressDetails}
                  onChange={(e) => { setAddressDetails(e.target.value); setFormError(null); }}
                  placeholder="Apto, Bloco, Casa, Ponto de referência..."
                  className="h-12 bg-slate-50 border-slate-200 rounded-xl text-base focus:bg-white"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Pagamento (não-mesa) ── */}
        {!isTableOrder && (
          <div className="relative z-20 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="h-6 w-6 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">{t('checkout.payment')}</span>

              {paymentCurrencies.length > 1 && (
                <div className="ml-auto flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                  {paymentCurrencies.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPaymentCurrency(c)}
                      className={`px-2 py-1 rounded-md text-xs font-bold transition-all touch-manipulation ${
                        displayCurrency === c ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title={currencyLabel(c)}
                    >
                      {c === 'BRL' ? 'R$' : c === 'PYG' ? 'Gs.' : 'ARS'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 space-y-2">
              {(() => {
                const baseOptions = [
                  { value: PaymentMethod.PIX, icon: Smartphone, label: 'PIX', desc: 'Envie o comprovante após confirmar', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', deliveryOnly: false },
                  { value: PaymentMethod.BANK_TRANSFER, icon: Landmark, label: 'Transferência Bancária', desc: displayCurrency === 'PYG' ? 'Banco, titular, alias' : displayCurrency === 'ARS' ? 'Banco, agência, conta' : 'Disponível em Guaraní ou Peso', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', deliveryOnly: false },
                  { value: PaymentMethod.CASH, icon: Banknote, label: t('checkout.cash'), desc: 'Pague na entrega / retirada', iconBg: 'bg-green-100', iconColor: 'text-green-600', deliveryOnly: false },
                  { value: PaymentMethod.CARD, icon: CreditCard, label: t('checkout.cardOnDelivery'), desc: 'Débito ou crédito na entrega', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', deliveryOnly: true },
                  { value: PaymentMethod.QRCODE, icon: QrCode, label: 'QR Code', desc: 'Na entrega', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', deliveryOnly: true },
                ];
                return baseOptions
                  .filter((o) => !o.deliveryOnly || deliveryType === DeliveryType.DELIVERY)
                  .map(({ value, icon: Icon, label, desc, iconBg, iconColor }) => (
                    <div key={value}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod(value)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all touch-manipulation active:scale-[0.99] ${
                          paymentMethod === value ? 'border-orange-500 bg-orange-50/70' : 'border-slate-100 bg-slate-50/60 hover:border-slate-200'
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-slate-900">{label}</p>
                          <p className="text-xs text-slate-400">{desc}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          paymentMethod === value ? 'border-orange-500 bg-orange-500' : 'border-slate-300'
                        }`}>
                          {paymentMethod === value && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>

                      {value === PaymentMethod.PIX && paymentMethod === PaymentMethod.PIX && (
                        <div className="mt-2 px-1">
                          {currentRestaurant?.pix_key ? (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                              <p className="text-xs font-semibold text-emerald-800 mb-1.5">Envie o PIX para:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm font-mono text-emerald-900 break-all bg-white/80 px-2.5 py-2 rounded-lg border border-emerald-100">
                                  {currentRestaurant.pix_key}
                                </code>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(currentRestaurant.pix_key!);
                                      setPixCopied(true);
                                      setTimeout(() => setPixCopied(false), 2000);
                                    } catch {
                                      // silencioso — botão mostra estado visual
                                    }
                                  }}
                                  className="flex-shrink-0 h-10 w-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors touch-manipulation"
                                  title="Copiar chave PIX"
                                >
                                  {pixCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                                </button>
                              </div>
                              <p className="text-xs text-emerald-700 mt-2">Após enviar o pedido no WhatsApp, envie o comprovante de pagamento.</p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                              <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800">
                                O restaurante ainda não configurou a chave PIX. Após enviar o pedido no WhatsApp, envie o comprovante informando o valor.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {value === PaymentMethod.BANK_TRANSFER && paymentMethod === PaymentMethod.BANK_TRANSFER && (displayCurrency === 'PYG' || displayCurrency === 'ARS') && (
                        <div className="mt-2 px-1 space-y-2">
                          {bankAccountSnapshot && hasBankAccountData(bankAccountSnapshot) ? (
                            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                              <p className="text-xs font-semibold text-indigo-800 mb-2">
                                Envie a transferência para{displayCurrency === 'PYG' ? ' (Guaraní)' : ' (Peso Argentino)'}:
                              </p>
                              <div className="space-y-1.5 text-sm text-indigo-900">
                                {formatBankAccountLines(bankAccountSnapshot).map((line) => {
                                  const idx = line.indexOf(': ');
                                  const label = idx >= 0 ? line.slice(0, idx) : line;
                                  const value = idx >= 0 ? line.slice(idx + 2) : '';
                                  return (
                                    <p key={label}><span className="text-indigo-600">{label}:</span> {value}</p>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const text = formatBankAccountLines(bankAccountSnapshot).join('\n');
                                  try {
                                    await navigator.clipboard.writeText(text);
                                    setBankCopied(true);
                                    setTimeout(() => setBankCopied(false), 2000);
                                  } catch {
                                    // silencioso — botão mostra estado visual
                                  }
                                }}
                                className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-700 hover:text-indigo-800 transition-colors touch-manipulation"
                              >
                                {bankCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {bankCopied ? 'Copiado!' : 'Copiar dados'}
                              </button>
                              <p className="text-xs text-indigo-700 mt-2">Após enviar o pedido no WhatsApp, envie o comprovante de transferência.</p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                              <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800">
                                O restaurante ainda não configurou os dados bancários. Entre em contato pelo WhatsApp.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {value === PaymentMethod.QRCODE && paymentMethod === PaymentMethod.QRCODE && (
                        <div className="mt-2 px-1">
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                            <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">Pague via QR Code no momento da entrega.</p>
                          </div>
                        </div>
                      )}

                      {value === PaymentMethod.CASH && paymentMethod === PaymentMethod.CASH && (
                        <div className="mt-2 px-1">
                          <Label className="text-xs text-slate-400 mb-1.5 block">
                            {t('checkout.changeFor')} em {displayCurrency === 'PYG' ? 'Guaraní' : displayCurrency === 'ARS' ? 'Peso Argentino' : 'Real'} — <span className="text-slate-300">opcional</span>
                          </Label>
                          <Input
                            placeholder={displayCurrency === 'PYG' ? 'Ex: 100.000' : 'Ex: 100,00'}
                            value={changeFor}
                            onChange={(e) => setChangeFor(e.target.value)}
                            className="h-11 bg-white border-slate-200 rounded-xl text-base"
                            inputMode="decimal"
                          />
                        </div>
                      )}
                    </div>
                  ));
              })()}
            </div>
          </div>
        )}

        {/* ── 6. Observações (não-mesa) ── */}
        {!isTableOrder && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="h-6 w-6 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <StickyNote className="h-3.5 w-3.5 text-yellow-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">{t('checkout.notesLabel')}</span>
              <span className="text-xs text-slate-300 ml-1">• opcional</span>
            </div>
            <div className="p-4">
              <textarea
                value={notes}
                onChange={(e) => { const v = e.target.value; setNotes(v); setOrderNotes(v); }}
                placeholder={t('checkout.notesPlaceholder')}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── 7. Fidelidade ── */}
        {!isTableOrder && loyaltyStatus?.enabled && (
          loyaltyRedeemed ? (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-300">
              <Gift className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">{t('loyalty.redemptionLabel')}</p>
                <p className="text-xs text-amber-700 truncate">{loyaltyStatus.reward_description}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoyaltyRedeemed(false)}
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition-colors touch-manipulation flex-shrink-0"
                aria-label="Cancelar resgate"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <LoyaltyCard status={loyaltyStatus} />
          )
        )}

        {/* ── 8. Resumo ── */}
        {!isTableOrder && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">Resumo do pedido</span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('checkout.subtotal')}</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatCurrency(convertForDisplay(subtotal), displayCurrency)}
                </span>
              </div>

              {deliveryType === DeliveryType.DELIVERY && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{t('checkout.deliveryFee')}</span>
                  {deliveryFee === 0 ? (
                    <span className="font-semibold text-emerald-600">
                      {selectedZoneId ? `${t('checkout.free')} 🎉` : '—'}
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {formatCurrency(convertForDisplay(deliveryFee), displayCurrency)}
                    </span>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                <span className="font-bold text-slate-900">{t('checkout.total')}</span>
                <span className="text-xl font-black text-slate-900 tabular-nums">
                  {formatCurrency(convertForDisplay(total), displayCurrency)}
                </span>
              </div>

              {paymentCurrencies.length > 1 && displayCurrency !== baseCurrency && (
                <p className="text-[10px] text-slate-400 text-right">
                  ≈ {formatCurrency(total, baseCurrency)} (valor base)
                </p>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Barra de ação sticky ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/97 backdrop-blur-md border-t border-slate-100 px-4 pt-3 shadow-2xl shadow-slate-900/10"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-xl mx-auto space-y-2.5">

          {/* Banner de erro inline */}
          {formError && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium leading-snug">{formError}</p>
              <button
                onClick={() => setFormError(null)}
                className="ml-auto p-0.5 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                aria-label="Fechar erro"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <Button
            size="lg"
            data-testid="checkout-submit"
            className={`w-full font-bold h-14 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 text-base touch-manipulation active:scale-[0.98] transition-all ${
              isTableOrder
                ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white'
                : 'bg-[#25D366] hover:bg-[#1ebc57] active:bg-[#1aa34a] text-white'
            }`}
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('checkout.sending')}</span>
              </>
            ) : (
              <>
                <span className="flex-1 text-left">
                  {isTableOrder ? 'Enviar pedido para a cozinha' : t('checkout.sendWhatsApp')}
                </span>
                {!isTableOrder && (
                  <span className="bg-white/20 px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums">
                    {formatCurrency(convertForDisplay(total), displayCurrency)}
                  </span>
                )}
                <Send className="h-4 w-4 flex-shrink-0" />
              </>
            )}
          </Button>

        </div>
      </div>

      {/* ── Dialog resgate de fidelidade ── */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{t('loyalty.redeemTitle')}</DialogTitle>
            <DialogDescription className="text-center pt-2">
              {t('loyalty.redeemDesc', {
                count: loyaltyStatus?.orders_required ?? 0,
                reward: loyaltyStatus?.reward_description ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 flex justify-center">
            <Gift className="h-14 w-14 text-yellow-500 animate-bounce" />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:brightness-105 text-white font-bold h-12 rounded-xl shadow-lg"
              onClick={async () => {
                setLoyaltyRedeemed(true);
                setShowRedeemDialog(false);
                await handleCheckout();
              }}
            >
              {t('loyalty.redeemYes')}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground h-11"
              onClick={async () => {
                setShowRedeemDialog(false);
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
