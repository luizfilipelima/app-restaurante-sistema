import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getSubdomain } from '@/lib/subdomain';
import { isWithinOpeningHours } from '@/lib/utils';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BioRestaurant {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  phone_country?: string | null;
  language?: string | null;
  is_active: boolean;
  is_manually_closed?: boolean;
  always_open?: boolean;
  opening_hours?: Record<string, { open: string; close: string } | null>;
}

// ── Translations ──────────────────────────────────────────────────────────────

type Lang = 'pt' | 'es';

const TEXTS: Record<Lang, {
  deliveryMenu: string;
  deliverySub: string;
  whatsapp: string;
  whatsappSub: string;
  whatsappMsg: string;
  openNow: string;
  closedNow: string;
  notFound: string;
}> = {
  pt: {
    deliveryMenu: 'Ver Cardápio de Delivery',
    deliverySub: 'Peça online agora',
    whatsapp: 'Fazer Pedido pelo WhatsApp',
    whatsappSub: 'Fale diretamente conosco',
    whatsappMsg: 'Olá! Quero fazer um pedido 🍽️',
    openNow: 'Aberto agora',
    closedNow: 'Fechado',
    notFound: 'Restaurante não encontrado',
  },
  es: {
    deliveryMenu: 'Ver Menú de Delivery',
    deliverySub: 'Pide online ahora',
    whatsapp: 'Hacer Pedido por WhatsApp',
    whatsappSub: 'Hablá directamente con nosotros',
    whatsappMsg: '¡Hola! Quiero hacer un pedido 🍽️',
    openNow: 'Abierto ahora',
    closedNow: 'Cerrado',
    notFound: 'Restaurante no encontrado',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMenuUrl(slug: string): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return `http://localhost:5173/${slug}`;
  }
  return `https://${slug}.quiero.food`;
}

function buildWhatsAppUrl(restaurant: BioRestaurant, lang: Lang): string {
  const raw = (restaurant.whatsapp || restaurant.phone || '').replace(/\D/g, '');
  if (!raw) return '#';
  const country = restaurant.phone_country || 'BR';
  const prefix = country === 'PY' ? '595' : country === 'AR' ? '54' : '55';
  const number = raw.startsWith(prefix) ? raw : prefix + raw;
  const msg = encodeURIComponent(TEXTS[lang].whatsappMsg);
  return `https://wa.me/${number}?text=${msg}`;
}

// ── Animation variants ────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const logoVariants: Variants = {
  hidden: { scale: 0.75, opacity: 0, y: 8 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 280 },
  },
};

const itemVariants: Variants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 26, stiffness: 320 },
  },
};

const buttonVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 24, stiffness: 300 },
  },
};

// ── Language Toggle ───────────────────────────────────────────────────────────

function LangToggle({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      className="absolute top-5 right-5 z-20 flex items-center bg-white border border-slate-200 rounded-full px-1 py-1 shadow-sm hover:shadow-md transition-shadow"
    >
      {(['pt', 'es'] as Lang[]).map((l) => (
        <span
          key={l}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all duration-200 ${
            lang === l
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {l.toUpperCase()}
        </span>
      ))}
    </motion.button>
  );
}

// ── WhatsApp SVG icon ─────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LinkBioProps {
  tenantSlug?: string;
}

