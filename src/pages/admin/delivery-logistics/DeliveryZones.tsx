import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import { useDeliveryZones, useDeliveryDistanceTiers, useCreateDeliveryDistanceTier, useUpdateDeliveryDistanceTier, useDeleteDeliveryDistanceTier } from '@/hooks/queries';
import { AdminPageHeader, AdminPageLayout } from '@/components/admin/_shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { convertPriceToStorage, convertPriceFromStorage, convertBetweenCurrencies, getCurrencySymbol, formatPrice, formatPriceInputPyG } from '@/lib/priceHelper';
import type { CurrencyCode } from '@/lib/priceHelper';
import type { DeliveryZone, DeliveryDistanceTier } from '@/types';
import { Plus, Edit, Trash2, MapPin, Truck, Loader2, Gauge, MapPinned, Package } from 'lucide-react';
import { toast } from '@/hooks/shared/use-toast';

const ZoneRadiusMapEditor = lazy(() => import('@/components/admin/delivery-logistics/ZoneRadiusMapEditor'));
const RestaurantLocationMapEditor = lazy(() => import('@/components/admin/delivery-logistics/RestaurantLocationMapEditor'));

const RADIUS_MIN = 500;
const RADIUS_MAX = 10000;

const FEE_CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'BRL', label: 'R$ Real' },
  { value: 'PYG', label: 'Gs. Guaraní' },
  { value: 'ARS', label: '$ Peso' },
  { value: 'USD', label: 'US$ Dólar' },
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

