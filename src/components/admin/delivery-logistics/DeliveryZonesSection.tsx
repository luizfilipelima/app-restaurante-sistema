import { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { useRestaurant } from '@/hooks/queries';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import {
  useDeliveryZones,
  useDeliveryDistanceTiers,
  useCreateDeliveryDistanceTier,
  useUpdateDeliveryDistanceTier,
  useDeleteDeliveryDistanceTier,
} from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  convertPriceToStorage,
  convertPriceFromStorage,
  convertBetweenCurrencies,
  getCurrencySymbol,
  formatPrice,
  formatPriceInputPyG,
} from '@/lib/priceHelper';
import { reverseGeocode, formatAddressForDisplay } from '@/lib/geo/geocoding';
import type { CurrencyCode } from '@/lib/priceHelper';
import type { DeliveryZone, DeliveryDistanceTier } from '@/types';
import type { Restaurant } from '@/types';
import { Plus, Edit, Trash2, MapPin, Loader2, Gauge, MapPinned, Package } from 'lucide-react';
import { toast } from '@/hooks/shared/use-toast';

const ZoneRadiusMapEditor = lazy(() => import('@/components/admin/delivery-logistics/ZoneRadiusMapEditor'));
const RestaurantLocationMapEditor = lazy(() => import('@/components/admin/delivery-logistics/RestaurantLocationMapEditor'));

const RADIUS_MIN = 500;
const RADIUS_MAX = 10000;

const FEE_CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'BRL', label: 'R$' },
  { value: 'PYG', label: 'Gs.' },
  { value: 'ARS', label: '$' },
  { value: 'USD', label: 'US$' },
];

const GEO_DEFAULTS: Record<string, [number, number]> = {
  PYG: [-25.5097, -54.6111],
  ARS: [-25.5991, -54.5735],
  BRL: [-25.5278, -54.5828],
};

function getDefaultCenter(currency: string): [number, number] {
  return GEO_DEFAULTS[currency] ?? GEO_DEFAULTS.BRL;
}

const emptyForm = (baseCurrency: CurrencyCode) => ({
  location_name: '',
  feeInput: '0',
  centerLat: getDefaultCenter(baseCurrency)[0],
  centerLng: getDefaultCenter(baseCurrency)[1],
  radiusMeters: 2000,
});

type DeliveryMode = 'disabled' | 'zones' | 'kilometers';
type DeleteTarget = { type: 'zone'; id: string; name: string } | { type: 'tier'; id: string; label: string };

interface DeliveryZonesSectionProps {
  restaurantId: string | null;
  restaurant: Restaurant | null;
  baseCurrency: CurrencyCode;
}