export default function LinkBio({ tenantSlug: tenantSlugProp }: LinkBioProps = {}) {
  const params = useParams<{ restaurantSlug?: string }>();
  const subdomain = getSubdomain();

  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const [restaurant, setRestaurant] = useState<BioRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('pt');

  useEffect(() => {
    if (!restaurantSlug) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('id, name, slug, logo, whatsapp, phone, phone_country, language, is_active, is_manually_closed, always_open, opening_hours')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        if (data) {
          setRestaurant(data as BioRestaurant);
          setLang((data.language === 'es' ? 'es' : 'pt') as Lang);
          document.title = data.name;
        }
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantSlug]);

  const t = TEXTS[lang];

  const isOpen = restaurant
    ? restaurant.is_manually_closed
      ? false
      : restaurant.always_open
        ? true
        : restaurant.opening_hours && Object.keys(restaurant.opening_hours).length > 0
          ? isWithinOpeningHours(restaurant.opening_hours as Record<string, { open: string; close: string } | null>)
          : true
    : false;

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen min-h-[100dvh] flex items-center justify-center bg-white overflow-hidden">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-8 h-8 rounded-2xl bg-slate-100"
        />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────────
  if (!restaurant) {
    return (
      <div className="h-screen min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-white px-6 text-center overflow-hidden">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold text-slate-700"
        >
          {t.notFound}
        </motion.p>
        <a href="https://quiero.food" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
          quiero.food
        </a>
      </div>
    );
  }

  const menuUrl = buildMenuUrl(restaurant.slug);
  const whatsAppUrl = buildWhatsAppUrl(restaurant, lang);
  const hasWhatsApp = !!(restaurant.whatsapp || restaurant.phone);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-screen min-h-[100dvh] w-full bg-white flex flex-col items-center overflow-hidden">

      {/* Subtle radial light at top */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(251,146,60,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Language toggle */}
      <LangToggle lang={lang} onToggle={() => setLang((l) => (l === 'pt' ? 'es' : 'pt'))} />

      {/* Content — ocupa 100% com distribuição equilibrada */}
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[340px] mx-auto px-5 flex-1 flex flex-col justify-between py-6 sm:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >

        {/* Bloco superior: logo + nome + status */}
        <div className="flex flex-col items-center gap-5 flex-shrink-0 pt-4 sm:pt-8">
          {/* ── Logo ── */}
          <motion.div variants={logoVariants}>
            <div className="relative w-20 h-20 sm:w-24 sm:h-24">
            {restaurant.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="w-full h-full object-cover rounded-[22px] shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-slate-100"
              />
            ) : (
              <div className="w-full h-full rounded-[22px] bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_8px_32px_rgba(249,115,22,0.25)] border border-orange-200">
                <span className="text-4xl font-black text-white leading-none select-none">
                  {restaurant.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </motion.div>

          {/* ── Name + status ── */}
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
              {restaurant.name}
            </h1>
            <AnimatePresence mode="wait">
              <motion.span
                key={isOpen ? 'open' : 'closed'}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                  isOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isOpen ? t.openNow : t.closedNow}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Botões (área central flexível) ── */}
        <div className="flex-1 flex flex-col justify-center w-full min-h-0 py-4">
          <div className="w-full flex flex-col gap-3">

          {/* Delivery menu */}
          <motion.a
            variants={buttonVariants}
            whileTap={{ scale: 0.97 }}
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 w-full bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0 text-xl shadow-sm group-hover:scale-105 transition-transform duration-200">
              🍽️
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight">{t.deliveryMenu}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{restaurant.slug}.quiero.food</p>
            </div>
            <motion.svg
              viewBox="0 0 16 16"
              className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-orange-400 transition-colors"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              animate={{ x: [0, 2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          </motion.a>

          {/* WhatsApp */}
          {hasWhatsApp && (
            <motion.a
              variants={buttonVariants}
              whileTap={{ scale: 0.97 }}
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 w-full bg-[#25D366] hover:bg-[#22c35e] rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <WhatsAppIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-white leading-tight">{t.whatsapp}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{t.whatsappSub}</p>
              </div>
              <motion.svg
                viewBox="0 0 16 16"
                className="w-4 h-4 text-white/40 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                animate={{ x: [0, 2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </motion.a>
          )}
          </div>
        </div>

        {/* ── Footer: apenas logomarca ── */}
        <motion.a
          variants={itemVariants}
          href="https://quiero.food"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center justify-center py-2 group"
        >
          <img
            src="/quierofood-logo-f.svg"
            alt="Quiero.food"
            className="h-5 w-auto object-contain opacity-25 group-hover:opacity-40 transition-opacity"
          />
        </motion.a>
      </motion.div>
    </div>
  );
}
