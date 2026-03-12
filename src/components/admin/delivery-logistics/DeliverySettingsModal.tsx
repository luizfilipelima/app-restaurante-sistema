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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/shared/use-toast';
import { Loader2, Settings2, MessageCircle, Package, Bike, MapPin } from 'lucide-react';
import type { Restaurant, WhatsAppTemplates } from '@/types';
import { DEFAULT_TEMPLATES } from '@/lib/whatsapp/whatsappTemplates';
import { WhatsAppTemplatesEditor } from './WhatsAppTemplatesEditor';
import { DeliveryCouriersSection } from './DeliveryCouriersSection';
import { DeliveryZonesSection } from './DeliveryZonesSection';

export type DeliverySettingsTab = 'min_order' | 'whatsapp' | 'entregadores' | 'zonas';

interface DeliverySettingsModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string | null;
  restaurant: Restaurant | null;
  onSaved?: () => void;
  /** Aba inicial ao abrir (ex.: ao vir da página Entregadores ou Áreas de entrega) */
  initialTab?: DeliverySettingsTab;
}

export function DeliverySettingsModal({
  open,
  onClose,
  restaurantId,
  restaurant,
  onSaved,
  initialTab = 'min_order',
}: DeliverySettingsModalProps) {
  const canAccess = useCanAccess(['super_admin', 'owner', 'manager', 'restaurant_admin']);
  const currency = (restaurant?.currency ?? 'BRL') as CurrencyCode;

  const [enabled, setEnabled] = useState(false);
  const [valueInput, setValueInput] = useState('');
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplates>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<DeliverySettingsTab>(initialTab);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (open && restaurant) {
      const enabledVal = restaurant.delivery_min_order_enabled ?? false;
      const val = restaurant.delivery_min_order_value ?? 0;
      setEnabled(enabledVal);
      setValueInput(val > 0 ? convertPriceFromStorage(val, currency) : '');
      setWhatsappTemplates(restaurant.whatsapp_templates ?? {});
    }
  }, [open, restaurant, currency]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const valueStorage = valueInput.trim()
        ? convertPriceToStorage(valueInput, currency)
        : 0;

      const payload = {
        delivery_min_order_enabled: enabled,
        delivery_min_order_value: Math.max(0, valueStorage),
        whatsapp_templates: {
          new_order: whatsappTemplates.new_order ?? DEFAULT_TEMPLATES.new_order,
          delivery_notification: whatsappTemplates.delivery_notification ?? DEFAULT_TEMPLATES.delivery_notification,
          preparing_notification: whatsappTemplates.preparing_notification ?? DEFAULT_TEMPLATES.preparing_notification,
          courier_dispatch: whatsappTemplates.courier_dispatch ?? DEFAULT_TEMPLATES.courier_dispatch,
        },
      };

      const { error } = await supabase
        .from('restaurants')
        .update(payload)
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações do delivery
          </DialogTitle>
          <DialogDescription>
            Valor mínimo de pedido, mensagens WhatsApp e outras opções relacionadas ao delivery.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeliverySettingsTab)} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl h-10 bg-muted/60 flex-shrink-0">
            <TabsTrigger value="min_order" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Package className="h-3.5 w-3.5 shrink-0" />
              Pedido mín.
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#25D366]" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="entregadores" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Bike className="h-3.5 w-3.5 shrink-0" />
              Entregadores
            </TabsTrigger>
            <TabsTrigger value="zonas" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Áreas
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4 min-h-0">
            <TabsContent value="min_order" className="mt-0 space-y-6 focus-visible:ring-0">
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
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-0 focus-visible:ring-0">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground mb-4">
                  Personalize os textos enviados via WhatsApp. Use as variáveis disponíveis — linhas com variáveis vazias são removidas automaticamente.
                </p>
                <WhatsAppTemplatesEditor
                  value={whatsappTemplates}
                  onChange={setWhatsappTemplates}
                  compact
                />
              </div>
            </TabsContent>

            <TabsContent value="entregadores" className="mt-0 focus-visible:ring-0">
              <DeliveryCouriersSection restaurantId={restaurantId} />
            </TabsContent>

            <TabsContent value="zonas" className="mt-0 focus-visible:ring-0">
              <DeliveryZonesSection
                restaurantId={restaurantId}
                restaurant={restaurant}
                baseCurrency={currency}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0">
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
