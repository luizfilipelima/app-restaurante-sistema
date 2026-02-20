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
  whatsapp: string;
  whatsappMsg: string;
  openNow: string;
  closedNow: string;
  poweredBy: string;
  loading: string;
  notFound: string;
}> = {
  pt: {
    deliveryMenu: 'Ver Cardápio de Delivery',
    whatsapp: 'Fazer Pedido pelo WhatsApp',
    whatsappMsg: 'Olá! Quero fazer um pedido 🍽️',
    openNow: 'Aberto agora',
    closedNow: 'Fechado no momento',
    poweredBy: 'Desenvolvido por',
    loading: 'Carregando...',
    notFound: 'Restaurante não encontrado',
  },
  es: {
    deliveryMenu: 'Ver Menú de Delivery',
    whatsapp: 'Hacer Pedido por WhatsApp',
    whatsappMsg: '¡Hola! Quiero hacer un pedido 🍽️',
    openNow: 'Abierto ahora',
    closedNow: 'Cerrado por el momento',
    poweredBy: 'Desarrollado por',
    loading: 'Cargando...',
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const logoVariants: Variants = {
  hidden: { scale: 0.3, opacity: 0, rotate: -15 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: { type: 'spring' as const, damping: 18, stiffness: 260, delay: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { y: 28, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 24, stiffness: 300 },
  },
};

const buttonVariants: Variants = {
  hidden: { y: 24, opacity: 0, scale: 0.96 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
  },
  tap: { scale: 0.96 },
};

// ── Animated background blob ──────────────────────────────────────────────────

function Blob({ className, delay = 0, duration = 8 }: { className: string; delay?: number; duration?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        scale: [1, 1.25, 0.9, 1.15, 1],
        x: [0, 30, -15, 20, 0],
        y: [0, -25, 15, -10, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ── Pulsing ring around logo ──────────────────────────────────────────────────

function PulseRing({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full border-2 border-white/30"
      initial={{ scale: 1, opacity: 0.6 }}
      animate={{ scale: 1.6, opacity: 0 }}
      transition={{
        duration: 2.4,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// ── Language Toggle ───────────────────────────────────────────────────────────

function LangToggle({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, type: 'spring', stiffness: 300 }}
      onClick={onToggle}
      className="absolute top-4 right-4 z-20 flex items-center gap-0.5 bg-white/15 backdrop-blur-md border border-white/25 rounded-full px-1 py-0.5 shadow-lg"
      whileTap={{ scale: 0.92 }}
    >
      {(['pt', 'es'] as Lang[]).map((l) => (
        <span
          key={l}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200 ${
            lang === l
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-white/70 hover:text-white'
          }`}
        >
          {l.toUpperCase()}
        </span>
      ))}
    </motion.button>
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

  // Load restaurant
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
          document.title = `${data.name} — Link da Bio`;
        }
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantSlug]);

  const t = TEXTS[lang];

  // ── Open/closed ──────────────────────────────────────────────────────────────
  const isOpen = restaurant
    ? restaurant.is_manually_closed
      ? false
      : restaurant.always_open
        ? true
        : restaurant.opening_hours && Object.keys(restaurant.opening_hours).length > 0
          ? isWithinOpeningHours(restaurant.opening_hours as Record<string, { open: string; close: string } | null>)
          : true
    : false;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-10 w-10 rounded-full border-3 border-white/30 border-t-white"
          style={{ borderWidth: 3 }}
        />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-orange-600 to-amber-500 px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-white"
        >
          {t.notFound}
        </motion.p>
        <a href="https://quiero.food" className="text-white/70 text-sm underline underline-offset-2">
          quiero.food
        </a>
      </div>
    );
  }

  const menuUrl = buildMenuUrl(restaurant.slug);
  const whatsAppUrl = buildWhatsAppUrl(restaurant, lang);
  const hasWhatsApp = !!(restaurant.whatsapp || restaurant.phone);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden select-none">

      {/* ── Animated gradient background ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-700 via-orange-500 to-amber-400" />

      {/* ── Background blobs ── */}
      <Blob className="w-[420px] h-[420px] bg-orange-300/40 -top-32 -left-24" delay={0} duration={9} />
      <Blob className="w-[320px] h-[320px] bg-amber-300/30 -bottom-20 -right-16" delay={2} duration={10} />
      <Blob className="w-[240px] h-[240px] bg-red-400/20 top-1/3 -right-10" delay={4} duration={7} />
      <Blob className="w-[200px] h-[200px] bg-yellow-300/20 bottom-1/4 -left-10" delay={1.5} duration={11} />

      {/* Subtle grid texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Language toggle ── */}
      <LangToggle lang={lang} onToggle={() => setLang((l) => (l === 'pt' ? 'es' : 'pt'))} />

      {/* ── Main card ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-sm mx-auto px-5 py-8 flex flex-col items-center gap-6"
      >

        {/* Logo + pulse rings */}
        <motion.div variants={logoVariants} className="relative flex items-center justify-center">
          {/* Outer pulse rings */}
          <div className="relative h-28 w-28">
            <PulseRing delay={0} />
            <PulseRing delay={1.2} />
            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm shadow-[0_0_60px_rgba(255,255,255,0.3)]" />
            {restaurant.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="absolute inset-1.5 rounded-full object-cover border-2 border-white/60 shadow-xl"
              />
            ) : (
              <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-white/90 to-white/70 flex items-center justify-center shadow-xl border-2 border-white/60">
                <span className="text-4xl font-black text-orange-500 leading-none">
                  {restaurant.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Restaurant name */}
        <motion.div variants={itemVariants} className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
            {restaurant.name}
          </h1>

          {/* Open/closed badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isOpen ? 'open' : 'closed'}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-sm shadow-sm ${
                isOpen
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
                  : 'bg-slate-500/20 border-slate-400/40 text-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              {isOpen ? t.openNow : t.closedNow}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* CTA Buttons */}
        <div className="w-full space-y-3">
          {/* Delivery Menu */}
          <motion.a
            variants={buttonVariants}
            whileTap="tap"
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 w-full bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-xl shadow-black/20 hover:bg-white active:bg-white/90 transition-all duration-200 border border-white/50"
          >
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-2xl leading-none">🍽️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-base leading-tight">
                {t.deliveryMenu}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{restaurant.slug}.quiero.food</p>
            </div>
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-orange-500 opacity-60 flex-shrink-0"
            >
              →
            </motion.div>
          </motion.a>

          {/* WhatsApp */}
          {hasWhatsApp && (
            <motion.a
              variants={buttonVariants}
              whileTap="tap"
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 w-full bg-[#25D366] hover:bg-[#22c35d] active:bg-[#1eac54] rounded-2xl px-5 py-4 shadow-xl shadow-black/20 transition-all duration-200 border border-white/20"
            >
              <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-base leading-tight">
                  {t.whatsapp}
                </p>
                <p className="text-xs text-white/70 mt-0.5">WhatsApp</p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                className="text-white/60 flex-shrink-0"
              >
                →
              </motion.div>
            </motion.a>
          )}
        </div>

        {/* Footer */}
        <motion.a
          variants={itemVariants}
          href="https://quiero.food"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 mt-2 group"
        >
          <img
            src="/quierofood-logo-f.svg"
            alt="Quiero.food"
            className="h-6 w-auto object-contain opacity-60 group-hover:opacity-90 transition-opacity invert brightness-200"
          />
          <span className="text-white/40 text-[10px] font-medium tracking-wide group-hover:text-white/60 transition-colors">
            {t.poweredBy} quiero.food
          </span>
        </motion.a>
      </motion.div>
    </div>
  );
}