export function DeliveryZonesSection({ restaurantId, restaurant, baseCurrency }: DeliveryZonesSectionProps) {
  const queryClient = useQueryClient();
  const { data: restaurantData } = useRestaurant(restaurantId);
  const { data: zonesData, isLoading: loading, refetch } = useDeliveryZones(restaurantId);
  const zones = zonesData ?? [];
  const { data: tiersData = [], refetch: refetchTiers } = useDeliveryDistanceTiers(restaurantId);
  const tiers = tiersData ?? [];
  const createTier = useCreateDeliveryDistanceTier(restaurantId, restaurant?.slug);
  const updateTier = useUpdateDeliveryDistanceTier(restaurantId, restaurant?.slug);
  const deleteTier = useDeleteDeliveryDistanceTier(restaurantId, restaurant?.slug);

  const restaurantWithMode = restaurantData as {
    delivery_zones_enabled?: boolean | null;
    delivery_zones_mode?: DeliveryMode | null;
    restaurant_lat?: number | null;
    restaurant_lng?: number | null;
  };
  const rawMode = restaurantWithMode?.delivery_zones_mode;
  const deliveryZonesMode: DeliveryMode =
    rawMode ?? (restaurantWithMode?.delivery_zones_enabled === false ? 'disabled' : 'zones');

  const paymentCurrencies = (restaurant as { payment_currencies?: string[] })?.payment_currencies;
  const feeCurrencyOptions: CurrencyCode[] = (() => {
    const arr =
      Array.isArray(paymentCurrencies) && paymentCurrencies.length > 0
        ? paymentCurrencies.filter((c): c is CurrencyCode => ['BRL', 'PYG', 'ARS', 'USD'].includes(c))
        : [baseCurrency];
    const seen = new Set<CurrencyCode>();
    const result: CurrencyCode[] = [];
    if (!seen.has(baseCurrency)) {
      seen.add(baseCurrency);
      result.push(baseCurrency);
    }
    arr.forEach((c) => {
      if (!seen.has(c as CurrencyCode)) {
        seen.add(c as CurrencyCode);
        result.push(c as CurrencyCode);
      }
    });
    return result.length > 0 ? result : [baseCurrency];
  })();

  const exchangeRates = (restaurant as { exchange_rates?: { pyg_per_brl?: number; ars_per_brl?: number } })?.exchange_rates ?? {
    pyg_per_brl: 3600,
    ars_per_brl: 1150,
  };

  const [zoneSheetOpen, setZoneSheetOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [feeCurrency, setFeeCurrency] = useState<CurrencyCode>(baseCurrency);
  const [formData, setFormData] = useState(() => emptyForm(baseCurrency));
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [restaurantLat, setRestaurantLat] = useState<number>(getDefaultCenter(baseCurrency)[0]);
  const [restaurantLng, setRestaurantLng] = useState<number>(getDefaultCenter(baseCurrency)[1]);
  const [savingRestaurantLocation, setSavingRestaurantLocation] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<DeliveryDistanceTier | null>(null);
  const [tierForm, setTierForm] = useState({ kmMin: '0', kmMax: '', feeInput: '0' });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restaurantAddress, setRestaurantAddress] = useState<string | null>(null);
  const [restaurantAddressLoading, setRestaurantAddressLoading] = useState(false);
  const [isEditingRestaurantLocation, setIsEditingRestaurantLocation] = useState(false);
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (restaurantWithMode?.restaurant_lat != null && restaurantWithMode?.restaurant_lng != null) {
      setRestaurantLat(Number(restaurantWithMode.restaurant_lat));
      setRestaurantLng(Number(restaurantWithMode.restaurant_lng));
    } else {
      const [lat, lng] = getDefaultCenter(baseCurrency);
      setRestaurantLat(lat);
      setRestaurantLng(lng);
    }
  }, [restaurantWithMode?.restaurant_lat, restaurantWithMode?.restaurant_lng, baseCurrency]);

  useEffect(() => {
    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = null;
    }
    const lat = restaurantLat;
    const lng = restaurantLng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setRestaurantAddress(null);
      return;
    }
    setRestaurantAddressLoading(true);
    reverseGeocodeTimerRef.current = setTimeout(() => {
      reverseGeocodeTimerRef.current = null;
      reverseGeocode(lat, lng)
        .then((result) => {
          setRestaurantAddress(result ? formatAddressForDisplay(result) || result.displayName : null);
        })
        .catch(() => setRestaurantAddress(null))
        .finally(() => setRestaurantAddressLoading(false));
    }, 600);
    return () => {
      if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
    };
  }, [restaurantLat, restaurantLng]);

  const resetZoneForm = useCallback(() => {
    setEditingZone(null);
    setFormData(emptyForm(baseCurrency));
    setFeeCurrency(baseCurrency);
    setZoneSheetOpen(false);
  }, [baseCurrency]);

  const openEditZone = useCallback(
    (zone: DeliveryZone) => {
      const [lat, lng] = getDefaultCenter(baseCurrency);
      setEditingZone(zone);
      setFormData({
        location_name: zone.location_name,
        feeInput: convertPriceFromStorage(zone.fee, baseCurrency),
        centerLat: zone.center_lat ?? lat,
        centerLng: zone.center_lng ?? lng,
        radiusMeters: zone.radius_meters ?? 2000,
      });
      setFeeCurrency(baseCurrency);
      setZoneSheetOpen(true);
    },
    [baseCurrency]
  );

  const openNewZone = useCallback(() => {
    resetZoneForm();
    setFormData(emptyForm(baseCurrency));
    setZoneSheetOpen(true);
  }, [baseCurrency, resetZoneForm]);

  const setDeliveryZonesMode = async (mode: DeliveryMode) => {
    if (!restaurantId || mode === deliveryZonesMode) return;
    setTogglingGlobal(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          delivery_zones_mode: mode,
          delivery_zones_enabled: mode !== 'disabled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      const labels: Record<DeliveryMode, string> = { disabled: 'Desativado', zones: 'Zonas', kilometers: 'Quilometragem' };
      toast({ title: `Modo: ${labels[mode]}` });
    } catch (err) {
      console.error('Erro ao alterar modo:', err);
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleSubmitZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const valueInFeeCurrency = convertPriceToStorage(formData.feeInput, feeCurrency);
    const feeInBase =
      feeCurrency === baseCurrency
        ? valueInFeeCurrency
        : convertBetweenCurrencies(valueInFeeCurrency, feeCurrency, baseCurrency, exchangeRates);
    try {
      const payload = {
        location_name: formData.location_name,
        fee: feeInBase,
        center_lat: formData.centerLat,
        center_lng: formData.centerLng,
        radius_meters: formData.radiusMeters,
      };
      if (editingZone) {
        const { error } = await supabase.from('delivery_zones').update(payload).eq('id', editingZone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('delivery_zones').insert({
          restaurant_id: restaurantId,
          ...payload,
          is_active: true,
        });
        if (error) throw error;
      }
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      resetZoneForm();
      refetch();
      toast({ title: editingZone ? 'Zona atualizada' : 'Zona criada' });
    } catch (error) {
      console.error('Erro ao salvar zona:', error);
      toast({ title: 'Erro ao salvar zona', variant: 'destructive' });
    }
  };

  const toggleZoneStatus = async (zoneId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('delivery_zones').update({ is_active: !isActive }).eq('id', zoneId);
      if (error) throw error;
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      refetch();
      toast({ title: isActive ? 'Zona desativada' : 'Zona ativada' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'zone') {
        const { error } = await supabase.from('delivery_zones').delete().eq('id', deleteTarget.id);
        if (error) throw error;
        invalidatePublicMenuCache(queryClient, restaurant?.slug);
        refetch();
        toast({ title: 'Zona excluída' });
      } else {
        await deleteTier.mutateAsync(deleteTarget.id);
        refetchTiers();
        toast({ title: 'Faixa excluída' });
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const saveRestaurantLocation = async () => {
    if (!restaurantId) return;
    const lat = Number(restaurantLat);
    const lng = Number(restaurantLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast({ title: 'Coordenadas inválidas', variant: 'destructive' });
      return;
    }
    setSavingRestaurantLocation(true);
    try {
      await supabase
        .from('restaurants')
        .update({
          restaurant_lat: lat,
          restaurant_lng: lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      if (restaurant?.slug) invalidatePublicMenuCache(queryClient, restaurant.slug);
      setIsEditingRestaurantLocation(false);
      toast({ title: 'Localização salva' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar localização', variant: 'destructive' });
    } finally {
      setSavingRestaurantLocation(false);
    }
  };

  const resetTierForm = useCallback(() => {
    setTierDialogOpen(false);
    setEditingTier(null);
    setTierForm({ kmMin: '0', kmMax: '', feeInput: '0' });
  }, []);

  const openEditTier = useCallback(
    (tier: DeliveryDistanceTier) => {
      setEditingTier(tier);
      setTierForm({
        kmMin: String(tier.km_min),
        kmMax: tier.km_max != null ? String(tier.km_max) : '',
        feeInput: convertPriceFromStorage(tier.fee, baseCurrency),
      });
      setFeeCurrency(baseCurrency);
      setTierDialogOpen(true);
    },
    [baseCurrency]
  );

  const openNewTier = useCallback(() => {
    setEditingTier(null);
    setTierForm({ kmMin: '0', kmMax: '', feeInput: '0' });
    setFeeCurrency(baseCurrency);
    setTierDialogOpen(true);
  }, [baseCurrency]);

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const kmMin = parseFloat(tierForm.kmMin.replace(',', '.'));
    const kmMax = tierForm.kmMax.trim() ? parseFloat(tierForm.kmMax.replace(',', '.')) : null;
    if (isNaN(kmMin) || kmMin < 0) {
      toast({ title: 'Km inicial inválido', variant: 'destructive' });
      return;
    }
    if (kmMax != null && (isNaN(kmMax) || kmMax <= kmMin)) {
      toast({ title: 'Km final deve ser maior que o inicial', variant: 'destructive' });
      return;
    }
    const valueInFee = convertPriceToStorage(tierForm.feeInput, feeCurrency);
    const feeInBase =
      feeCurrency === baseCurrency
        ? valueInFee
        : convertBetweenCurrencies(valueInFee, feeCurrency, baseCurrency, exchangeRates);
    try {
      if (editingTier) {
        await updateTier.mutateAsync({ id: editingTier.id, km_min: kmMin, km_max: kmMax, fee: feeInBase });
        toast({ title: 'Faixa atualizada' });
      } else {
        await createTier.mutateAsync({ km_min: kmMin, km_max: kmMax, fee: feeInBase });
        toast({ title: 'Faixa adicionada' });
      }
      resetTierForm();
      refetchTiers();
    } catch (err) {
      toast({ title: 'Erro ao salvar faixa', variant: 'destructive' });
    }
  };

  const getTierLabel = (tier: DeliveryDistanceTier) =>
    `${Number(tier.km_min)} km até ${tier.km_max != null ? `${Number(tier.km_max)} km` : '+'} → ${tier.fee === 0 ? 'Grátis' : formatPrice(tier.fee, baseCurrency)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={deliveryZonesMode} onValueChange={(v) => setDeliveryZonesMode(v as DeliveryMode)}>
        <TabsList className="grid w-full grid-cols-3 h-9 bg-muted/60">
          <TabsTrigger value="disabled" disabled={togglingGlobal} className="flex items-center gap-1.5 text-xs">
            {togglingGlobal && deliveryZonesMode === 'disabled' && <Loader2 className="h-3 w-3 animate-spin" />}
            <Package className="h-3.5 w-3.5" />
            Desativado
          </TabsTrigger>
          <TabsTrigger value="zones" disabled={togglingGlobal} className="flex items-center gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" />
            Zonas
          </TabsTrigger>
          <TabsTrigger value="kilometers" disabled={togglingGlobal} className="flex items-center gap-1.5 text-xs">
            <Gauge className="h-3.5 w-3.5" />
            Quilometragem
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disabled" className="mt-4">
          <div className="rounded-xl border border-border bg-muted/20 py-8 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              No checkout o cliente envia o endereço via WhatsApp. Ative Zonas ou Quilometragem para calcular frete.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="zones" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Cliente escolhe o bairro e vê a taxa.</p>
            <Button onClick={openNewZone} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Nova zona
            </Button>
          </div>
          {zones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-8 px-4 text-center">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Nenhuma zona cadastrada</p>
              <Button onClick={openNewZone} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar zona
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{zone.location_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {zone.fee === 0 ? 'Grátis' : formatPrice(zone.fee, baseCurrency)}
                      {!zone.is_active && ' · Inativa'}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleZoneStatus(zone.id, zone.is_active)}>
                      {zone.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditZone(zone)} title="Editar">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteTarget({ type: 'zone', id: zone.id, name: zone.location_name })}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kilometers" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/30 border-b border-border px-3 py-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <MapPinned className="h-3.5 w-3.5" />
                Localização do restaurante
              </p>
            </div>
            <div className="p-3 space-y-3">
              <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-lg" />}>
                <RestaurantLocationMapEditor
                  centerLat={restaurantLat}
                  centerLng={restaurantLng}
                  onCenterChange={(lat, lng) => {
                    setRestaurantLat(lat);
                    setRestaurantLng(lng);
                  }}
                  height="200px"
                  editable={isEditingRestaurantLocation}
                />
              </Suspense>
              <div className="min-h-[2rem] text-xs text-muted-foreground">
                {restaurantAddressLoading ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Buscando…</span>
                ) : restaurantAddress ? (
                  restaurantAddress
                ) : (
                  'Clique em "Editar" para definir o ponto no mapa.'
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={isEditingRestaurantLocation ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditingRestaurantLocation((v) => !v)}
                  disabled={savingRestaurantLocation}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  {isEditingRestaurantLocation ? 'Cancelar edição' : 'Editar'}
                </Button>
                <Button onClick={saveRestaurantLocation} disabled={savingRestaurantLocation} size="sm">
                  {savingRestaurantLocation && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Salvar localização
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/30 border-b border-border px-3 py-2 flex items-center justify-between">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                Faixas por distância
              </p>
              <Button variant="outline" size="sm" onClick={openNewTier} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Faixa
              </Button>
            </div>
            <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
              {tiers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Adicione faixas (ex: 0–2 km = R$ 5).</p>
              ) : (
                tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg bg-muted/20 text-sm"
                  >
                    <span className="truncate">{getTierLabel(tier)}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditTier(tier)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setDeleteTarget({ type: 'tier', id: tier.id, label: getTierLabel(tier) })}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheet: Nova/Editar Zona */}
      <Sheet open={zoneSheetOpen} onOpenChange={(o) => !o && resetZoneForm()}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle>{editingZone ? 'Editar zona' : 'Nova zona'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmitZone} className="pt-6 space-y-4">
            <div>
              <Label htmlFor="zone-location_name">Nome do bairro/região</Label>
              <Input
                id="zone-location_name"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                placeholder="Ex: Centro"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Label>Taxa</Label>
                {feeCurrencyOptions.length > 1 && (
                  <Select value={feeCurrency} onValueChange={(v) => setFeeCurrency(v as CurrencyCode)}>
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {feeCurrencyOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {FEE_CURRENCIES.find((x) => x.value === c)?.label ?? getCurrencySymbol(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Input
                type="text"
                inputMode="decimal"
                value={formData.feeInput}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    feeInput: feeCurrency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                  })
                }
                placeholder={feeCurrency === 'PYG' ? '0' : '0,00'}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Raio: {formData.radiusMeters >= 1000 ? `${(formData.radiusMeters / 1000).toFixed(1)} km` : `${formData.radiusMeters} m`}</Label>
              <Slider
                value={[formData.radiusMeters]}
                onValueChange={([v]) => setFormData({ ...formData, radiusMeters: v })}
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={100}
                className="mt-2"
              />
            </div>
            <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-lg" />}>
              <ZoneRadiusMapEditor
                centerLat={formData.centerLat}
                centerLng={formData.centerLng}
                radiusMeters={formData.radiusMeters}
                onCenterChange={(lat, lng) => setFormData({ ...formData, centerLat: lat, centerLng: lng })}
                height="200px"
              />
            </Suspense>
            <div className="flex gap-2 pt-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="outline" onClick={resetZoneForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Dialog: Nova/Editar Faixa */}
      <Dialog open={tierDialogOpen} onOpenChange={(o) => !o && resetTierForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Editar faixa' : 'Nova faixa'}</DialogTitle>
            <DialogDescription>Intervalo em km e valor do frete.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTier} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Km inicial</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tierForm.kmMin}
                  onChange={(e) => setTierForm({ ...tierForm, kmMin: e.target.value })}
                  placeholder="0"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Km final (vazio = +)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tierForm.kmMax}
                  onChange={(e) => setTierForm({ ...tierForm, kmMax: e.target.value })}
                  placeholder="Ex: 5"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Taxa</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={tierForm.feeInput}
                onChange={(e) =>
                  setTierForm({
                    ...tierForm,
                    feeInput: feeCurrency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                  })
                }
                placeholder={feeCurrency === 'PYG' ? '0' : '0,00'}
                required
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetTierForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTier.isPending || updateTier.isPending}>
                {(createTier.isPending || updateTier.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingTier ? 'Atualizar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmação exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleteTarget?.type === 'zone' ? 'Excluir zona?' : 'Excluir faixa?'}</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'zone'
                ? `Excluir a zona "${deleteTarget.name}"? Não pode ser desfeito.`
                : 'Excluir esta faixa? Não pode ser desfeito.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
