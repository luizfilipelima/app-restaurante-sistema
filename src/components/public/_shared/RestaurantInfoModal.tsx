/**
 * Modal de informações do restaurante exibido no cardápio público.
 * Logo, nome, telefone, horário de funcionamento e descrição.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RestaurantAboutContent } from '@/components/public/_shared/RestaurantAboutContent';
import type { Restaurant } from '@/types';

interface RestaurantInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant | null;
}

function RestaurantInfoModal({ open, onOpenChange, restaurant }: RestaurantInfoModalProps) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const lang = (i18n.language === 'es' ? 'es' : 'pt') as 'pt' | 'es';
  const slug = restaurant?.slug ?? '';
  const basePath = slug && location.pathname.startsWith(`/${slug}`) ? `/${slug}` : '';

  if (!restaurant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[400px] rounded-2xl p-0 overflow-hidden border border-border shadow-xl"
        hideClose={false}
      >
        <RestaurantAboutContent
          restaurant={restaurant}
          lang={lang}
          basePath={basePath}
          onReservaClick={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export default memo(RestaurantInfoModal);
