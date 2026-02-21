import { useState, Suspense, lazy, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
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
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
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
  const baseCurrency = useAdminCurrency();
  const { data: zonesData, isLoading: loading, refetch } = useDeliveryZones(restaurantId);
  const zones = zonesData ?? [];

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
    } catch (error) {
      console.error('Erro ao salvar zona:', error);
      alert('Erro ao salvar zona de entrega');
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
    } catch (error) {
      console.error('Erro ao atualizar zona:', error);
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
    } catch (error) {
      console.error('Erro ao excluir zona:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Zonas de Entrega</h1>
            <p className="text-muted-foreground">
              Configure os bairros e taxas de entrega com raio no mapa
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); setFormData(emptyForm(baseCurrency)); }} data-testid="delivery-zone-new">
            <Plus className="h-4 w-4 mr-2" />
            Nova Zona
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingZone ? 'Editar Zona de Entrega' : 'Nova Zona de Entrega'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="location_name">Nome do Bairro/Região</Label>
                  <Input
                    id="location_name"
                    value={formData.location_name}
                    onChange={(e) =>
                      setFormData({ ...formData, location_name: e.target.value })
                    }
                    placeholder="Ex: Centro, Bairro Alto"
                    required
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
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use 0 para entrega grátis
                  </p>
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
                    className="w-full"
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

                <div className="flex gap-2">
                  <Button type="submit">Salvar</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {zones.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Você ainda não tem zonas de entrega cadastradas
              </p>
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Zona
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone) => (
              <Card key={zone.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">
                        {zone.location_name}
                      </h3>
                    </div>
                    {!zone.is_active && (
                      <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded">
                        Inativa
                      </span>
                    )}
                  </div>
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-primary">
                      {zone.fee === 0
                        ? 'Grátis'
                        : formatCurrency(zone.fee, baseCurrency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Taxa de entrega · Raio {(zone.radius_meters ?? 2000) >= 1000
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
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(zone)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteZone(zone.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
