import { useState, useEffect } from 'react';
import { supabase } from '@/lib/core/supabase';
import { useCanAccess } from '@/hooks/auth/useUserRole';
import {
  convertPriceToStorage,
  convertPriceFromStorage,
  formatPrice,
} from '@/lib/priceHelper';
import type { CurrencyCode } from '@/lib/priceHelper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/shared/use-toast';
import { Loader2, Settings2 } from 'lucide-react';
import type { Restaurant } from '@/types';

interface DeliverySettingsModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string | null;
  restaurant: Restaurant | null;
  onSaved?: () => void;
}

export function DeliverySettingsModal({
  open,
  onClose,
  restaurantId,
  restaurant,
  onSaved,
}: DeliverySettingsModalProps) {
  const canAccess = useCanAccess(['super_admin', 'owner', 'manager', 'restaurant_admin']);
  const currency = (restaurant?.currency ?? 'BRL') as CurrencyCode;

  const [enabled, setEnabled] = useState(false);
  const [valueInput, setValueInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && restaurant) {
      const enabledVal = restaurant.delivery_min_order_enabled ?? false;
      const val = restaurant.delivery_min_order_value ?? 0;
      setEnabled(enabledVal);
      setValueInput(val > 0 ? convertPriceFromStorage(val, currency) : '');
    }
  }, [open, restaurant, currency]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const valueStorage = valueInput.trim()
        ? convertPriceToStorage(valueInput, currency)
        : 0;

      const { error } = await supabase
        .from('restaurants')
        .update({
          delivery_min_order_enabled: enabled,
          delivery_min_order_value: Math.max(0, valueStorage),
        })
        .eq('id', restaurantId);

      if (error) throw error;

      onSaved?.();
      toast({ title: 'Configurações do delivery salvas!' });
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações do delivery
          </DialogTitle>
          <DialogDescription>
            Define o valor mínimo para pedidos de delivery. Ao ativar, o cliente não poderá finalizar um pedido com valor menor no checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Exigir valor mínimo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando ativo, pedidos abaixo do valor definido não poderão ser enviados.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <div className="space-y-2">
              <Label htmlFor="min-value">Valor mínimo ({currency === 'PYG' ? 'guaranís' : currency === 'ARS' ? 'pesos' : 'reais'})</Label>
              <Input
                id="min-value"
                type="text"
                placeholder={currency === 'PYG' ? 'Ex: 40.000' : 'Ex: 25,00'}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                className="font-mono"
              />
              {valueInput.trim() && (
                <p className="text-xs text-muted-foreground">
                  Valor exibido ao cliente: {formatPrice(convertPriceToStorage(valueInput, currency), currency)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