export default function AdminDeliveryZones() {
  const queryClient = useQueryClient();
  const restaurantId = useAdminRestaurantId();
  const restaurant = useAdminRestaurant()?.restaurant ?? null;
  const { data: restaurantData } = useRestaurant(restaurantId);
  const baseCurrency = useAdminCurrency();
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
  const deliveryZonesMode: DeliveryMode = rawMode ?? (restaurantWithMode?.delivery_zones_enabled === false ? 'disabled' : 'zones');

  const paymentCurrencies = (restaurant as { payment_currencies?: string[] })?.payment_currencies;
  const feeCurrencyOptions: CurrencyCode[] = (() => {
    const arr = Array.isArray(paymentCurrencies) && paymentCurrencies.length > 0
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

  const exchangeRates = (restaurant as { exchange_rates?: { pyg_per_brl?: number; ars_per_brl?: number } })?.exchange_rates ?? { pyg_per_brl: 3600, ars_per_brl: 1150 };

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

  const resetZoneForm = useCallback(() => {
    setEditingZone(null);
    setFormData(emptyForm(baseCurrency));
    setFeeCurrency(baseCurrency);
    setZoneSheetOpen(false);
  }, [baseCurrency]);

  const openEditZone = useCallback((zone: DeliveryZone) => {
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
  }, [baseCurrency]);

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
      toast({ title: `Modo alterado para: ${labels[mode]}` });
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
    const feeInBase = feeCurrency === baseCurrency
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
        const { error } = await supabase
          .from('delivery_zones')
          .update(payload)
          .eq('id', editingZone.id);
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
      const { error } = await supabase
        .from('delivery_zones')
        .update({ is_active: !isActive })
        .eq('id', zoneId);

      if (error) throw error;
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      refetch();
      toast({ title: isActive ? 'Zona desativada' : 'Zona ativada' });
    } catch (error) {
      console.error('Erro ao atualizar zona:', error);
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
      console.error('Erro ao excluir:', error);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const saveRestaurantLocation = async () => {
    if (!restaurantId) return;
    setSavingRestaurantLocation(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          restaurant_lat: restaurantLat,
          restaurant_lng: restaurantLng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      toast({ title: 'Localização do restaurante salva' });
    } catch (err) {
      console.error('Erro ao salvar localização:', err);
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

  const openEditTier = useCallback((tier: DeliveryDistanceTier) => {
    setEditingTier(tier);
    setTierForm({
      kmMin: String(tier.km_min),
      kmMax: tier.km_max != null ? String(tier.km_max) : '',
      feeInput: convertPriceFromStorage(tier.fee, baseCurrency),
    });
    setFeeCurrency(baseCurrency);
    setTierDialogOpen(true);
  }, [baseCurrency]);

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
    const feeInBase = feeCurrency === baseCurrency
      ? valueInFee
      : convertBetweenCurrencies(valueInFee, feeCurrency, baseCurrency, exchangeRates);

    try {
      if (editingTier) {
        await updateTier.mutateAsync({
          id: editingTier.id,
          km_min: kmMin,
          km_max: kmMax,
          fee: feeInBase,
        });
        toast({ title: 'Faixa atualizada' });
      } else {
        await createTier.mutateAsync({
          km_min: kmMin,
          km_max: kmMax,
          fee: feeInBase,
        });
        toast({ title: 'Faixa adicionada' });
      }
      resetTierForm();
      refetchTiers();
    } catch (err) {
      console.error('Erro ao salvar faixa:', err);
      toast({ title: 'Erro ao salvar faixa', variant: 'destructive' });
    }
  };

  const getTierLabel = (tier: DeliveryDistanceTier) =>
    `${Number(tier.km_min)} km até ${tier.km_max != null ? `${Number(tier.km_max)} km` : '+'} → ${tier.fee === 0 ? 'Grátis' : formatPrice(tier.fee, baseCurrency)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando zonas…</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout className="pb-10">
      <AdminPageHeader
        title="Zonas de Entrega"
        description="Configure bairros e taxas ou frete por distância. No checkout, o cliente escolhe a zona ou envia a localização."
        icon={Truck}
      />

      {/* ── Tabs por modo ─────────────────────────────────────────────────────── */}
      <Tabs
        value={deliveryZonesMode}
        onValueChange={(v) => setDeliveryZonesMode(v as DeliveryMode)}
        className="w-full"
      >
        <div className="relative mb-6">
          <TabsList className="flex w-full h-auto p-0 bg-transparent overflow-x-auto scrollbar-hide border-b border-border rounded-none gap-0">
            {[
              { value: 'disabled' as const, icon: Package, label: 'Desativado' },
              { value: 'zones' as const, icon: MapPin, label: 'Zonas' },
              { value: 'kilometers' as const, icon: Gauge, label: 'Quilometragem' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                disabled={togglingGlobal}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap bg-transparent rounded-none border-b-2 border-transparent -mb-px text-muted-foreground hover:text-foreground hover:bg-muted/40 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-primary transition-all disabled:opacity-60"
              >
                {togglingGlobal && deliveryZonesMode === value && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                )}
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Tab: Desativado ───────────────────────────────────────────────────── */}
        <TabsContent value="disabled" className="mt-0">
          <Card className="border-border overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Entrega desativada</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                No checkout, o cliente verá um card pedindo que envie o endereço via WhatsApp. Ative as zonas ou o modo quilometragem para calcular frete automaticamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Zonas ───────────────────────────────────────────────────────── */}
        <TabsContent value="zones" className="mt-0 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Cliente escolhe o bairro no checkout e vê a taxa correspondente.
            </p>
            <Button
              onClick={openNewZone}
              data-testid="delivery-zone-new"
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nova Zona
            </Button>
          </div>

          {zones.length === 0 ? (
            <Card className="border-dashed border-2 border-border bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma zona cadastrada</h3>
                <p className="text-muted-foreground text-center text-sm max-w-sm mb-6">
                  Adicione zonas para que o cliente escolha o bairro e veja a taxa no checkout.
                </p>
                <Button onClick={openNewZone} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Zona
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <h2 className="text-base font-semibold text-foreground mb-4">
                Zonas configuradas
                <span className="ml-2 text-sm font-normal text-muted-foreground">({zones.length})</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {zones.map((zone) => (
                  <Card key={zone.id} className="overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-semibold text-foreground truncate">{zone.location_name}</h3>
                        </div>
                        {!zone.is_active && (
                          <span className="text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md flex-shrink-0">
                            Inativa
                          </span>
                        )}
                      </div>
                      <div className="mb-4">
                        <p className="text-xl font-bold text-primary">
                          {zone.fee === 0 ? 'Grátis' : formatPrice(zone.fee, baseCurrency)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Raio {(zone.radius_meters ?? 2000) >= 1000
                            ? `${((zone.radius_meters ?? 2000) / 1000).toFixed(1)} km`
                            : `${zone.radius_meters ?? 2000} m`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          data-testid={`zone-toggle-${zone.id}`}
                          onClick={() => toggleZoneStatus(zone.id, zone.is_active)}
                        >
                          {zone.is_active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => openEditZone(zone)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ type: 'zone', id: zone.id, name: zone.location_name })}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Quilometragem ────────────────────────────────────────────────── */}
        <TabsContent value="kilometers" className="mt-0 space-y-6">
          <p className="text-sm text-muted-foreground">
            Cliente posiciona o endereço no mapa no checkout; o frete é calculado pela distância.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Localização do Restaurante */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-primary" />
                  Localização do Restaurante
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Defina o endereço de origem para o cálculo da distância no checkout.
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Suspense fallback={<Skeleton className="h-[240px] w-full rounded-xl" />}>
                  <RestaurantLocationMapEditor
                    centerLat={restaurantLat}
                    centerLng={restaurantLng}
                    onCenterChange={(lat, lng) => { setRestaurantLat(lat); setRestaurantLng(lng); }}
                    height="240px"
                  />
                </Suspense>
                <Button
                  onClick={saveRestaurantLocation}
                  disabled={savingRestaurantLocation}
                  className="bg-primary hover:bg-primary/90"
                >
                  {savingRestaurantLocation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Localização
                </Button>
              </CardContent>
            </Card>

            {/* Faixas de Preço */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  Faixas de Preço por Distância
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Configure o frete por km (ex: 0–2 km = R$ 5, 2–5 km = R$ 10).
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Button
                  variant="outline"
                  onClick={openNewTier}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar faixa de preço
                </Button>

                {tiers.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Faixas configuradas</h3>
                    <div className="space-y-2">
                      {tiers.map((tier) => (
                        <div
                          key={tier.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                        >
                          <span className="text-sm font-medium text-foreground">
                            {getTierLabel(tier)}
                          </span>
                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => openEditTier(tier)}>
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget({ type: 'tier', id: tier.id, label: getTierLabel(tier) })}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Adicione ao menos uma faixa para que o cliente veja o frete no checkout.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Sheet: Nova/Editar Zona ─────────────────────────────────────────────── */}
      <Sheet open={zoneSheetOpen} onOpenChange={(o) => { if (!o) resetZoneForm(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" showCloseButton={true}>
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle>{editingZone ? 'Editar Zona' : 'Nova Zona de Entrega'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmitZone} className="pt-6 space-y-5">
            <div>
              <Label htmlFor="location_name">Nome do Bairro/Região</Label>
              <Input
                id="location_name"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                placeholder="Ex: Centro, Bairro Alto"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Label htmlFor="fee">Taxa de Entrega</Label>
                {feeCurrencyOptions.length > 1 && (
                  <Select value={feeCurrency} onValueChange={(v) => setFeeCurrency(v as CurrencyCode)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
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
                id="fee"
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
              <p className="text-xs text-muted-foreground mt-1">Use 0 para entrega grátis</p>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Label>Raio de alcance</Label>
                <span className="text-sm font-medium text-muted-foreground">
                  {formData.radiusMeters >= 1000
                    ? `${(formData.radiusMeters / 1000).toFixed(1)} km`
                    : `${formData.radiusMeters} m`}
                </span>
              </div>
              <Slider
                value={[formData.radiusMeters]}
                onValueChange={([v]) => setFormData({ ...formData, radiusMeters: v })}
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={100}
                className="mt-2"
              />
            </div>
            <Suspense fallback={<Skeleton className="h-[240px] w-full rounded-xl" />}>
              <ZoneRadiusMapEditor
                centerLat={formData.centerLat}
                centerLng={formData.centerLng}
                radiusMeters={formData.radiusMeters}
                onCenterChange={(lat, lng) => setFormData({ ...formData, centerLat: lat, centerLng: lng })}
                height="240px"
              />
            </Suspense>
            <div className="flex gap-3 pt-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="outline" onClick={resetZoneForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Dialog: Nova/Editar Faixa de Preço ──────────────────────────────────── */}
      <Dialog open={tierDialogOpen} onOpenChange={(o) => !o && resetTierForm()}>
        <DialogContent className="max-w-md" hideClose>
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Editar Faixa' : 'Nova Faixa de Preço'}</DialogTitle>
            <DialogDescription>
              Defina o intervalo de distância em km e o valor do frete.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTier} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Km final (vazio = acima do inicial)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tierForm.kmMax}
                  onChange={(e) => setTierForm({ ...tierForm, kmMax: e.target.value })}
                  placeholder="Ex: 5"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Label>Taxa de entrega</Label>
                {feeCurrencyOptions.length > 1 && (
                  <Select value={feeCurrency} onValueChange={(v) => setFeeCurrency(v as CurrencyCode)}>
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {feeCurrencyOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {getCurrencySymbol(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
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
                className="mt-1.5"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetTierForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTier.isPending || updateTier.isPending}>
                {(createTier.isPending || updateTier.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTier ? 'Atualizar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmação de exclusão ─────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === 'zone' ? 'Excluir zona?' : 'Excluir faixa?'}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'zone'
                ? `Tem certeza que deseja excluir a zona "${deleteTarget.name}"? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir esta faixa? Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageLayout>
  );
}
