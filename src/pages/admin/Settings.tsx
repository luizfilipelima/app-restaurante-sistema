import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { Restaurant, PizzaSize, PizzaDough, PizzaEdge, DayKey } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { Save, Plus, Trash2, Pizza, Upload, Loader2, Clock, Instagram } from 'lucide-react';

export default function AdminSettings() {
  const restaurantId = useAdminRestaurantId();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const DAYS: { key: DayKey; label: string }[] = [
    { key: 'mon', label: 'Segunda' },
    { key: 'tue', label: 'Terça' },
    { key: 'wed', label: 'Quarta' },
    { key: 'thu', label: 'Quinta' },
    { key: 'fri', label: 'Sexta' },
    { key: 'sat', label: 'Sábado' },
    { key: 'sun', label: 'Domingo' },
  ];
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    phone_country: 'BR' as 'BR' | 'PY',
    instagram_url: '',
    logo: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    is_manually_closed: false,
    opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
  });
  const [logoUploading, setLogoUploading] = useState(false);

  // Configuração do cardápio por categoria (Pizza)
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaDoughs, setPizzaDoughs] = useState<PizzaDough[]>([]);
  const [pizzaEdges, setPizzaEdges] = useState<PizzaEdge[]>([]);
  const [menuConfigLoading, setMenuConfigLoading] = useState(false);
  const [showFormSize, setShowFormSize] = useState(false);
  const [showFormDough, setShowFormDough] = useState(false);
  const [showFormEdge, setShowFormEdge] = useState(false);
  const [formSize, setFormSize] = useState({ name: '', max_flavors: 1, price_multiplier: 1, order_index: 0 });
  const [formDough, setFormDough] = useState({ name: '', extra_price: '' });
  const [formEdge, setFormEdge] = useState({ name: '', price: '' });

  useEffect(() => {
    if (restaurantId) {
      loadRestaurant();
      loadMenuConfig();
    }
  }, [restaurantId]);

  const loadRestaurant = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error) throw error;

      setRestaurant(data);
      const hours = (data.opening_hours || {}) as Record<DayKey, { open: string; close: string } | null>;
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        phone_country: (data.phone_country === 'PY' ? 'PY' : 'BR') as 'BR' | 'PY',
        instagram_url: data.instagram_url || '',
        logo: data.logo || '',
        primary_color: data.primary_color || '#000000',
        secondary_color: data.secondary_color || '#ffffff',
        is_manually_closed: !!data.is_manually_closed,
        opening_hours: DAYS.reduce((acc, d) => ({ ...acc, [d.key]: hours[d.key] || null }), {} as Record<DayKey, { open: string; close: string } | null>),
      });
    } catch (error) {
      console.error('Erro ao carregar restaurante:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuConfig = async () => {
    if (!restaurantId) return;
    setMenuConfigLoading(true);
    try {
      const [sizesRes, doughsRes, edgesRes] = await Promise.all([
        supabase.from('pizza_sizes').select('*').eq('restaurant_id', restaurantId).order('order_index'),
        supabase.from('pizza_doughs').select('*').eq('restaurant_id', restaurantId).order('name'),
        supabase.from('pizza_edges').select('*').eq('restaurant_id', restaurantId).order('name'),
      ]);
      if (sizesRes.data) setPizzaSizes(sizesRes.data);
      if (doughsRes.data) setPizzaDoughs(doughsRes.data);
      if (edgesRes.data) setPizzaEdges(edgesRes.data);
    } catch (e) {
      console.error('Erro ao carregar configuração do cardápio:', e);
    } finally {
      setMenuConfigLoading(false);
    }
  };

  const handleSubmitSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      const { error } = await supabase.from('pizza_sizes').insert({
        restaurant_id: restaurantId,
        name: formSize.name,
        max_flavors: formSize.max_flavors,
        price_multiplier: formSize.price_multiplier,
        order_index: formSize.order_index,
      });
      if (error) throw error;
      setFormSize({ name: '', max_flavors: 1, price_multiplier: 1, order_index: pizzaSizes.length });
      setShowFormSize(false);
      loadMenuConfig();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar tamanho.');
    }
  };

  const handleSubmitDough = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const extra_price = parseFloat(String(formDough.extra_price).replace(',', '.')) || 0;
    try {
      const { error } = await supabase.from('pizza_doughs').insert({
        restaurant_id: restaurantId,
        name: formDough.name,
        extra_price,
        is_active: true,
      });
      if (error) throw error;
      setFormDough({ name: '', extra_price: '' });
      setShowFormDough(false);
      loadMenuConfig();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar massa.');
    }
  };

  const handleSubmitEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price = parseFloat(String(formEdge.price).replace(',', '.')) || 0;
    try {
      const { error } = await supabase.from('pizza_edges').insert({
        restaurant_id: restaurantId,
        name: formEdge.name,
        price,
        is_active: true,
      });
      if (error) throw error;
      setFormEdge({ name: '', price: '' });
      setShowFormEdge(false);
      loadMenuConfig();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar borda.');
    }
  };

  const deleteSize = async (id: string) => {
    if (!confirm('Excluir este tamanho?')) return;
    try {
      await supabase.from('pizza_sizes').delete().eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };
  const deleteDough = async (id: string) => {
    if (!confirm('Excluir esta massa?')) return;
    try {
      await supabase.from('pizza_doughs').delete().eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };
  const deleteEdge = async (id: string) => {
    if (!confirm('Excluir esta borda?')) return;
    try {
      await supabase.from('pizza_edges').delete().eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleDoughActive = async (id: string, isActive: boolean) => {
    try {
      await supabase.from('pizza_doughs').update({ is_active: !isActive }).eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };
  const toggleEdgeActive = async (id: string, isActive: boolean) => {
    try {
      await supabase.from('pizza_edges').update({ is_active: !isActive }).eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          phone_country: formData.phone_country,
          instagram_url: formData.instagram_url || null,
          logo: formData.logo,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          is_manually_closed: formData.is_manually_closed,
          opening_hours: formData.opening_hours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (error) throw error;

      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Configure as informações do seu restaurante
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Restaurante</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label>País do telefone / WhatsApp</Label>
                <Select
                  value={formData.phone_country}
                  onValueChange={(v) => setFormData({ ...formData, phone_country: v as 'BR' | 'PY' })}
                >
                  <SelectTrigger className="w-full max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BR">🇧🇷 Brasil (+55)</SelectItem>
                    <SelectItem value="PY">🇵🇾 Paraguai (+595)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Define o código do país para Telefone e WhatsApp
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder={formData.phone_country === 'BR' ? '(11) 99999-9999' : '981 123 456'}
                  required
                />
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  placeholder={formData.phone_country === 'BR' ? '(11) 99999-9999' : '981 123 456'}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.phone_country === 'BR' ? 'Brasil: DDD + número (apenas dígitos)' : 'Paraguai: número com 9 dígitos'}
                </p>
              </div>

              <div>
                <Label htmlFor="instagram_url" className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" /> Instagram
                </Label>
                <Input
                  id="instagram_url"
                  type="url"
                  value={formData.instagram_url}
                  onChange={(e) =>
                    setFormData({ ...formData, instagram_url: e.target.value })
                  }
                  placeholder="https://instagram.com/seu-restaurante"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link completo do perfil (opcional)
                </p>
              </div>

              <div>
                <Label>Logo do restaurante</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  PNG, JPG ou GIF. Será convertida para WebP (80%) para ficar leve.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                      className="sr-only"
                      disabled={logoUploading || !restaurantId}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !restaurantId) return;
                        setLogoUploading(true);
                        try {
                          const url = await uploadRestaurantLogo(restaurantId, file);
                          setFormData((f) => ({ ...f, logo: url }));
                          alert('Logo enviada e otimizada (WebP 80%)');
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Erro ao enviar logo. Tente outro arquivo.');
                        } finally {
                          setLogoUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="pointer-events-none"
                      asChild
                    >
                      <span>
                        {logoUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Escolher arquivo
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                  {formData.logo && (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                        <img
                          src={formData.logo}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData((f) => ({ ...f, logo: '' }))}
                      >
                        Remover logo
                      </Button>
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <Label htmlFor="logo_url" className="text-xs text-muted-foreground">
                    Ou cole uma URL da logo
                  </Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo}
                    onChange={(e) =>
                      setFormData({ ...formData, logo: e.target.value })
                    }
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Horário de funcionamento
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure os horários de abertura e fechamento. O cliente verá &quot;Aberto&quot; ou &quot;Fechado&quot; conforme o horário atual.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="font-medium">Estabelecimento fechado agora</Label>
                  <p className="text-xs text-muted-foreground">Quando ativo, o cardápio público mostra &quot;Fechado&quot; independente do horário.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_manually_closed}
                  onChange={(e) => setFormData({ ...formData, is_manually_closed: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label>Horários por dia</Label>
                <div className="space-y-2">
                  {DAYS.map(({ key, label }) => {
                    const slot = formData.opening_hours[key];
                    const isClosed = !slot;
                    return (
                      <div key={key} className="flex flex-wrap items-center gap-2 rounded border p-2">
                        <span className="w-24 text-sm font-medium">{label}</span>
                        <label className="flex items-center gap-1 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isClosed}
                            onChange={(e) => {
                              const next = { ...formData.opening_hours };
                              next[key] = e.target.checked ? null : { open: '11:00', close: '23:00' };
                              setFormData({ ...formData, opening_hours: next });
                            }}
                            className="h-3 w-3 rounded"
                          />
                          Fechado
                        </label>
                        {!isClosed && (
                          <>
                            <Input
                              type="time"
                              value={slot?.open || '11:00'}
                              onChange={(e) => {
                                const next = { ...formData.opening_hours };
                                next[key] = { open: e.target.value, close: next[key]?.close || '23:00' };
                                setFormData({ ...formData, opening_hours: next });
                              }}
                              className="w-28 h-8"
                            />
                            <span className="text-slate-400">até</span>
                            <Input
                              type="time"
                              value={slot?.close || '23:00'}
                              onChange={(e) => {
                                const next = { ...formData.opening_hours };
                                next[key] = { open: next[key]?.open || '11:00', close: e.target.value };
                                setFormData({ ...formData, opening_hours: next });
                              }}
                              className="w-28 h-8"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personalização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primary_color">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_color: e.target.value })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_color: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondary_color">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondary_color: e.target.value,
                      })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondary_color: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link do Cardápio Digital</CardTitle>
            </CardHeader>
            <CardContent>
              {restaurant && (
                <div>
                  <Label>Seu link público:</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/${restaurant.slug}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/${restaurant.slug}`
                        );
                        alert('Link copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </form>

        <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pizza className="h-5 w-5" />
                Configuração do cardápio
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Defina opções por categoria. A categoria <strong>Pizza</strong> usa tamanhos, massas e bordas para o cliente montar o pedido.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pizza" className="w-full">
                <TabsList className="grid w-full max-w-xs grid-cols-1">
                  <TabsTrigger value="pizza">Pizza</TabsTrigger>
                </TabsList>
                <TabsContent value="pizza" className="space-y-8 mt-6">
                  {menuConfigLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
                    </div>
                  ) : (
                    <>
                      {/* Tamanhos */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Tamanhos de pizza</Label>
                          <Button type="button" size="sm" variant="outline" onClick={() => setShowFormSize(!showFormSize)}>
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                        {showFormSize && (
                          <form onSubmit={handleSubmitSize} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Nome</Label>
                                <Input value={formSize.name} onChange={(e) => setFormSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Broto, Média, Grande" required />
                              </div>
                              <div>
                                <Label>Máx. sabores</Label>
                                <Input type="number" min={1} value={formSize.max_flavors} onChange={(e) => setFormSize((f) => ({ ...f, max_flavors: parseInt(e.target.value, 10) || 1 }))} />
                              </div>
                              <div>
                                <Label>Multiplicador de preço</Label>
                                <Input type="number" step="0.01" min="0" value={formSize.price_multiplier} onChange={(e) => setFormSize((f) => ({ ...f, price_multiplier: parseFloat(e.target.value) || 1 }))} placeholder="1.0" />
                              </div>
                              <div>
                                <Label>Ordem</Label>
                                <Input type="number" min={0} value={formSize.order_index} onChange={(e) => setFormSize((f) => ({ ...f, order_index: parseInt(e.target.value, 10) || 0 }))} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm">Salvar</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setShowFormSize(false)}>Cancelar</Button>
                            </div>
                          </form>
                        )}
                        <ul className="space-y-2">
                          {pizzaSizes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tamanho. Adicione para o cliente escolher no cardápio.</p>}
                          {pizzaSizes.map((s) => (
                            <li key={s.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                              <span><strong>{s.name}</strong> — até {s.max_flavors} sabor(es) — multiplicador {Number(s.price_multiplier)}x</span>
                              <Button type="button" size="icon" variant="ghost" onClick={() => deleteSize(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Massas */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Tipos de massa</Label>
                          <Button type="button" size="sm" variant="outline" onClick={() => setShowFormDough(!showFormDough)}>
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                        {showFormDough && (
                          <form onSubmit={handleSubmitDough} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                            <div className="flex gap-3 flex-wrap">
                              <div>
                                <Label>Nome</Label>
                                <Input value={formDough.name} onChange={(e) => setFormDough((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Tradicional" required />
                              </div>
                              <div>
                                <Label>Acréscimo (R$)</Label>
                                <Input type="text" value={formDough.extra_price} onChange={(e) => setFormDough((f) => ({ ...f, extra_price: e.target.value }))} placeholder="0" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm">Salvar</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setShowFormDough(false)}>Cancelar</Button>
                            </div>
                          </form>
                        )}
                        <ul className="space-y-2">
                          {pizzaDoughs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tipo. Adicione (ex: Tradicional, Integral).</p>}
                          {pizzaDoughs.map((d) => (
                            <li key={d.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                              <span><strong>{d.name}</strong> {Number(d.extra_price) > 0 ? `+ ${formatCurrency(Number(d.extra_price))}` : '(sem acréscimo)'}{!d.is_active && ' (inativo)'}</span>
                              <div className="flex gap-1">
                                <Button type="button" size="sm" variant="ghost" onClick={() => toggleDoughActive(d.id, d.is_active)}>{d.is_active ? 'Desativar' : 'Ativar'}</Button>
                                <Button type="button" size="icon" variant="ghost" onClick={() => deleteDough(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Bordas */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Bordas recheadas</Label>
                          <Button type="button" size="sm" variant="outline" onClick={() => setShowFormEdge(!showFormEdge)}>
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                        {showFormEdge && (
                          <form onSubmit={handleSubmitEdge} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                            <div className="flex gap-3 flex-wrap">
                              <div>
                                <Label>Nome</Label>
                                <Input value={formEdge.name} onChange={(e) => setFormEdge((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Catupiry" required />
                              </div>
                              <div>
                                <Label>Preço (R$)</Label>
                                <Input type="text" value={formEdge.price} onChange={(e) => setFormEdge((f) => ({ ...f, price: e.target.value }))} placeholder="8,00" required />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm">Salvar</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setShowFormEdge(false)}>Cancelar</Button>
                            </div>
                          </form>
                        )}
                        <ul className="space-y-2">
                          {pizzaEdges.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma borda. Adicione (ex: Catupiry, Cheddar).</p>}
                          {pizzaEdges.map((e) => (
                            <li key={e.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                              <span><strong>{e.name}</strong> — {formatCurrency(Number(e.price))}{!e.is_active && ' (inativo)'}</span>
                              <div className="flex gap-1">
                                <Button type="button" size="sm" variant="ghost" onClick={() => toggleEdgeActive(e.id, e.is_active)}>{e.is_active ? 'Desativar' : 'Ativar'}</Button>
                                <Button type="button" size="icon" variant="ghost" onClick={() => deleteEdge(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
    </div>
  );
}
