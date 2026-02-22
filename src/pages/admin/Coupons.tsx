import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRestaurantId, useAdminCurrency, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import { useDiscountCoupons } from '@/hooks/queries/useDiscountCoupons';
import type { DiscountCoupon } from '@/types';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Ticket, Plus, Pencil, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { convertPriceToStorage, convertPriceFromStorage, getCurrencySymbol } from '@/lib/priceHelper';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminCoupons() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const basePath = useAdminBasePath();
  const { t } = useAdminTranslation();
  const { coupons, loading, createCoupon, updateCoupon, deleteCoupon, refetch } = useDiscountCoupons(restaurantId);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountCoupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '',
    is_active: true,
    max_uses: '',
    valid_from: '',
    valid_until: '',
  });

  const openCreate = () => {
    setEditingCoupon(null);
    setForm({
      code: '',
      discount_type: 'percent',
      discount_value: '10',
      is_active: true,
      max_uses: '',
      valid_from: '',
      valid_until: '',
    });
    setModalOpen(true);
  };

  const openEdit = (coupon: DiscountCoupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_type === 'percent'
        ? String(coupon.discount_value)
        : String(convertPriceFromStorage(coupon.discount_value, currency)),
      is_active: coupon.is_active,
      max_uses: coupon.max_uses != null ? String(coupon.max_uses) : '',
      valid_from: coupon.valid_from ? format(new Date(coupon.valid_from), 'yyyy-MM-dd') : '',
      valid_until: coupon.valid_until ? format(new Date(coupon.valid_until), 'yyyy-MM-dd') : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !form.code.trim()) return;

    const discountValue = form.discount_type === 'percent'
      ? Math.min(100, Math.max(0, parseInt(form.discount_value, 10) || 0))
      : convertPriceToStorage(form.discount_value, currency);

    if (Number.isNaN(discountValue) || discountValue < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    if (form.discount_type === 'percent' && discountValue > 100) {
      toast({ title: 'Percentual deve ser entre 0 e 100', variant: 'destructive' });
      return;
    }

    const maxUses = form.max_uses.trim() ? parseInt(form.max_uses, 10) : null;
    if (maxUses != null && (Number.isNaN(maxUses) || maxUses < 1)) {
      toast({ title: 'Uso máximo inválido', variant: 'destructive' });
      return;
    }

    const validFrom = form.valid_from ? `${form.valid_from}T00:00:00` : null;
    const validUntil = form.valid_until ? `${form.valid_until}T23:59:59` : null;
    if (validFrom && validUntil && new Date(validUntil) < new Date(validFrom)) {
      toast({ title: 'Data de fim deve ser após o início', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, {
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: form.discount_type === 'percent' ? discountValue : Math.round(discountValue),
          is_active: form.is_active,
          max_uses: maxUses,
          valid_from: validFrom,
          valid_until: validUntil,
        });
        toast({ title: t('coupons.updateOk') });
      } else {
        await createCoupon({
          restaurant_id: restaurantId,
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: form.discount_type === 'percent' ? discountValue : Math.round(discountValue),
          is_active: form.is_active,
          max_uses: maxUses,
          valid_from: validFrom,
          valid_until: validUntil,
        });
        toast({ title: t('coupons.createOk') });
      }
      setModalOpen(false);
      setEditingCoupon(null);
      refetch();
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar cupom',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!deleteTarget || deleteTarget.id !== id) return;
    setDeleting(true);
    try {
      await deleteCoupon(id);
      toast({ title: t('coupons.deleteOk') });
      setDeleteTarget(null);
      refetch();
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const stats = {
    all: coupons.length,
    active: coupons.filter((c) => c.is_active).length,
    inactive: coupons.filter((c) => !c.is_active).length,
  };

  const filteredCoupons =
    statusFilter === 'all'
      ? coupons
      : statusFilter === 'active'
      ? coupons.filter((c) => c.is_active)
      : coupons.filter((c) => !c.is_active);

  const formatDiscount = (c: DiscountCoupon) =>
    c.discount_type === 'percent'
      ? `${c.discount_value}%`
      : formatCurrency(c.discount_value, currency);

  const formatValidity = (c: DiscountCoupon) => {
    if (!c.valid_from && !c.valid_until) return '—';
    const from = c.valid_from ? format(new Date(c.valid_from), 'dd/MM/yyyy', { locale: ptBR }) : '...';
    const until = c.valid_until ? format(new Date(c.valid_until), 'dd/MM/yyyy', { locale: ptBR }) : '...';
    return `${from} → ${until}`;
  };

  if (loading && coupons.length === 0) {
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
            <Ticket className="h-8 w-8 text-orange-500" />
            {t('coupons.title')}
          </h1>
          <p className="text-muted-foreground">{t('coupons.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`${basePath}/menu`}>
              Central do Cardápio
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('coupons.addCoupon')}
          </Button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="p-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 mb-5">
              <Ticket className="h-8 w-8 text-orange-600" />
            </div>
            <p className="font-semibold text-lg text-foreground mb-2">{t('coupons.noCoupons')}</p>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">{t('coupons.noCouponsDesc')}</p>
            <Button size="lg" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('coupons.addCoupon')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList className="h-11 px-1">
                <TabsTrigger value="all" className="gap-2 px-4">
                  {t('coupons.filterAll')}
                  <span className="text-xs text-muted-foreground">({stats.all})</span>
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-2 px-4">
                  {t('coupons.filterActive')}
                  <span className="text-xs text-muted-foreground">({stats.active})</span>
                </TabsTrigger>
                <TabsTrigger value="inactive" className="gap-2 px-4">
                  {t('coupons.filterInactive')}
                  <span className="text-xs text-muted-foreground">({stats.inactive})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card>
            {filteredCoupons.length === 0 ? (
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground mb-4">
                  {statusFilter === 'active' ? 'Nenhum cupom ativo.' : 'Nenhum cupom inativo.'}
                </p>
                <Button variant="outline" onClick={() => setStatusFilter('all')}>
                  Ver todos
                </Button>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('coupons.tableCode')}</TableHead>
                    <TableHead>{t('coupons.tableType')}</TableHead>
                    <TableHead>{t('coupons.tableValue')}</TableHead>
                    <TableHead>{t('coupons.tableUses')}</TableHead>
                    <TableHead>{t('coupons.tableStatus')}</TableHead>
                    <TableHead>{t('coupons.tableValid')}</TableHead>
                    <TableHead className="w-[100px] text-right">{t('coupons.tableActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <code className="font-mono font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          {coupon.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {coupon.discount_type === 'percent' ? t('coupons.percent') : t('coupons.fixed')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-emerald-600">{formatDiscount(coupon)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {coupon.use_count}
                          {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={coupon.is_active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                          {coupon.is_active ? t('coupons.filterActive') : t('coupons.filterInactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatValidity(coupon)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(coupon)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ id: coupon.id, name: coupon.code })}
                            className="text-destructive hover:text-destructive"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('coupons.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {deleteTarget ? t('coupons.deleteDesc', { name: deleteTarget.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingCoupon(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 pb-4">
            <DialogTitle className="flex items-center gap-2.5 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Ticket className="h-5 w-5" />
              </div>
              {editingCoupon ? 'Editar cupom' : t('coupons.addCoupon')}
            </DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Configure o código e o valor do desconto. O cliente digita o código no checkout.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t('coupons.code')} *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder={t('coupons.codePlaceholder')}
                className="font-mono uppercase"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('coupons.discountType')}</Label>
                <div className="flex gap-2">
                  <label
                    className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                      form.discount_type === 'percent'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-border hover:border-orange-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="discount_type"
                      checked={form.discount_type === 'percent'}
                      onChange={() => setForm((f) => ({ ...f, discount_type: 'percent', discount_value: f.discount_value || '10' }))}
                      className="sr-only"
                    />
                    {t('coupons.percent')}
                  </label>
                  <label
                    className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                      form.discount_type === 'fixed'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-border hover:border-orange-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="discount_type"
                      checked={form.discount_type === 'fixed'}
                      onChange={() => setForm((f) => ({ ...f, discount_type: 'fixed', discount_value: '' }))}
                      className="sr-only"
                    />
                    {t('coupons.fixed')}
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">{t('coupons.discountValue')} *</Label>
                <div className="relative">
                  {form.discount_type === 'percent' ? (
                    <>
                      <Input
                        id="discount_value"
                        type="number"
                        min={1}
                        max={100}
                        value={form.discount_value}
                        onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                        placeholder={t('coupons.discountPercentPlaceholder')}
                        className="pr-8"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </>
                  ) : (
                    <>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{getCurrencySymbol(currency)}</span>
                      <Input
                        id="discount_value"
                        type="text"
                        inputMode="decimal"
                        value={form.discount_value}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            discount_value: currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value,
                          }))
                        }
                        placeholder={t('coupons.discountFixedPlaceholder')}
                        className="pl-10"
                        required
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses">{t('coupons.maxUses')}</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min={1}
                  value={form.max_uses}
                  onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                  placeholder={t('coupons.maxUsesPlaceholder')}
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-input text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium">{t('coupons.isActive')}</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from">{t('coupons.validFrom')}</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">{t('coupons.validUntil')}</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="min-w-[120px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingCoupon ? 'Salvar alterações' : 'Criar cupom'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
