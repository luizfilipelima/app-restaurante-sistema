import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { usePizzaConfig, usePizzaConfigMutations } from '@/hooks/queries/usePizzaConfig';
import { formatPrice, convertPriceToStorage, getCurrencySymbol } from '@/lib/priceHelper';
import type { PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import type { CurrencyCode } from '@/lib/priceHelper';
import { toast } from '@/hooks/shared/use-toast';

interface PizzaConfigSectionProps {
  restaurantId: string | null;
  currency: CurrencyCode;
}

export default function PizzaConfigSection({ restaurantId, currency }: PizzaConfigSectionProps) {
  const { sizes, flavors, doughs, edges, loading } = usePizzaConfig(restaurantId);
  const mut = usePizzaConfigMutations(restaurantId);

  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeMaxFlavors, setNewSizeMaxFlavors] = useState('2');
  const [newFlavorName, setNewFlavorName] = useState('');
  const [newDoughName, setNewDoughName] = useState('');
  const [newEdgeName, setNewEdgeName] = useState('');
  const [newEdgePrice, setNewEdgePrice] = useState('');

  const handleAddSize = async () => {
    const name = newSizeName.trim();
    if (!name) return;
    try {
      await mut.createSize.mutateAsync({
        name,
        max_flavors: Math.max(1, parseInt(newSizeMaxFlavors, 10) || 2),
        price_multiplier: 1,
      });
      setNewSizeName('');
      setNewSizeMaxFlavors('2');
      toast({ title: 'Tamanho adicionado!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleAddFlavor = async () => {
    const name = newFlavorName.trim();
    if (!name) return;
    try {
      await mut.createFlavor.mutateAsync({ name, price: 0 });
      setNewFlavorName('');
      toast({ title: 'Sabor adicionado!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleAddDough = async () => {
    const name = newDoughName.trim();
    if (!name) return;
    try {
      await mut.createDough.mutateAsync({ name, extra_price: 0 });
      setNewDoughName('');
      toast({ title: 'Massa adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleAddEdge = async () => {
    const name = newEdgeName.trim();
    if (!name) return;
    try {
      const price = newEdgePrice.trim() ? convertPriceToStorage(newEdgePrice, currency) : 0;
      await mut.createEdge.mutateAsync({ name, price });
      setNewEdgeName('');
      setNewEdgePrice('');
      toast({ title: 'Borda adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleDelete = async (
    fn: () => Promise<unknown>,
    label: string
  ) => {
    try {
      await fn();
      toast({ title: `${label} removido(a)!` });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/20">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Configuração Custom</span>
        <span className="text-xs text-muted-foreground">— tamanhos, sabores, massas e bordas (aplicam a todos os produtos da categoria Custom)</span>
      </div>
      <div className="p-4 space-y-6">
        {/* Tamanhos */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Tamanhos</Label>
          <ul className="space-y-1">
            {sizes.map((s: PizzaSize) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-background/60">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">até {s.max_flavors} sabores</span>
                <button type="button" onClick={() => handleDelete(() => mut.deleteSize.mutateAsync(s.id), s.name)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Ex: Grande" value={newSizeName} onChange={(e) => setNewSizeName(e.target.value)}
              className="h-9 w-32" onKeyDown={(e) => e.key === 'Enter' && handleAddSize()} />
            <Input type="number" min={1} max={5} value={newSizeMaxFlavors} onChange={(e) => setNewSizeMaxFlavors(e.target.value)}
              className="h-9 w-20" placeholder="Sabores" />
            <Button type="button" size="sm" onClick={handleAddSize} disabled={!newSizeName.trim() || mut.createSize.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Sabores */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Sabores</Label>
          <ul className="flex flex-wrap gap-1.5">
            {flavors.filter((f: PizzaFlavor) => f.is_active).map((f: PizzaFlavor) => (
              <li key={f.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/60 text-sm">
                <span>{f.name}</span>
                {f.price > 0 && <span className="text-xs text-muted-foreground">+{formatPrice(f.price, currency)}</span>}
                <button type="button" onClick={() => handleDelete(() => mut.deleteFlavor.mutateAsync(f.id), f.name)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="Ex: Margherita, Calabresa" value={newFlavorName} onChange={(e) => setNewFlavorName(e.target.value)}
              className="h-9 flex-1 max-w-xs" onKeyDown={(e) => e.key === 'Enter' && handleAddFlavor()} />
            <Button type="button" size="sm" onClick={handleAddFlavor} disabled={!newFlavorName.trim() || mut.createFlavor.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Massas */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Tipos de massa</Label>
          <ul className="flex flex-wrap gap-1.5">
            {doughs.filter((d: PizzaDough) => d.is_active).map((d: PizzaDough) => (
              <li key={d.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/60 text-sm">
                <span>{d.name}</span>
                {d.extra_price > 0 && <span className="text-xs text-muted-foreground">+{formatPrice(d.extra_price, currency)}</span>}
                <button type="button" onClick={() => handleDelete(() => mut.deleteDough.mutateAsync(d.id), d.name)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="Ex: Tradicional, Integral" value={newDoughName} onChange={(e) => setNewDoughName(e.target.value)}
              className="h-9 flex-1 max-w-xs" onKeyDown={(e) => e.key === 'Enter' && handleAddDough()} />
            <Button type="button" size="sm" onClick={handleAddDough} disabled={!newDoughName.trim() || mut.createDough.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Bordas */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Bordas recheadas</Label>
          <ul className="flex flex-wrap gap-1.5">
            {edges.filter((e: PizzaEdge) => e.is_active).map((e: PizzaEdge) => (
              <li key={e.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/60 text-sm">
                <span>{e.name}</span>
                <span className="text-xs text-muted-foreground">+{formatPrice(e.price, currency)}</span>
                <button type="button" onClick={() => handleDelete(() => mut.deleteEdge.mutateAsync(e.id), e.name)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Ex: Catupiry, Cheddar" value={newEdgeName} onChange={(e) => setNewEdgeName(e.target.value)}
              className="h-9 w-36" onKeyDown={(k) => k.key === 'Enter' && handleAddEdge()} />
            <Input placeholder={`Preço (${getCurrencySymbol(currency)})`} value={newEdgePrice} onChange={(e) => setNewEdgePrice(e.target.value)}
              className="h-9 w-28" />
            <Button type="button" size="sm" onClick={handleAddEdge} disabled={!newEdgeName.trim() || mut.createEdge.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
