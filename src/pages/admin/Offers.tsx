import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAdminRestaurantId, useAdminCurrency, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import { useProductOffers } from '@/hooks/queries';
import { supabase } from '@/lib/supabase';
import type { Product, ProductOffer, OfferRepeatDay } from '@/types';

const REPEAT_DAYS: { key: OfferRepeatDay; label: string }[] = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tag, Plus, Pencil, Trash2, Loader2, ArrowRight, Package, Calendar, Repeat } from 'lucide-react';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { convertPriceToStorage, convertPriceFromStorage, getCurrencySymbol } from '@/lib/priceHelper';
import { format, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminOffers() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const basePath = useAdminBasePath();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useAdminTranslation();
  const { offers, loading, createOffer, updateOffer, deleteOffer, refetch } = useProductOffers(restaurantId);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ProductOffer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    offer_price: '',
    original_price: '',
    starts_at: '',
    starts_at_time: '00:00',
    ends_at: '',
    ends_at_time: '23:59',
    label: '',
    immediate: true,
    repeat_days: [] as OfferRepeatDay[],
  });

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts(data ?? []));
  }, [restaurantId]);

  const productIdFromUrl = searchParams.get('productId');
  useEffect(() => {
    if (!productIdFromUrl || products.length === 0) return;
    const p = products.find((x) => x.id === productIdFromUrl);
    if (p) {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const tomorrow = format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd');
      const price = Number(p.price_sale || p.price);
      setForm({
        product_id: p.id,
        offer_price: String(convertPriceFromStorage(Math.round(price * 0.9), currency)),
        original_price: String(convertPriceFromStorage(price, currency)),
        starts_at: today,
        starts_at_time: '00:00',
        ends_at: tomorrow,
        ends_at_time: '23:59',
        label: '',
        immediate: true,
        repeat_days: [],
      });
      setModalOpen(true);
      setSearchParams({});
    }
  }, [productIdFromUrl, products, currency]);

  const openCreate = (preselectedProduct?: Product) => {
    setEditingOffer(null);
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const tomorrow = format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd');
    setForm({
      product_id: preselectedProduct?.id ?? '',
      offer_price: preselectedProduct ? String(convertPriceFromStorage(Number(preselectedProduct.price_sale || preselectedProduct.price) * 0.9, currency)) : '',
      original_price: preselectedProduct ? String(convertPriceFromStorage(Number(preselectedProduct.price_sale || preselectedProduct.price), currency)) : '',
      starts_at: today,
      starts_at_time: '00:00',
      ends_at: tomorrow,
      ends_at_time: '23:59',
      label: '',
      immediate: true,
      repeat_days: [],
    });
    setModalOpen(true);
  };

  const openEdit = (offer: ProductOffer) => {
    setEditingOffer(offer);
    const start = new Date(offer.starts_at);
    const end = new Date(offer.ends_at);
    setForm({
      product_id: offer.product_id,
      offer_price: String(convertPriceFromStorage(offer.offer_price, currency)),
      original_price: String(convertPriceFromStorage(offer.original_price, currency)),
      starts_at: format(start, 'yyyy-MM-dd'),
      starts_at_time: format(start, 'HH:mm'),
      ends_at: format(end, 'yyyy-MM-dd'),
      ends_at_time: format(end, 'HH:mm'),
      label: offer.label ?? '',
      immediate: false,
      repeat_days: (offer.repeat_days ?? []) as OfferRepeatDay[],
    });
    setModalOpen(true);
  };

  const handleProductChange = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (p) {
      const price = Number(p.price_sale || p.price);
      setForm((f) => ({
        ...f,
        product_id: productId,
        offer_price: String(convertPriceFromStorage(Math.round(price * 0.9), currency)),
        original_price: String(convertPriceFromStorage(price, currency)),
      }));
    } else {
      setForm((f) => ({ ...f, product_id: productId, offer_price: '', original_price: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !form.product_id) return;
    const offerPrice = convertPriceToStorage(form.offer_price, currency);
    const originalPrice = convertPriceToStorage(form.original_price, currency);
    if (Number.isNaN(offerPrice) || Number.isNaN(originalPrice) || offerPrice < 0 || originalPrice < 0) {
      toast({ title: 'Preços inválidos', variant: 'destructive' });
      return;
    }
    let startsAt: Date;
    let endsAt: Date;
    if (form.immediate) {
      startsAt = new Date();
      endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
    } else {
      startsAt = new Date(`${form.starts_at}T${form.starts_at_time}:00`);
      endsAt = new Date(`${form.ends_at}T${form.ends_at_time}:00`);
    }
    if (endsAt <= startsAt) {
      toast({ title: 'Data de fim deve ser após o início', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingOffer) {
        await updateOffer(editingOffer.id, {
          offer_price: offerPrice,
          original_price: originalPrice,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          label: form.label.trim() || null,
          repeat_days: form.repeat_days.length > 0 ? form.repeat_days : null,
        });
        toast({ title: t('offers.updateOk') });
      } else {
        await createOffer({
          product_id: form.product_id,
          offer_price: offerPrice,
          original_price: originalPrice,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          label: form.label.trim() || null,
          repeat_days: form.repeat_days.length > 0 ? form.repeat_days : null,
        });
        toast({ title: t('offers.createOk') });
      }
      setModalOpen(false);
      refetch();
    } catch (err: unknown) {
      toast({ title: 'Erro ao salvar oferta', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('offers.deleteConfirm'))) return;
    try {
      await deleteOffer(id);
      toast({ title: t('offers.deleteOk') });
      refetch();
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  const getOfferStatus = (o: ProductOffer) => {
    const now = new Date();
    const start = new Date(o.starts_at);
    const end = new Date(o.ends_at);
    if (isBefore(now, start)) return { label: t('offers.scheduled'), color: 'bg-amber-500/15 text-amber-700' };
    if (isAfter(now, end)) return { label: 'Expirada', color: 'bg-slate-200 text-slate-600' };
    return { label: t('offers.active'), color: 'bg-emerald-500/15 text-emerald-700' };
  };

  if (loading && offers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-8 w-8 text-orange-500" />
            {t('offers.title')}
          </h1>
          <p className="text-muted-foreground">{t('offers.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`${basePath}/menu`}>
              Central do Cardápio
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-2" />
            {t('offers.addOffer')}
          </Button>
        </div>
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 mb-4">
              <Tag className="h-7 w-7 text-orange-600" />
            </div>
            <p className="font-semibold text-foreground mb-1">{t('offers.noOffers')}</p>
            <p className="text-sm text-muted-foreground mb-6">{t('offers.noOffersDesc')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => openCreate()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('offers.addOffer')}
              </Button>
              <Button asChild variant="outline">
                <Link to={`${basePath}/menu`}>Ir para Central do Cardápio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const status = getOfferStatus(offer);
            const product = offer.product;
            return (
              <Card key={offer.id} className="overflow-hidden">
                <div className="flex">
                  <div className="w-20 h-20 flex-shrink-0 bg-muted flex items-center justify-center">
                    {product?.image_url ? (
                      <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold truncate">{product?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{product?.category}</p>
                      </div>
                      <Badge variant="outline" className={status.color}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="line-through text-muted-foreground">{formatCurrency(offer.original_price, currency)}</span>
                      <span className="font-bold text-orange-600">{formatCurrency(offer.offer_price, currency)}</span>
                      {offer.label && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{offer.label}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {offer.repeat_days && offer.repeat_days.length > 0 ? (
                        <>
                          Recorre: {offer.repeat_days.map((d) => REPEAT_DAYS.find((x) => x.key === d)?.label ?? d).join(', ')} ·{' '}
                          {format(new Date(offer.starts_at), 'HH:mm', { locale: ptBR })}–{format(new Date(offer.ends_at), 'HH:mm', { locale: ptBR })}
                        </>
                      ) : (
                        <>
                          {format(new Date(offer.starts_at), "dd/MM HH:mm", { locale: ptBR })} — {format(new Date(offer.ends_at), "dd/MM HH:mm", { locale: ptBR })}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-1 p-2 border-t bg-muted/30">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(offer)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(offer.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-orange-500" />
              {editingOffer ? 'Editar oferta' : t('offers.addOffer')}
            </DialogTitle>
            <DialogDescription>
              Configure o produto, preço promocional e período. Para ofertas recorrentes, marque os dias da semana.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('offers.product')} *</Label>
              <Select
                value={form.product_id}
                onValueChange={handleProductChange}
                required
                disabled={!!editingOffer}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(Number(p.price_sale || p.price), currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t('offers.originalPrice')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.original_price}
                  onChange={(e) => setForm((f) => ({ ...f, original_price: currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value }))}
                  className="h-11"
                  placeholder={getCurrencySymbol(currency)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t('offers.offerPrice')} *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.offer_price}
                  onChange={(e) => setForm((f) => ({ ...f, offer_price: currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value }))}
                  className="h-11"
                  placeholder={getCurrencySymbol(currency)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('offers.label')}</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t('offers.labelPlaceholder')}
                className="h-11"
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="immediate"
                  checked={form.immediate}
                  onChange={(e) => setForm((f) => ({ ...f, immediate: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="immediate" className="cursor-pointer font-medium text-sm">Oferta imediata (inicia agora, fim em 24h)</Label>
              </div>
              {!form.immediate && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('offers.startDate')}</Label>
                    <div className="flex gap-2">
                      <Input type="date" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} className="flex-1" />
                      <Input type="time" value={form.starts_at_time} onChange={(e) => setForm((f) => ({ ...f, starts_at_time: e.target.value }))} className="w-24" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('offers.endDate')}</Label>
                    <div className="flex gap-2">
                      <Input type="date" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} className="flex-1" />
                      <Input type="time" value={form.ends_at_time} onChange={(e) => setForm((f) => ({ ...f, ends_at_time: e.target.value }))} className="w-24" />
                    </div>
                  </div>
                </div>
              )}
              {form.immediate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Início: agora · Fim: em 24 horas
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Repetir em dias da semana</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para oferta única. Marque os dias em que a oferta deve se repetir toda semana.
              </p>
              <div className="flex flex-wrap gap-2">
                {REPEAT_DAYS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center justify-center w-11 h-11 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                      form.repeat_days.includes(key)
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-muted hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.repeat_days.includes(key)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          repeat_days: e.target.checked
                            ? [...f.repeat_days, key]
                            : f.repeat_days.filter((d) => d !== key),
                        }));
                      }}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingOffer ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
