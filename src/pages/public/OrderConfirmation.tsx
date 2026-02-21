import { useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, MessageCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSubdomain } from '@/lib/subdomain';

type OrderType = 'delivery' | 'pickup';

interface OrderConfirmationProps {
  tenantSlug?: string;
}

export default function OrderConfirmation({ tenantSlug: tenantSlugProp }: OrderConfirmationProps = {}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useParams();
  const subdomain = getSubdomain();

  const orderId = searchParams.get('orderId');
  const type = (searchParams.get('type') || 'pickup') as OrderType;
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const isDelivery = type === 'delivery';

  const handleBackToMenu = () => {
    if (restaurantSlug && !subdomain) navigate(`/${restaurantSlug}`);
    else navigate('/');
  };

  // Scroll to top on mount (mobile)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!orderId) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 safe-area-inset">
        <p className="text-slate-600 text-center">{t('orderConfirmation.invalidLink')}</p>
        <Button onClick={handleBackToMenu} className="mt-4">
          {t('checkout.backToMenu')}
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="order-confirmation-page" className="min-h-[100dvh] bg-gradient-to-b from-emerald-50/80 via-white to-slate-50 flex flex-col safe-area-inset">
      {/* Content — centered, mobile-first */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 sm:py-12 max-w-md mx-auto w-full">
        {/* Success icon with animation */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 200, delay: 0.1 }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-600" strokeWidth={2} />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', damping: 12 }}
            className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg"
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl font-bold text-slate-900 text-center leading-tight"
        >
          {t('orderConfirmation.title')}
        </motion.h1>

        {/* Subtitle — contextual message */}
        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 text-base sm:text-lg text-slate-600 text-center leading-relaxed max-w-[320px]"
        >
          {isDelivery
            ? t('orderConfirmation.deliveryMessage')
            : t('orderConfirmation.pickupMessage')}
        </motion.p>

        {/* Info card */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 w-full max-w-sm rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm p-4 sm:p-5"
        >
          <p className="text-sm text-slate-500 text-center">
            {t('orderConfirmation.whatsappInfo')}
          </p>
        </motion.div>

        {/* CTA: Voltar ao cardápio */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 w-full max-w-sm"
        >
          <Button
            variant="outline"
            onClick={handleBackToMenu}
            className="w-full h-12 rounded-xl text-slate-600 hover:bg-slate-50 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('checkout.backToMenu')}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
