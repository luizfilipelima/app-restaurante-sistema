import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { DayKey, PrintPaperWidth } from '@/types';
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
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { Save, Upload, Loader2, Clock, Instagram, Printer } from 'lucide-react';

export default function AdminSettings() {
  const restaurantId = useAdminRestaurantId();
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
    always_open: false,
    opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width: '80mm' as PrintPaperWidth,
  });
  const [logoUploading, setLogoUploading] = useState(false);


  useEffect(() => {
    if (restaurantId) {
      loadRestaurant();
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
        always_open: !!data.always_open,
        opening_hours: DAYS.reduce((acc, d) => ({ ...acc, [d.key]: hours[d.key] || null }), {} as Record<DayKey, { open: string; close: string } | null>),
        print_auto_on_new_order: !!data.print_auto_on_new_order,
        print_paper_width: (data.print_paper_width === '58mm' ? '58mm' : '80mm') as PrintPaperWidth,
      });
    } catch (error) {
      console.error('Erro ao carregar restaurante:', error);
    } finally {
      setLoading(false);
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
          always_open: formData.always_open,
          opening_hours: formData.opening_hours,
          print_auto_on_new_order: formData.print_auto_on_new_order,
          print_paper_width: formData.print_paper_width,
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
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
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
              <div className="flex items-center justify-between rounded-lg border p-4 bg-emerald-50/50 border-emerald-200/60">
                <div>
                  <Label className="font-medium">Sempre aberto (24h)</Label>
                  <p className="text-xs text-muted-foreground">Quando marcado, o estabelecimento é considerado em funcionamento o tempo todo. Ignora os horários por dia abaixo.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.always_open}
                  onChange={(e) => setFormData({ ...formData, always_open: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </div>
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
                <Label>Horários por dia {formData.always_open && <span className="text-muted-foreground font-normal">(ignorados quando &quot;Sempre aberto&quot; está ativo)</span>}</Label>
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
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Impressão de pedidos (cupom)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Cupom não fiscal para impressoras térmicas. Ao receber um novo pedido, o navegador abrirá o diálogo de impressão (não é possível imprimir silenciosamente na web).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="font-medium">Impressão automática ao receber pedido</Label>
                  <p className="text-xs text-muted-foreground">Se ativo, ao chegar um novo pedido será aberta a janela de impressão para o cupom.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.print_auto_on_new_order}
                  onChange={(e) => setFormData({ ...formData, print_auto_on_new_order: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </div>
              <div>
                <Label>Largura do papel</Label>
                <Select
                  value={formData.print_paper_width}
                  onValueChange={(v) => setFormData({ ...formData, print_paper_width: v as PrintPaperWidth })}
                >
                  <SelectTrigger className="w-full max-w-[200px] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58 mm (bobina estreita)</SelectItem>
                    <SelectItem value="80mm">80 mm (bobina padrão)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Ajuste conforme a impressora térmica.</p>
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

          <Button type="submit" size="lg" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </form>
    </div>
  );
}
