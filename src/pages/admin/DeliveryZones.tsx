import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { invalidatePublicMenuCache } from '@/lib/invalidatePublicCache';
import { useDeliveryZones, useDeliveryDistanceTiers, useCreateDeliveryDistanceTier, useUpdateDeliveryDistanceTier, useDeleteDeliveryDistanceTier } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { convertPriceToStorage, convertPriceFromStorage, convertBetweenCurrencies, getCurrencySymbol, formatPriceInputPyG } from '@/lib/priceHelper';
import type { CurrencyCode } from '@/lib/priceHelper';
import type { DeliveryZone, DeliveryDistanceTier } from '@/types';
import { Plus, Edit, Trash2, MapPin, Truck, Loader2, Gauge } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
const ZoneRadiusMapEditor = lazy(() => import('@/components/admin/ZoneRadiusMapEditor'));
const RestaurantLocationMapEditor = lazy(() => import('@/components/admin/RestaurantLocationMapEditor'));

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
    delivery_zones_mode?: 'disabled' | 'zones' | 'kilometers' | null;
    restaurant_lat?: number | null;
    restaurant_lng?: number | null;
  };
  const rawMode = restaurantWithMode?.delivery_zones_mode;
  const deliveryZonesMode: 'disabled' | 'zones' | 'kilometers' = rawMode ?? (restaurantWithMode?.delivery_zones_enabled === false ? 'disabled' : 'zones');

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

  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [feeCurrency, setFeeCurrency] = useState<CurrencyCode>(baseCurrency);
  const [formData, setFormData] = useState(() => emptyForm(baseCurrency));
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [restaurantLat, setRestaurantLat] = useState<number>(getDefaultCenter(baseCurrency)[0]);
  const [restaurantLng, setRestaurantLng] = useState<number>(getDefaultCenter(baseCurrency)[1]);
  const [savingRestaurantLocation, setSavingRestaurantLocation] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTier, setEditingTier] = useState<DeliveryDistanceTier | null>(null);
  const [tierForm, setTierForm] = useState({ kmMin: '0', kmMax: '', feeInput: '0' });

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

  const resetForm = useCallback(() => {
    setEditingZone(null);
    setFormData(emptyForm(baseCurrency));
    setFeeCurrency(baseCurrency);
    setShowForm(false);
  }, [baseCurrency]);

  const openEdit = useCallback((zone: DeliveryZone) => {
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
    setShowForm(true);
  }, [baseCurrency]);

  const setDeliveryZonesMode = async (mode: 'disabled' | 'zones' | 'kilometers') => {
    if (!restaurantId) return;
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
      const labels = { disabled: 'Desativado', zones: 'Ativado', kilometers: 'Modo Quilometragem' };
      toast({ title: `Modo alterado para: ${labels[mode]}` });
    } catch (err) {
      console.error('Erro ao alterar modo:', err);
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      resetForm();
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

  const deleteZone = async (zoneId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta zona?')) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      refetch();
      toast({ title: 'Zona excluída' });
    } catch (error) {
      console.error('Erro ao excluir zona:', error);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
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
    setShowTierForm(false);
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
    setShowTierForm(true);
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

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Excluir esta faixa de preço?')) return;
    try {
      await deleteTier.mutateAsync(id);
      toast({ title: 'Faixa excluída' });
      resetTierForm();
      refetchTiers();
    } catch (err) {
      console.error('Erro ao excluir faixa:', err);
      toast({ title: 'Erro ao excluir faixa', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#F87116]" />
          <p className="text-sm text-muted-foreground">Carregando zonas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* ── Hero + Título ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
          <Truck className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Zonas de Entrega
          </h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base max-w-xl">
            Configure bairros e taxas de entrega. No checkout, o cliente escolhe a zona ou envia a localização via WhatsApp.
          </p>
        </div>
      </div>

      {/* ── Barra de ações: Toggle + Nova Zona (layout horizontal elegante) ────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label="Modo de zonas de entrega"
              className="relative inline-flex w-full min-w-[280px] max-w-[340px] rounded-xl bg-slate-100 p-1"
            >
              <div
                className="absolute top-1 bottom-1 w-[calc(33.333%-4px)] rounded-lg shadow-sm transition-all duration-200 ease-out"
                style={{
                  left: deliveryZonesMode === 'disabled' ? 4 : deliveryZonesMode === 'zones' ? 'calc(33.333% + 2px)' : 'calc(66.666% + 4px)',
                  backgroundColor: deliveryZonesMode === 'disabled' ? '#374151' : deliveryZonesMode === 'zones' ? '#10b981' : '#f59e0b',
                }}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => deliveryZonesMode !== 'disabled' && setDeliveryZonesMode('disabled')}
                disabled={togglingGlobal}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  deliveryZonesMode === 'disabled' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {togglingGlobal && deliveryZonesMode === 'disabled' && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                Desativado
              </button>
              <button
                type="button"
                onClick={() => deliveryZonesMode !== 'zones' && setDeliveryZonesMode('zones')}
                disabled={togglingGlobal}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  deliveryZonesMode === 'zones' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {togglingGlobal && deliveryZonesMode === 'zones' && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                Ativado
              </button>
              <button
                type="button"
                onClick={() => deliveryZonesMode !== 'kilometers' && setDeliveryZonesMode('kilometers')}
                disabled={togglingGlobal}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  deliveryZonesMode === 'kilometers' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
                title="Modo por quilometragem: frete calculado pela distância"
              >
                {togglingGlobal && deliveryZonesMode === 'kilometers' && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                <Gauge className="h-3 w-3 shrink-0" />
                <span className="truncate">Quilometragem</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 sm:max-w-[280px]">
            {deliveryZonesMode === 'disabled'
              ? 'Checkout exibe card pedindo localização via WhatsApp.'
              : deliveryZonesMode === 'zones'
                ? 'Cliente escolhe a zona e vê a taxa no checkout.'
                : 'Cliente posiciona o endereço no mapa; frete calculado pela distância.'}
          </p>
        </div>
        {deliveryZonesMode === 'zones' && (
          <Button
            onClick={() => { resetForm(); setShowForm(true); setFormData(emptyForm(baseCurrency)); }}
            data-testid="delivery-zone-new"
            size="lg"
            className="w-full sm:w-auto shrink-0 bg-[#F87116] hover:bg-orange-600 text-white shadow-md font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Zona
          </Button>
        )}
      </div>

      {/* ── Modo Quilometragem: Localização + Faixas de preço ───────────────────── */}
      {deliveryZonesMode === 'kilometers' && (
        <>
          <Card className="border-slate-200 shadow-lg overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-orange-600" />
                Localização do Restaurante
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Defina o endereço do restaurante para o cálculo da distância no checkout.
              </p>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-xl" />}>
                <RestaurantLocationMapEditor
                  centerLat={restaurantLat}
                  centerLng={restaurantLng}
                  onCenterChange={(lat, lng) => { setRestaurantLat(lat); setRestaurantLng(lng); }}
                  height="280px"
                />
              </Suspense>
              <Button
                onClick={saveRestaurantLocation}
                disabled={savingRestaurantLocation}
                className="bg-[#F87116] hover:bg-orange-600"
              >
                {savingRestaurantLocation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Localização
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-lg overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-5 w-5 text-orange-600" />
                Faixas de Preço por Distância
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure o valor do frete conforme a distância em km (ex: 0–2 km = R$ 5, 2–5 km = R$ 10).
              </p>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {showTierForm && (
                <form onSubmit={handleSaveTier} className="p-4 bg-muted/50 rounded-xl space-y-4">
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
                    <Label>Taxa de entrega ({getCurrencySymbol(feeCurrency)})</Label>
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
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createTier.isPending || updateTier.isPending}>
                      {(createTier.isPending || updateTier.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingTier ? 'Atualizar' : 'Adicionar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetTierForm}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
              {!showTierForm && (
                <Button
                  variant="outline"
                  onClick={() => { resetTierForm(); setShowTierForm(true); }}
                  className="border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar faixa de preço
                </Button>
              )}
              {tiers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Faixas configuradas</h3>
                  <div className="space-y-2">
                    {tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <span className="font-medium text-slate-800">
                          {Number(tier.km_min)} km até {tier.km_max != null ? `${Number(tier.km_max)} km` : '+'}
                          {' → '}
                          {tier.fee === 0 ? 'Grátis' : formatCurrency(tier.fee, baseCurrency)}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditTier(tier)}>
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteTier(tier.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tiers.length === 0 && !showTierForm && (
                <p className="text-sm text-muted-foreground">
                  Adicione ao menos uma faixa para que o cliente veja o frete no checkout.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Formulário Nova/Editar Zona (modo zones) ────────────────────────────────────────── */}
      {showForm && deliveryZonesMode === 'zones' && (
        <Card className="border-slate-200 shadow-lg overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b">
            <CardTitle className="text-lg">
              {editingZone ? 'Editar Zona' : 'Nova Zona de Entrega'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
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
              <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-xl" />}>
                <ZoneRadiusMapEditor
                  centerLat={formData.centerLat}
                  centerLng={formData.centerLng}
                  radiusMeters={formData.radiusMeters}
                  onCenterChange={(lat, lng) => setFormData({ ...formData, centerLat: lat, centerLng: lng })}
                  height="280px"
                />
              </Suspense>
              <div className="flex gap-3 pt-2">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Lista de zonas ou empty state (modo zones) ──────────────────────────────────────── */}
      {deliveryZonesMode === 'zones' && zones.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/30">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-16 w-16 rounded-2xl bg-slate-200/60 flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Nenhuma zona cadastrada</h3>
            <p className="text-slate-600 text-center text-sm max-w-sm mb-6">
              Adicione zonas para que o cliente escolha o bairro e veja a taxa no checkout.
            </p>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#F87116] hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Zona
            </Button>
          </CardContent>
        </Card>
      ) : deliveryZonesMode === 'zones' ? (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Zonas configuradas
            <span className="ml-2 text-sm font-normal text-slate-500">({zones.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone) => (
              <Card key={zone.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-orange-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900 truncate">{zone.location_name}</h3>
                    </div>
                    {!zone.is_active && (
                      <span className="text-[10px] font-medium uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-1 rounded-md flex-shrink-0">
                        Inativa
                      </span>
                    )}
                  </div>
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-orange-600">
                      {zone.fee === 0 ? 'Grátis' : formatCurrency(zone.fee, baseCurrency)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
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
                    <Button variant="outline" size="icon" onClick={() => openEdit(zone)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteZone(zone.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
      ) : null}
    </div>
  );
}
