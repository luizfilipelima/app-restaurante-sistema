import { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { supabase } from '@/lib/core/supabase';
import { getSubdomain } from '@/lib/core/subdomain';
import { PaymentMethod, DeliveryType } from '@/types';
import type { LoyaltyStatus } from '@/types';
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
import { useSharingMeta } from '@/hooks/shared/useSharingMeta';
import { generateWhatsAppLink, normalizePhoneWithCountryCode, isWithinOpeningHours, isWithinDeliveryHours, getBankAccountForCurrency, hasBankAccountData, formatBankAccountLines, getWaiterTipForSector, type WaiterTipSector } from '@/lib/core/utils';
import { convertBetweenCurrencies, formatPrice, type CurrencyCode } from '@/lib/priceHelper';
import { processTemplate, getTemplate } from '@/lib/whatsapp/whatsappTemplates';
import i18n, { setStoredMenuLanguage, getStoredMenuLanguage, hasStoredMenuLanguage, type MenuLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Bike, Store, Smartphone, CreditCard, Banknote,
  Send, Trash2, MapPin, Map, Gift, Minus, Plus,
  User, StickyNote, Check, X as XIcon, ShoppingBag,
  QrCode, Landmark, Info, Copy, AlertCircle, Ticket, Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/shared/use-toast';
import { fetchLoyaltyStatus, redeemLoyalty, useDeliveryZones, useDeliveryDistanceTiers, useHasActiveCoupons, validateCoupon, updateTableCustomerNameFn } from '@/hooks/queries';
import { getDeliveryFeeByDistance } from '@/lib/geo/geo';

const MapAddressPreview = lazy(() => import('@/components/public/map/MapAddressPreview'));
const MapAddressPicker = lazy(() => import('@/components/public/map/MapAddressPicker'));
const MapAddressOverlay = lazy(() => import('@/components/public/map/MapAddressOverlay'));
import LoyaltyCard from '@/components/public/loyalty/LoyaltyCard';

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
  const { items, restaurantId, addItem, updateQuantity, removeItem, getSubtotal, clearCart, orderNotes, setOrderNotes, markTableItemsAsOrdered } = useCartStore();
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
  const exchangeRates = (currentRestaurant as { exchange_rates?: { pyg_per_brl?: number; ars_per_brl?: number; usd_per_brl?: number } })?.exchange_rates ?? { pyg_per_brl: 3600, ars_per_brl: 1150, usd_per_brl: 0.18 };
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
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [loyaltyRedeemed, setLoyaltyRedeemed] = useState(false);

  // ── Mesa ──
  const [searchParams] = useSearchParams();
  const tableIdFromUrl = searchParams.get('tableId');
  const tableNumberFromUrl = searchParams.get('tableNumber');
  const { tableId: tableIdStore, tableNumber: tableNumberStore, tableCustomerName, clearTable, setTable } = useTableOrderStore();
  const tableId = tableIdFromUrl || tableIdStore;
  const tableNumber = tableNumberFromUrl ? parseInt(tableNumberFromUrl, 10) : tableNumberStore;
  const isTableOrder = !!(tableId && tableNumber);

  useEffect(() => {
    if (isTableOrder && tableId && tableNumber != null && !tableIdStore) {
      setTable(tableId, tableNumber);
    }
  }, [isTableOrder, tableId, tableNumber, tableIdStore, setTable]);

  // Persistir nome do cliente na mesa no servidor (debounced) para aparecer no painel do garçom em tempo real
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isTableOrder || !tableId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      updateTableCustomerNameFn({ tableId, customerName: tableCustomerName }).catch(() => {});
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [isTableOrder, tableId, tableCustomerName]);

  // ── Entrega ──
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.DELIVERY);
  const { data: rawZones = [] } = useDeliveryZones(restaurantId ?? null);
  const { data: tiersData = [] } = useDeliveryDistanceTiers(restaurantId ?? null);
  const tiers = tiersData ?? [];
  const { data: hasActiveCoupons = false } = useHasActiveCoupons(restaurantId ?? null);
  const r = currentRestaurant as {
    delivery_zones_enabled?: boolean | null;
    delivery_zones_mode?: 'disabled' | 'zones' | 'kilometers' | null;
    restaurant_lat?: number | null;
    restaurant_lng?: number | null;
  };
  const mode = r?.delivery_zones_mode ?? (r?.delivery_zones_enabled === false ? 'disabled' : 'zones');
  const deliveryZonesEnabled = mode !== 'disabled';
  const zones = deliveryZonesEnabled && mode === 'zones' ? rawZones.filter((z) => z.is_active) : [];
  const restaurantLat = r?.restaurant_lat != null ? Number(r.restaurant_lat) : null;
  const restaurantLng = r?.restaurant_lng != null ? Number(r.restaurant_lng) : null;
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [zoneSelectKey, setZoneSelectKey] = useState(0); // Força remount do Select ao alterar zona (workaround Radix em mobile)
  const [latitude, setLatitude] = useState<number>(-25.5278);
  const [longitude, setLongitude] = useState<number>(-54.5828);
  const [addressDetails, setAddressDetails] = useState('');
  const [addressText, setAddressText] = useState('');
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const locationFromStorage = useRef(false);
  const prevZoneIdRef = useRef<string | null>(null);

  // ── Pagamento ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState(() => orderNotes ?? '');
  const [loading, setLoading] = useState(false);

  const [pixCopied, setPixCopied] = useState(false);
  const [bankCopied, setBankCopied] = useState(false);

  // ── Cupom de desconto ──
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // ── Feedback inline (substitui toasts) ──
  const [formError, setFormError] = useState<string | null>(null);

  const isSubdomain = subdomain && !['app', 'www', 'localhost'].includes(subdomain);
  const geoStorageKey = `checkout_geo_${restaurantId || 'default'}`;

  // ── Efeitos ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(geoStorageKey);
      if (saved) {
        const data = JSON.parse(saved) as { lat?: number; lng?: number; details?: string; addressText?: string };
        if (data.lat != null && data.lng != null) {
          setLatitude(data.lat);
          setLongitude(data.lng);
          locationFromStorage.current = true;
          setMapKey((k) => k + 1);
        }
        if (data.details) setAddressDetails(data.details);
        if (data.addressText) setAddressText(data.addressText);
      }
    } catch { /* ignore */ }
  }, [restaurantId, geoStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(geoStorageKey, JSON.stringify({ lat: latitude, lng: longitude, details: addressDetails, addressText }));
    } catch { /* ignore */ }
  }, [latitude, longitude, addressDetails, addressText, geoStorageKey]);

  // Centraliza o mapa: modo quilometragem sem local salvo → restaurante; caso contrário → default por moeda
  useEffect(() => {
    if (locationFromStorage.current) return;
    if (mode === 'kilometers' && restaurantLat != null && restaurantLng != null) {
      setLatitude(restaurantLat);
      setLongitude(restaurantLng);
      setMapKey((k) => k + 1);
      return;
    }
    const [lat, lng] = getDefaultCenter(baseCurrency);
    setLatitude(lat);
    setLongitude(lng);
    setMapKey((k) => k + 1);
  }, [baseCurrency, mode, restaurantLat, restaurantLng]);

  // Quando o cliente TROCA de zona (não quando zones refetch), centraliza o mapa
  useEffect(() => {
    if (!selectedZoneId) {
      prevZoneIdRef.current = null;
      return;
    }
    if (prevZoneIdRef.current === selectedZoneId) return;
    prevZoneIdRef.current = selectedZoneId;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (zone?.center_lat != null && zone?.center_lng != null) {
      setLatitude(zone.center_lat);
      setLongitude(zone.center_lng);
    }
  }, [selectedZoneId, zones]);

  // Prefetch do overlay/mapa quando entrega for selecionada (carrega chunk antes do mapa aparecer)
  useEffect(() => {
    if (!isTableOrder && deliveryType === DeliveryType.DELIVERY) {
      import('@/components/public/map/MapAddressOverlay');
      import('@/components/public/map/MapAddressPreview');
      import('@/components/public/map/MapAddressPicker');
    }
  }, [isTableOrder, deliveryType]);

  useEffect(() => {
    if (!restaurantId) return;
    try {
      const savedPhone = localStorage.getItem(`checkout_phone_${restaurantId}`);
      const savedName = localStorage.getItem(`checkout_name_${restaurantId}`);
      const savedCountry = localStorage.getItem(`checkout_phone_country_${restaurantId}`) as 'BR' | 'PY' | 'AR' | null;
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedName) setCustomerName(savedName);
      if (savedCountry && ['BR', 'PY', 'AR'].includes(savedCountry)) setPhoneCountry(savedCountry);
    } catch { /* ignore */ }
  }, [restaurantId]);

  // Cartão e QR Code só na retirada — ao mudar para delivery, trocar para PIX
  useEffect(() => {
    if (deliveryType === DeliveryType.DELIVERY && (paymentMethod === PaymentMethod.CARD || paymentMethod === PaymentMethod.QRCODE)) {
      setPaymentMethod(PaymentMethod.PIX);
    }
  }, [deliveryType]);

  // Se o método atual foi desativado pelo restaurante, seleciona o primeiro disponível
  useEffect(() => {
    if (isTableOrder) return;
    const enabledList = deliveryType === DeliveryType.DELIVERY
      ? ((currentRestaurant as { payment_methods_enabled_delivery?: string[] | null })?.payment_methods_enabled_delivery ?? null)
      : ((currentRestaurant as { payment_methods_enabled_local?: string[] | null })?.payment_methods_enabled_local ?? null);
    const isAllowed = (m: PaymentMethod) => !enabledList || enabledList.includes(m);
    const pickupOnly = (m: PaymentMethod) => m === PaymentMethod.CARD || m === PaymentMethod.QRCODE;
    const candidates: PaymentMethod[] = [PaymentMethod.PIX, PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.QRCODE];
    const valid = candidates.filter((m) => isAllowed(m) && (deliveryType === DeliveryType.PICKUP || !pickupOnly(m)));
    if (valid.length > 0 && !valid.includes(paymentMethod)) {
      setPaymentMethod(valid[0]);
    }
  }, [deliveryType, paymentMethod, isTableOrder, currentRestaurant]);

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

  const handleMapLocationChange = useCallback((lat: number, lng: number) => {
    locationFromStorage.current = true;
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const handleMapOverlayConfirm = useCallback((lat: number, lng: number, addrText?: string) => {
    handleMapLocationChange(lat, lng);
    if (addrText != null) setAddressText(addrText);
    setShowMapOverlay(false);
    setMapKey((k) => k + 1);
  }, [handleMapLocationChange]);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code || !restaurantId) return;
    setCouponError(null);
    setValidatingCoupon(true);
    try {
      const result = await validateCoupon(restaurantId, code, subtotal);
      if (result.valid && result.coupon && result.discountAmount != null) {
        setAppliedCoupon({ id: result.coupon.id, code: result.coupon.code, discountAmount: result.discountAmount });
        setCouponCode('');
      } else {
        setCouponError(result.error ?? 'Cupom inválido');
      }
    } catch {
      setCouponError('Erro ao validar cupom');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const handleBackToMenu = () => {
    if (isTableOrder && isSubdomain) navigate(`/cardapio/${tableNumber}`);
    else if (isTableOrder && restaurantSlug) navigate(`/${restaurantSlug}/cardapio/${tableNumber}`);
    else if (isSubdomain) navigate('/');
    else navigate(`/${restaurantSlug}`);
  };


  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const isKilometersMode = mode === 'kilometers';
  const kmDeliveryResult = isKilometersMode && restaurantLat != null && restaurantLng != null && tiers.length > 0
    ? getDeliveryFeeByDistance(restaurantLat, restaurantLng, latitude, longitude, tiers.map((t) => ({ km_min: Number(t.km_min), km_max: t.km_max != null ? Number(t.km_max) : null, fee: t.fee })))
    : null;
  const deliveryFee = deliveryType === DeliveryType.DELIVERY
    ? (isKilometersMode ? (kmDeliveryResult?.fee ?? 0) : (selectedZone?.fee || 0))
    : 0;
  const isOutsideDeliveryArea = isKilometersMode && kmDeliveryResult === null && restaurantLat != null && restaurantLng != null && tiers.length > 0;
  const subtotal = getSubtotal();
  const sector: WaiterTipSector = isTableOrder ? 'table' : (deliveryType === DeliveryType.DELIVERY ? 'delivery' : 'pickup');
  const printSettings = (currentRestaurant as { print_settings_by_sector?: import('@/types').PrintSettingsBySector })?.print_settings_by_sector;
  const { amount: waiterTipAmount, pct: waiterTipPct } = getWaiterTipForSector(subtotal, sector, printSettings);
  const couponsEnabled = (currentRestaurant as { discount_coupons_enabled?: boolean | null })?.discount_coupons_enabled !== false;
  const showCouponCard = couponsEnabled && hasActiveCoupons;
  const discountAmount = showCouponCard ? (appliedCoupon?.discountAmount ?? 0) : 0;
  const total = Math.max(0, subtotal + deliveryFee + waiterTipAmount - discountAmount);
  const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const hasLoyaltyItemInCart = items.some((i) => i.isLoyaltyReward === true);
  const canAddLoyaltyReward =
    loyaltyStatus?.enabled &&
    (loyaltyStatus.points ?? 0) >= (loyaltyStatus.orders_required ?? 0) &&
    !!loyaltyStatus.reward_product_id &&
    !!loyaltyStatus.reward_product_name &&
    !hasLoyaltyItemInCart;

  useEffect(() => {
    if (!hasLoyaltyItemInCart && loyaltyRedeemed && loyaltyStatus?.reward_product_id) {
      setLoyaltyRedeemed(false);
    }
  }, [hasLoyaltyItemInCart, loyaltyStatus?.reward_product_id]);

  const handleAddLoyaltyReward = () => {
    if (!loyaltyStatus?.reward_product_id || !loyaltyStatus?.reward_product_name) return;
    addItem({
      productId: loyaltyStatus.reward_product_id,
      productName: loyaltyStatus.reward_product_name,
      quantity: 1,
      unitPrice: 0,
      isLoyaltyReward: true,
    });
    setLoyaltyRedeemed(true);
  };

  const handleRemoveLoyaltyReward = () => {
    const index = items.findIndex((i) => i.isLoyaltyReward === true);
    if (index >= 0) removeItem(index);
    setLoyaltyRedeemed(false);
  };

  const handleCheckout = async () => {
    setFormError(null);
    const tableName = (tableCustomerName ?? '').trim() || null;
    if (isTableOrder && !tableName) {
      setFormError('Informe seu nome para identificar seu pedido na divisão da conta.');
      return;
    }
    const nameToUse = isTableOrder ? (tableName ?? `Mesa ${tableNumber}`) : customerName;
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
        const normalized = normalizePhoneWithCountryCode(customerPhone, phoneCountry);
        localStorage.setItem(`checkout_phone_${restaurantId}`, normalized);
        localStorage.setItem(`checkout_name_${restaurantId}`, customerName);
        localStorage.setItem(`checkout_phone_country_${restaurantId}`, phoneCountry);
      } catch { /* ignore */ }
    }

    if (!isTableOrder && loyaltyStatus?.enabled && (loyaltyStatus.points ?? 0) >= (loyaltyStatus.orders_required ?? 0) && !loyaltyRedeemed && !loyaltyStatus.reward_product_id) {
      setShowRedeemDialog(true);
      return;
    }

    if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && mode === 'zones' && zones.length > 0 && !selectedZoneId) {
      setFormError(t('checkout.errorSelectZone'));
      return;
    }

    if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && isKilometersMode && isOutsideDeliveryArea) {
      setFormError('Sua localização está fora da área de entrega.');
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
      if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && !isWithinDeliveryHours(currentRestaurant)) {
        setFormError(t('checkout.errorDeliveryClosed'));
        return;
      }
      // Valor mínimo para delivery (só quando ativado)
      const minOrderEnabled = (currentRestaurant as { delivery_min_order_enabled?: boolean | null })?.delivery_min_order_enabled === true;
      const minOrderValue = (currentRestaurant as { delivery_min_order_value?: number | null })?.delivery_min_order_value ?? 0;
      if (!isTableOrder && deliveryType === DeliveryType.DELIVERY && minOrderEnabled && minOrderValue > 0 && subtotal < minOrderValue) {
        setFormError(t('checkout.errorMinOrderDelivery', { min: formatPrice(minOrderValue, baseCurrency) }));
        return;
      }
    }

    // Constrói o link do WhatsApp ANTES do await para poder abrir a aba de forma síncrona.
    // Browsers bloqueiam window.open chamado após await; abrir wa.me diretamente na gesture
    // do usuário tem mais chance de sucesso do que abrir janela em branco.
    const finalDeliveryType = isTableOrder ? DeliveryType.PICKUP : deliveryType;
    const finalDeliveryFee = isTableOrder ? 0 : deliveryFee;
    const finalDiscount = showCouponCard ? (appliedCoupon?.discountAmount ?? 0) : 0;
    const finalTotal = Math.max(0, subtotal + finalDeliveryFee + waiterTipAmount - finalDiscount);

    let whatsappWin: Window | null = null;
    if (!isTableOrder && currentRestaurant) {
      const itemsText = items.map((i) => {
        const itemTotal =
          i.unitPrice * i.quantity +
          (i.pizzaEdgePrice ?? 0) * i.quantity +
          (i.pizzaDoughPrice ?? 0) * i.quantity;
        const addonsStr = i.addons && i.addons.length > 0
          ? ' + ' + i.addons.map((a) => {
              const qty = a.quantity ?? 1;
              const addonTotal = (a.price ?? 0) * qty;
              const label = qty > 1 ? `${a.name} (${qty}x)` : a.name;
              return label + (addonTotal > 0 ? ` (+${formatPrice(addonTotal, baseCurrency)})` : '');
            }).join(', ')
          : '';
        return `  • ${i.quantity}x ${i.productName}${i.pizzaSize ? ` (${i.pizzaSize})` : ''}${addonsStr} — ${formatPrice(itemTotal, baseCurrency)}`;
      }).join('\n');
      const bairro = deliveryType === DeliveryType.DELIVERY && mode === 'zones' && selectedZoneId
        ? (zones.find((z) => z.id === selectedZoneId)?.location_name ?? '')
        : '';
      const endereco = deliveryType === DeliveryType.DELIVERY && (zones.length > 0 || isKilometersMode)
        ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        : '';
      const trocoRaw = paymentMethod === PaymentMethod.CASH && changeFor ? changeFor.replace(/\D/g, '') : '';
      const trocoFormatted = trocoRaw ? formatPrice(parseInt(trocoRaw, 10), baseCurrency) : '';
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
      const taxaLine = deliveryFee > 0 ? `Taxa entrega: ${formatPrice(deliveryFee, baseCurrency)}` : '';
      const waiterTipLine = waiterTipAmount > 0 ? `Taxa garçom (${waiterTipPct}%): ${formatPrice(waiterTipAmount, baseCurrency)}` : '';
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
        detalhes_endereco: deliveryType === DeliveryType.DELIVERY
          ? (zones.length > 0 || isKilometersMode ? (addressDetails?.trim() ?? '') : 'Localização a ser enviada via WhatsApp após o pedido')
          : '',
        pagamento:         paymentLabel,
        pagamento_detalhes: pagamentoDetalhes,
        pix_restaurante:   (currentRestaurant?.pix_key || '').trim() || undefined,
        conta_restaurante: contaRest || undefined,
        troco:             trocoFormatted,
        subtotal:          formatPrice(subtotal, baseCurrency),
        taxa_entrega:      taxaLine,
        taxa_garcom:       waiterTipLine,
        total:             formatPrice(total, baseCurrency),
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
        delivery_zone_id: finalDeliveryType === DeliveryType.DELIVERY && mode === 'zones' ? (selectedZoneId || null) : null,
        delivery_address:
          finalDeliveryType === DeliveryType.DELIVERY
            ? (zones.length > 0 || isKilometersMode ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : 'A definir via WhatsApp')
            : null,
        latitude: finalDeliveryType === DeliveryType.DELIVERY && (zones.length > 0 || isKilometersMode) ? latitude : null,
        longitude: finalDeliveryType === DeliveryType.DELIVERY && (zones.length > 0 || isKilometersMode) ? longitude : null,
        address_details: finalDeliveryType === DeliveryType.DELIVERY
          ? (zones.length === 0 && !isKilometersMode ? 'Localização a ser enviada via WhatsApp após o pedido' : (addressDetails.trim() || null))
          : null,
        delivery_fee: finalDeliveryFee,
        subtotal,
        total: finalTotal,
        discount_coupon_id: showCouponCard ? (appliedCoupon?.id ?? null) : null,
        discount_amount: finalDiscount,
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

      const customerNameForItems = isTableOrder ? (tableName ?? null) : null;
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
          customer_name: customerNameForItems,
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
        // Pedido de mesa — marca itens como já pedidos (ficam visíveis até conta fechada/mesa resetada)
        whatsappWin?.close();
        markTableItemsAsOrdered();
        toast({ title: t('checkout.tableOrderSuccess'), variant: 'default' });
        setTimeout(() => handleBackToMenu(), 1200);
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6 safe-area-inset-bottom">
        <div className="text-center space-y-5">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('checkout.emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">Adicione itens ao carrinho para continuar</p>
          </div>
          <Button
            onClick={handleBackToMenu}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 px-8 font-semibold touch-manipulation"
          >
            {t('checkout.backToMenu')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Labels de moeda ──
  const currencyLabel = (c: CurrencyCode) =>
    c === 'BRL' ? 'R$ Real' : c === 'PYG' ? 'Gs. Guaraní' : c === 'ARS' ? 'ARS Peso' : 'US$ Dólar';

  const phonePlaceholder =
    phoneCountry === 'BR' ? '(11) 99999-9999'
    : phoneCountry === 'PY' ? '981 123 456'
    : '11 15 1234-5678';

  const phoneFlagLabel =
    phoneCountry === 'BR' ? '🇧🇷' : phoneCountry === 'PY' ? '🇵🇾' : '🇦🇷';

  return (
    <div className="min-h-screen bg-background safe-area-inset-bottom">

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-30 bg-transparent backdrop-blur-sm border-b border-border/80 safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted active:scale-95 transition-all touch-manipulation flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {currentRestaurant?.logo ? (
            <img src={currentRestaurant.logo} width={32} height={32} className="h-8 w-8 rounded-lg object-cover flex-shrink-0" alt="" />
          ) : currentRestaurant?.name ? (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary-foreground">{currentRestaurant.name[0].toUpperCase()}</span>
            </div>
          ) : null}

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-tight truncate">
              {isTableOrder ? `Mesa ${tableNumber}` : t('checkout.title')}
            </h1>
            {currentRestaurant?.name && (
              <p className="text-xs text-muted-foreground truncate leading-tight">{currentRestaurant.name}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-primary tabular-nums">{totalItemCount}</span>
          </div>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="max-w-xl mx-auto px-4 pt-4 pb-[105px] space-y-4">

        {/* ── 1. Sacola ── */}
        <div className="relative z-10 bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-card-foreground">Sua sacola</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="divide-y divide-border/50">
            {items.map((item, index) => {
              const itemTotal =
                item.unitPrice * item.quantity +
                (item.pizzaEdgePrice ?? 0) * item.quantity +
                (item.pizzaDoughPrice ?? 0) * item.quantity;
              const unitDisplay = convertForDisplay(item.unitPrice + (item.pizzaEdgePrice ?? 0) + (item.pizzaDoughPrice ?? 0));

              return (
                <div key={index} className="flex items-start gap-3 px-4 py-3.5">
                  {/* Emoji/avatar */}
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-xl mt-0.5">
                    {item.isPizza ? '🍽️' : item.isMarmita ? '🍱' : '🍽️'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-tight">{item.productName}</p>

                    {(item.pizzaSize || item.pizzaFlavors?.length) && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {[item.pizzaSize, item.pizzaFlavors?.join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.marmitaSize && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {[item.marmitaSize, item.marmitaProteins?.join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        + {item.addons.map((a) => ((a.quantity ?? 1) > 1 ? `${a.name} (${a.quantity}x)` : a.name)).join(', ')}
                      </p>
                    )}
                    {item.observations && (
                      <p className="text-xs text-primary mt-0.5 italic line-clamp-1">📝 {item.observations}</p>
                    )}

                    {/* Controles de quantidade */}
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        className={`h-7 w-7 rounded-lg border flex items-center justify-center active:scale-90 transition-all touch-manipulation ${
                          item.quantity <= 1
                            ? 'border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                        aria-label={item.quantity <= 1 ? 'Remover item' : 'Diminuir quantidade'}
                      >
                        {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>

                      <span className="text-sm font-bold text-foreground w-6 text-center tabular-nums select-none">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary active:scale-90 transition-all touch-manipulation"
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Preço */}
                  {!isTableOrder && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-1">
                      <span className={`text-sm font-bold tabular-nums ${item.isLoyaltyReward ? 'text-warning' : 'text-foreground'}`}>
                        {item.isLoyaltyReward ? t('checkout.free') : formatPrice(convertForDisplay(itemTotal), displayCurrency)}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatPrice(unitDisplay, displayCurrency)} cada
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Mesa badge + Nome do cliente ── */}
        {isTableOrder && (
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-warning/10 border border-warning/30">
              <div className="h-9 w-9 rounded-xl bg-warning/20 flex items-center justify-center flex-shrink-0">
                <Store className="h-[18px] w-[18px] text-warning" />
              </div>
              <div>
                <p className="text-sm font-bold text-warning">Mesa {tableNumber}</p>
                <p className="text-xs text-warning">Pedido vai direto para a cozinha</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold text-card-foreground">Seu nome (divisão da conta)</span>
              </div>
              <div className="p-4">
                <div className="h-12 px-4 flex items-center rounded-xl bg-muted/60 border border-border text-base font-medium text-foreground">
                  {tableCustomerName?.trim() || (
                    <span className="text-muted-foreground italic">Informe seu nome no cardápio antes de finalizar</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Nome definido ao entrar no cardápio da mesa. Para alterar, volte ao cardápio.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. Tipo de entrega (não-mesa) ── */}
        {!isTableOrder && (
          <div className="relative z-10 flex gap-2">
            {[
              { type: DeliveryType.DELIVERY, icon: Bike, label: t('checkout.delivery') },
              { type: DeliveryType.PICKUP, icon: Store, label: t('checkout.pickup') },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setDeliveryType(type)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 font-semibold text-sm transition-all touch-manipulation active:scale-[0.98] ${
                  deliveryType === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-muted'
                }`}
              >
                <Icon className={`h-5 w-5 ${deliveryType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── 3. Dados do cliente (não-mesa) ── */}
        {!isTableOrder && (
          <div className="relative z-10 bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">Seus dados</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  {t('checkout.yourName')}
                </Label>
                <Input
                  id="name"
                  data-testid="checkout-name"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setFormError(null); }}
                  placeholder={t('checkout.namePlaceholder')}
                  autoComplete="name"
                  className="h-12 text-base bg-muted border-border rounded-xl focus:bg-background"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  {t('checkout.phoneLabel')}
                </Label>
                <div className="flex gap-2">
                  <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR' | 'PY' | 'AR')}>
                    <SelectTrigger className="w-[66px] h-12 shrink-0 bg-muted border-border rounded-xl px-2 justify-center gap-0">
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
                    className="flex-1 h-12 text-base bg-muted border-border rounded-xl focus:bg-background"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. Zona de entrega (modo zonas) — apenas quando zonas ativas ── */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && mode === 'zones' && zones.length > 0 && (
          <div className="relative z-10 bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border overflow-hidden rounded-t-2xl">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Map className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">{t('checkout.zoneLabel')}</span>
              {selectedZoneId && (
                <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
              )}
            </div>
            <div className="p-4">
              <div key={zoneSelectKey} className="space-y-2">
                <Select
                  value={selectedZoneId || undefined}
                  onValueChange={(v) => {
                    setSelectedZoneId(v);
                    setFormError(null);
                  }}
                >
                  <SelectTrigger data-testid="checkout-zone-select" className="h-auto min-h-12 py-3 bg-muted border-border rounded-xl text-base focus:bg-background w-full [&>span]:block [&>span]:whitespace-normal [&>span]:text-left [&>span]:break-words">
                    <SelectValue placeholder={t('checkout.zonePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="z-[100]">
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        <div className="flex items-center justify-between gap-6 w-full">
                          <span>{zone.location_name}</span>
                          <span className="text-muted-foreground text-xs font-semibold">
                            {zone.fee === 0 ? t('checkout.free') : formatPrice(convertForDisplay(zone.fee), displayCurrency)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedZoneId && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoneSelectKey((k) => k + 1);
                      setSelectedZoneId('');
                    }}
                    className="text-xs text-primary hover:text-primary/90 font-medium touch-manipulation"
                  >
                    {t('checkout.changeZone')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 4b. Card informativo quando zonas desativadas (envio de localização via WhatsApp) ── */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && mode === 'disabled' && (
          <div className="relative z-10 bg-card rounded-2xl shadow-sm overflow-hidden border border-warning/30 bg-warning/5">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-warning/20">
              <div className="h-6 w-6 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
                <Info className="h-3.5 w-3.5 text-warning" />
              </div>
              <span className="text-sm font-semibold text-warning">Localização e frete</span>
            </div>
            <div className="p-4">
              <p className="text-sm text-warning leading-relaxed flex items-start gap-2">
                <MapPin className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                {t('checkout.zonesDisabledInfo')}
              </p>
            </div>
          </div>
        )}

        {/* ── 4c. Modo quilometragem não configurado ── */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && mode === 'kilometers' && (tiers.length === 0 || restaurantLat == null || restaurantLng == null) && (
          <div className="relative z-10 bg-card rounded-2xl shadow-sm overflow-hidden border border-amber-200 bg-amber-50/50">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-200">
              <div className="h-6 w-6 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
                <Info className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <span className="text-sm font-semibold text-amber-800">Entrega por quilometragem</span>
            </div>
            <div className="p-4">
              <p className="text-sm text-amber-800 leading-relaxed">
                O restaurante ainda está configurando a entrega por distância. Entre em contato ou aguarde a conclusão da configuração.
              </p>
            </div>
          </div>
        )}

        {/* ── 5. Endereço de entrega com mapa — zonas: após zona selecionada; quilometragem: direto ── */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && ((mode === 'zones' && zones.length > 0 && selectedZoneId) || (mode === 'kilometers' && tiers.length > 0 && restaurantLat != null && restaurantLng != null)) && (
          <div className="relative z-10 bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="h-6 w-6 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">Endereço de entrega</span>
              {addressDetails.trim() && (
                <Check className="h-4 w-4 text-success ml-auto flex-shrink-0" />
              )}
              {isKilometersMode && kmDeliveryResult != null && (
                <span className="text-xs text-muted-foreground ml-auto">
                  ~{kmDeliveryResult.distanceKm.toFixed(1)} km
                </span>
              )}
            </div>

            <div className="p-4 space-y-4">
              {isOutsideDeliveryArea && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Sua localização está fora da área de entrega. Toque em &quot;Ajustar no mapa&quot; para posicionar.
                </div>
              )}

              {/* Modo zonas: bloco informativo; modo quilometragem: botão que abre overlay */}
              {mode === 'zones' && selectedZone ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-border bg-muted/60">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                      Área de entrega
                    </p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {selectedZone.location_name}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMapOverlay(true)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-border bg-muted/60 hover:bg-muted transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                      Endereço no mapa
                    </p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {addressText || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
                    </p>
                  </div>
                </button>
              )}

              {/* Modo zonas: mapa arrastável (sem busca de endereço). Modo quilometragem: miniatura não interativa. */}
              {mode === 'zones' && selectedZone ? (
                <Suspense fallback={<Skeleton className="h-[256px] w-full rounded-xl" />}>
                  <MapAddressPicker
                    key={mapKey}
                    lat={latitude}
                    lng={longitude}
                    onLocationChange={handleMapLocationChange}
                    zoneCenterLat={selectedZone.center_lat != null ? Number(selectedZone.center_lat) : undefined}
                    zoneCenterLng={selectedZone.center_lng != null ? Number(selectedZone.center_lng) : undefined}
                    zoneRadiusMeters={selectedZone.radius_meters != null ? Number(selectedZone.radius_meters) : undefined}
                    height="256px"
                  />
                </Suspense>
              ) : (
                (() => {
                  const centerLat = isKilometersMode && restaurantLat != null
                    ? restaurantLat
                    : latitude;
                  const centerLng = isKilometersMode && restaurantLng != null
                    ? restaurantLng
                    : longitude;
                  const hasValidCoords = Number.isFinite(centerLat) && Number.isFinite(centerLng);
                  if (!hasValidCoords) return <Skeleton className="h-[120px] w-full rounded-xl" />;
                  return (
                    <Suspense fallback={<Skeleton className="h-[120px] w-full rounded-xl" />}>
                      <MapAddressPreview
                        key={mapKey}
                        lat={latitude}
                        lng={longitude}
                        restaurantLat={isKilometersMode && restaurantLat != null ? restaurantLat : undefined}
                        restaurantLng={isKilometersMode && restaurantLng != null ? restaurantLng : undefined}
                        height="120px"
                      />
                    </Suspense>
                  );
                })()
              )}

              {isKilometersMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMapOverlay(true)}
                  className="w-full h-12 rounded-xl font-semibold border-2"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Ajustar no mapa
                </Button>
              )}

              {/* Complemento / Referência */}
              <div>
                <Label htmlFor="addressDetails" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Complemento / Referência
                </Label>
                <Input
                  id="addressDetails"
                  value={addressDetails}
                  onChange={(e) => { setAddressDetails(e.target.value); setFormError(null); }}
                  placeholder="Apto, Bloco, Casa, Ponto de referência... (opcional)"
                  className="h-12 bg-muted border-border rounded-xl text-base focus:bg-background"
                />
              </div>
            </div>
          </div>
        )}

        {/* MapAddressOverlay — bottom sheet para definir localização (apenas modo quilometragem; em zonas não permite ajuste) */}
        {!isTableOrder && deliveryType === DeliveryType.DELIVERY && isKilometersMode && tiers.length > 0 && restaurantLat != null && restaurantLng != null && (
          <Suspense fallback={null}>
            <MapAddressOverlay
              open={showMapOverlay}
              onClose={() => setShowMapOverlay(false)}
              onConfirm={handleMapOverlayConfirm}
              initialLat={latitude}
              initialLng={longitude}
              addressText={addressText}
              restaurantLat={restaurantLat ?? undefined}
              restaurantLng={restaurantLng ?? undefined}
            />
          </Suspense>
        )}

        {/* ── 6. Pagamento (não-mesa) ── */}
        {!isTableOrder && (
          <div className="relative z-20 bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">{t('checkout.payment')}</span>

              {paymentCurrencies.length > 1 && (
                <div className="ml-auto flex gap-1 p-0.5 bg-muted rounded-lg">
                  {paymentCurrencies.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPaymentCurrency(c)}
                      className={`px-2 py-1 rounded-md text-xs font-bold transition-all touch-manipulation ${
                        displayCurrency === c ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={currencyLabel(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 space-y-2">
              {(() => {
                const baseOptions = [
                  { value: PaymentMethod.PIX, icon: Smartphone, label: 'PIX', desc: 'Envie o comprovante após confirmar', pickupOnly: false },
                  { value: PaymentMethod.BANK_TRANSFER, icon: Landmark, label: 'Transferência Bancária', desc: displayCurrency === 'PYG' ? 'Banco, titular, alias' : displayCurrency === 'ARS' ? 'Banco, agência, conta' : 'Disponível em Guaraní ou Peso', pickupOnly: false },
                  { value: PaymentMethod.CASH, icon: Banknote, label: t('checkout.cash'), desc: 'Pague na entrega / retirada', pickupOnly: false },
                  { value: PaymentMethod.CARD, icon: CreditCard, label: t('checkout.cardOnDelivery'), desc: 'Débito ou crédito na retirada', pickupOnly: true },
                  { value: PaymentMethod.QRCODE, icon: QrCode, label: 'QR Code', desc: 'Na retirada', pickupOnly: true },
                ];
                const enabledByMode = deliveryType === DeliveryType.DELIVERY
                  ? (currentRestaurant as { payment_methods_enabled_delivery?: string[] | null } | undefined)?.payment_methods_enabled_delivery ?? null
                  : (currentRestaurant as { payment_methods_enabled_local?: string[] | null } | undefined)?.payment_methods_enabled_local ?? null;
                const isMethodEnabled = (value: PaymentMethod) => {
                  if (!enabledByMode) return true;
                  return enabledByMode.includes(value);
                };
                return baseOptions
                  .filter((o) => !o.pickupOnly || deliveryType === DeliveryType.PICKUP)
                  .filter((o) => isMethodEnabled(o.value))
                  .map(({ value, icon: Icon, label, desc }) => (
                    <div key={value}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod(value)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all touch-manipulation active:scale-[0.99] ${
                          paymentMethod === value ? 'border-primary bg-primary/10' : 'border-border bg-muted/60 hover:border-border'
                        }`}
                      >
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-semibold ${paymentMethod === value ? 'text-primary' : 'text-foreground'}`}>{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          paymentMethod === value ? 'border-primary bg-primary' : 'border-border'
                        }`}>
                          {paymentMethod === value && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </button>

                      {value === PaymentMethod.PIX && paymentMethod === PaymentMethod.PIX && (
                        <div className="mt-2 px-1">
                          {currentRestaurant?.pix_key ? (
                            <div className="p-3 rounded-xl bg-success/10 border border-success/30">
                              <p className="text-xs font-semibold text-success mb-1.5">Envie o PIX para:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm font-mono text-foreground break-all bg-card/80 px-2.5 py-2 rounded-lg border border-success/20">
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
                                  className="flex-shrink-0 h-10 w-10 rounded-lg bg-success hover:bg-success/90 text-success-foreground flex items-center justify-center transition-colors touch-manipulation"
                                  title="Copiar chave PIX"
                                >
                                  {pixCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                                </button>
                              </div>
                              <p className="text-xs text-foreground mt-2">Após enviar o pedido no WhatsApp, envie o comprovante de pagamento.</p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/20">
                              <Info className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-warning">
                                O restaurante ainda não configurou a chave PIX. Após enviar o pedido no WhatsApp, envie o comprovante informando o valor.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {value === PaymentMethod.BANK_TRANSFER && paymentMethod === PaymentMethod.BANK_TRANSFER && (displayCurrency === 'PYG' || displayCurrency === 'ARS') && (
                        <div className="mt-2 px-1 space-y-2">
                          {bankAccountSnapshot && hasBankAccountData(bankAccountSnapshot) ? (
                            <div className="p-3 rounded-xl bg-info/10 border border-info/30">
                              <p className="text-xs font-semibold text-foreground mb-2">
                                Envie a transferência para{displayCurrency === 'PYG' ? ' (Guaraní)' : ' (Peso Argentino)'}:
                              </p>
                              <div className="space-y-1.5 text-sm text-foreground">
                                {formatBankAccountLines(bankAccountSnapshot).map((line) => {
                                  const idx = line.indexOf(': ');
                                  const label = idx >= 0 ? line.slice(0, idx) : line;
                                  const value = idx >= 0 ? line.slice(idx + 2) : '';
                                  return (
                                    <p key={label}><span className="text-foreground">{label}:</span> {value}</p>
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
                                className="mt-2 flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/90 transition-colors touch-manipulation"
                              >
                                {bankCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {bankCopied ? 'Copiado!' : 'Copiar dados'}
                              </button>
                              <p className="text-xs text-foreground mt-2">Após enviar o pedido no WhatsApp, envie o comprovante de transferência.</p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/20">
                              <Info className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-foreground">
                                O restaurante ainda não configurou os dados bancários. Entre em contato pelo WhatsApp.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {value === PaymentMethod.QRCODE && paymentMethod === PaymentMethod.QRCODE && (
                        <div className="mt-2 px-1">
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/20">
                            <Info className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground">Pague via QR Code no momento da retirada.</p>
                          </div>
                        </div>
                      )}

                      {value === PaymentMethod.CASH && paymentMethod === PaymentMethod.CASH && (
                        <div className="mt-2 px-1">
                          <Label className="text-xs text-muted-foreground mb-1.5 block">
                            {t('checkout.changeFor')}
                          </Label>
                          <Input
                            placeholder={displayCurrency === 'PYG' ? 'Ex: 100.000' : 'Ex: 100,00'}
                            value={changeFor}
                            onChange={(e) => setChangeFor(e.target.value)}
                            className="h-11 bg-background border-border rounded-xl text-base"
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
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <StickyNote className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">{t('checkout.notesLabel')}</span>
              <span className="text-xs text-muted-foreground ml-1">• opcional</span>
            </div>
            <div className="p-4">
              <textarea
                value={notes}
                onChange={(e) => { const v = e.target.value; setNotes(v); setOrderNotes(v); }}
                placeholder={t('checkout.notesPlaceholder')}
                rows={3}
                className="w-full bg-muted border border-border rounded-xl p-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── 7. Cupom de desconto (apenas quando habilitado e existe ao menos um cupom ativo) ── */}
        {showCouponCard && (
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Ticket className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">{t('checkout.couponLabel')}</span>
              <span className="text-xs text-muted-foreground ml-1">• opcional</span>
            </div>
            <div className="p-4">
              {appliedCoupon ? (
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-success/10 border border-success/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-success flex items-center gap-2">
                      <Check className="h-4 w-4 text-success flex-shrink-0" />
                      {t('checkout.couponApplied')} — {appliedCoupon.code}
                    </p>
                    <p className="text-xs text-success mt-0.5">
                      {t('checkout.discount')}: {formatPrice(convertForDisplay(appliedCoupon.discountAmount), displayCurrency)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1.5 rounded-lg text-success hover:bg-success/20 transition-colors touch-manipulation flex-shrink-0"
                    aria-label={t('checkout.couponRemove')}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    placeholder={t('checkout.couponPlaceholder')}
                    className="flex-1 h-12 text-base bg-muted border-border rounded-xl focus:bg-background uppercase placeholder:normal-case"
                    disabled={validatingCoupon}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || validatingCoupon}
                    className="shrink-0"
                  >
                    {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : t('checkout.couponApply')}
                  </Button>
                </div>
              )}
              {couponError && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {couponError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── 8. Fidelidade ── */}
        {!isTableOrder && loyaltyStatus?.enabled && (
          hasLoyaltyItemInCart ? (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-warning/10 border border-warning/30">
              <Gift className="h-5 w-5 text-warning flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-warning">{t('loyalty.redemptionLabel')}</p>
                <p className="text-xs text-warning truncate">
                  {loyaltyStatus.reward_product_name ?? loyaltyStatus.reward_description} {t('loyalty.addedToOrder')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveLoyaltyReward}
                className="p-1.5 rounded-lg text-warning hover:bg-warning/20 transition-colors touch-manipulation flex-shrink-0"
                aria-label={t('loyalty.removeReward')}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : loyaltyRedeemed && !loyaltyStatus.reward_product_id ? (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-warning/10 border border-warning/30">
              <Gift className="h-5 w-5 text-warning flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-warning">{t('loyalty.redemptionLabel')}</p>
                <p className="text-xs text-warning truncate">{loyaltyStatus.reward_description}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoyaltyRedeemed(false)}
                className="p-1.5 rounded-lg text-warning hover:bg-warning/20 transition-colors touch-manipulation flex-shrink-0"
                aria-label="Cancelar resgate"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <LoyaltyCard status={loyaltyStatus} />
              {canAddLoyaltyReward && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 h-12 rounded-xl border-2 border-warning bg-warning/10 hover:bg-warning/20 text-warning font-semibold"
                  onClick={handleAddLoyaltyReward}
                >
                  <Gift className="h-5 w-5" />
                  {t('loyalty.addFreeReward', { name: loyaltyStatus.reward_product_name ?? loyaltyStatus.reward_description })}
                </Button>
              )}
            </div>
          )
        )}

        {/* ── 9. Resumo ── */}
        {!isTableOrder && (
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-card-foreground">Resumo do pedido</span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatPrice(convertForDisplay(subtotal), displayCurrency)}
                </span>
              </div>

              {deliveryType === DeliveryType.DELIVERY && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('checkout.deliveryFee')}</span>
                  {deliveryFee === 0 ? (
                    <span className="font-semibold text-success">
                      {(selectedZoneId || (isKilometersMode && kmDeliveryResult != null)) ? `${t('checkout.free')} 🎉` : '—'}
                    </span>
                  ) : (
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatPrice(convertForDisplay(deliveryFee), displayCurrency)}
                    </span>
                  )}
                </div>
              )}

              {waiterTipAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('checkout.waiterTip')}</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatPrice(convertForDisplay(waiterTipAmount), displayCurrency)} ({waiterTipPct}%)
                  </span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('checkout.discount')}</span>
                  <span className="font-semibold text-success tabular-nums">
                    − {formatPrice(convertForDisplay(discountAmount), displayCurrency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2.5 border-t border-border">
                <span className="font-bold text-foreground">{t('checkout.total')}</span>
                <span className="text-xl font-black text-foreground tabular-nums">
                  {formatPrice(convertForDisplay(total), displayCurrency)}
                </span>
              </div>

              {paymentCurrencies.length > 1 && displayCurrency !== baseCurrency && (
                <p className="text-[10px] text-muted-foreground text-right">
                  ≈ {formatPrice(total, baseCurrency)} (valor base)
                </p>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Barra de ação sticky ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-card/97 backdrop-blur-md border-t border-border px-4 pt-4 shadow-2xl shadow-black/10"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-xl mx-auto space-y-2.5">

          {/* Banner de erro inline */}
          {formError && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-medium leading-snug">{formError}</p>
              <button
                onClick={() => setFormError(null)}
                className="ml-auto p-0.5 text-destructive hover:text-destructive/90 transition-colors flex-shrink-0"
                aria-label="Fechar erro"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <Button
            size="lg"
            data-testid="checkout-submit"
            className={`w-full font-bold h-14 rounded-2xl shadow-lg flex items-center justify-center gap-[15px] px-5 text-base touch-manipulation active:scale-[0.98] transition-all ${
              isTableOrder
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'bg-[#25D366] hover:bg-[#1ebc57] active:bg-[#1aa34a] text-white dark:text-[hsl(var(--background))]'
            }`}
            onClick={handleCheckout}
            disabled={loading || (!isTableOrder && deliveryType === DeliveryType.DELIVERY && isKilometersMode && isOutsideDeliveryArea)}
          >
            {loading ? (
              <>
                <span className="h-5 w-5 border-2 border-white dark:border-[hsl(var(--background))] border-t-transparent rounded-full animate-spin" />
                <span>{t('checkout.sending')}</span>
              </>
            ) : (
              <>
                <span className="flex-1 text-left">
                  {isTableOrder ? 'Enviar pedido para a cozinha' : t('checkout.sendWhatsApp')}
                </span>
                {!isTableOrder && (
                  <span className="bg-white/20 dark:bg-[hsl(var(--background))]/30 px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums">
                    {formatPrice(convertForDisplay(total), displayCurrency)}
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
            <Gift className="h-14 w-14 text-warning animate-bounce" />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-bold h-12 rounded-xl shadow-lg"
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
