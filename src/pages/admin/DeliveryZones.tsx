import { useState, Suspense, lazy, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { invalidatePublicMenuCache } from '@/lib/invalidatePublicCache';
import { useDeliveryZones } from '@/hooks/queries';
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
import type { DeliveryZone } from '@/types';
import { Plus, Edit, Trash2, MapPin, Truck, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
const ZoneRadiusMapEditor = lazy(() => import('@/components/admin/ZoneRadiusMapEditor'));

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

  const deliveryZonesEnabled = (restaurantData as { delivery_zones_enabled?: boolean | null })?.delivery_zones_enabled !== false;

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

  const toggleDeliveryZonesEnabled = async () => {
    if (!restaurantId) return;
    setTogglingGlobal(true);
    try {
      const newValue = !deliveryZonesEnabled;
      const { error } = await supabase
        .from('restaurants')
        .update({ delivery_zones_enabled: newValue, updated_at: new Date().toISOString() })
        .eq('id', restaurantId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      toast({ title: newValue ? 'Zonas de entrega ativadas' : 'Zonas de entrega desativadas' });
    } catch (err) {
      console.error('Erro ao alterar status:', err);
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

      {/* ── Card de ações: Status (vertical) + Nova Zona ───────────────────────── */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-6 space-y-5">
          {/* Status das zonas — alternador com pill deslizante */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Status das zonas no checkout</Label>
            <div
              role="group"
              aria-label="Ativar ou desativar zonas de entrega"
              className="relative inline-flex w-[200px] rounded-xl bg-slate-100 p-1"
            >
              {/* Pill deslizante — indica o estado ativo */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-all duration-200 ease-out ${
                  deliveryZonesEnabled
                    ? 'left-[calc(50%+2px)] bg-emerald-500'
                    : 'left-1 bg-slate-700'
                }`}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => deliveryZonesEnabled && toggleDeliveryZonesEnabled()}
                disabled={togglingGlobal}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  !deliveryZonesEnabled ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {togglingGlobal && deliveryZonesEnabled && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                Desativado
              </button>
              <button
                type="button"
                onClick={() => !deliveryZonesEnabled && toggleDeliveryZonesEnabled()}
                disabled={togglingGlobal}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  deliveryZonesEnabled ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {togglingGlobal && !deliveryZonesEnabled && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                Ativado
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {deliveryZonesEnabled
                ? 'O cliente escolhe a zona e vê a taxa no checkout.'
                : 'O checkout exibe um card pedindo a localização via WhatsApp após o pedido.'}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <Button
              onClick={() => { resetForm(); setShowForm(true); setFormData(emptyForm(baseCurrency)); }}
              data-testid="delivery-zone-new"
              className="w-full sm:w-auto bg-[#F87116] hover:bg-orange-600 text-white shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Zona
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Formulário Nova/Editar Zona ────────────────────────────────────────── */}
      {showForm && (
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

      {/* ── Lista de zonas ou empty state ──────────────────────────────────────── */}
      {zones.length === 0 ? (
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
      ) : (
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
      )}
    </div>
  );
}
