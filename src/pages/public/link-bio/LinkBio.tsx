import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getSubdomain } from '@/lib/subdomain';
import { isWithinOpeningHours } from '@/lib/utils';

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

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchBioRestaurant(slug: string): Promise<BioRestaurant | null> {
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo, whatsapp, phone, phone_country, language, is_active, is_manually_closed, always_open, opening_hours')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  return (data as BioRestaurant) ?? null;
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
    closedNow: 'Fechado no momento',
    notFound: 'Restaurante não encontrado',
  },
  es: {
    deliveryMenu: 'Ver Menú de Delivery',
    deliverySub: 'Pide online ahora',
    whatsapp: 'Hacer Pedido por WhatsApp',
    whatsappSub: 'Hablá directamente con nosotros',
    whatsappMsg: '¡Hola! Quiero hacer un pedido 🍽️',
    openNow: 'Abierto ahora',
    closedNow: 'Cerrado ahora',
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

// ── SVG icons ─────────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Language Toggle ───────────────────────────────────────────────────────────

function LangToggle({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="absolute top-4 right-4 z-30 flex items-center bg-card/90 backdrop-blur-sm border border-border rounded-full p-1 shadow-md active:scale-[0.93] transition-transform duration-150"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}
    >
      {(['pt', 'es'] as Lang[]).map((l) => (
        <span
          key={l}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide transition-all duration-200 ${
            lang === l
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l.toUpperCase()}
        </span>
      ))}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LinkBioProps {
  tenantSlug?: string;
}

export default function LinkBio({ tenantSlug: tenantSlugProp }: LinkBioProps = {}) {
  const params = useParams<{ restaurantSlug?: string }>();
  const [searchParams] = useSearchParams();
  const subdomain = getSubdomain();

  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const [lang, setLang] = useState<Lang>('pt');
  // `mounted` dispara as CSS transitions de entrada — só ativa após o dado carregar
  const [mounted, setMounted] = useState(false);

  const { data: restaurant, isLoading: loading } = useQuery({
    queryKey: ['bio-restaurant', restaurantSlug],
    queryFn: () => fetchBioRestaurant(restaurantSlug!),
    enabled: !!restaurantSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (restaurant) {
      setLang((restaurant.language === 'es' ? 'es' : 'pt') as Lang);
      document.title = restaurant.name;
    }
  }, [restaurant]);

  // Dispara as animações de entrada no próximo frame após os dados chegarem
  useEffect(() => {
    if (!restaurant) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [restaurant]);

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
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-2xl bg-primary/20 animate-pulse" />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────────
  if (!restaurant) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-lg font-semibold text-foreground animate-[fadeIn_0.35s_ease_forwards]">
          {t.notFound}
        </p>
        <a href="https://quiero.food" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          quiero.food
        </a>
      </div>
    );
  }

  const phoneParam = searchParams.get('phone') ?? searchParams.get('wa') ?? searchParams.get('tel');
  const menuUrl = buildMenuUrl(restaurant.slug) + (phoneParam ? `?phone=${encodeURIComponent(phoneParam)}` : '');
  const whatsAppUrl = buildWhatsAppUrl(restaurant, lang);
  const hasWhatsApp = !!(restaurant.whatsapp || restaurant.phone);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col overflow-hidden bg-background">

      {/* ── Background decorativo ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 100% 55% at 50% -5%, rgba(251,146,60,0.13) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 w-72 h-72 rounded-full z-0 opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.18) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full z-0 opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)' }}
      />

      {/* ── Language toggle ── */}
      <LangToggle lang={lang} onToggle={() => setLang((l) => (l === 'pt' ? 'es' : 'pt'))} />

      {/* ── Layout principal ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between w-full max-w-sm mx-auto px-6 pt-12 pb-[max(1.75rem,env(safe-area-inset-bottom))]">

        {/* ── Hero: logo + nome + status ── */}
        <div className="flex flex-col items-center gap-5 w-full pt-6">

          {/* Logo */}
          <div
            className={`relative transition-all duration-500 ease-out ${
              mounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-2'
            }`}
          >
            {/* Anel de glow */}
            <div
              className="absolute inset-0 rounded-[28px] z-0"
              style={{
                boxShadow: '0 0 0 8px rgba(251,146,60,0.10), 0 0 0 16px rgba(251,146,60,0.05)',
              }}
            />
            <div className="relative z-10 w-[108px] h-[108px] sm:w-[120px] sm:h-[120px]">
              {restaurant.logo ? (
                <img
                  src={restaurant.logo}
                  alt={restaurant.name}
                  width={120}
                  height={120}
                  className="w-full h-full object-cover rounded-[28px] border border-border"
                  style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.08)' }}
                />
              ) : (
                <div
                  className="w-full h-full rounded-[28px] bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center border border-primary/30"
                  style={{ boxShadow: '0 12px 40px var(--tw-shadow-color, rgba(0,0,0,0.13)), 0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  <span className="text-5xl font-black text-primary-foreground leading-none select-none">
                    {restaurant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Nome + badge */}
          <div
            className={`flex flex-col items-center gap-2.5 text-center transition-all duration-500 delay-100 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <h1 className="text-[26px] sm:text-[28px] font-extrabold text-foreground tracking-tight leading-tight">
              {restaurant.name}
            </h1>

            {/* Badge aberto/fechado */}
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[12px] font-semibold tracking-wide border transition-colors duration-300 ${
                isOpen
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isOpen ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                }`}
              />
              {isOpen ? t.openNow : t.closedNow}
            </span>
          </div>
        </div>

        {/* ── Botões de ação ── */}
        <div className="flex flex-col gap-3 w-full py-8 sm:py-10">

          {/* Delivery */}
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex items-center gap-4 w-full bg-card rounded-2xl px-4 py-4 overflow-hidden active:scale-[0.975] transition-all duration-500 delay-150 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
            style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)' }}
          >
            {/* Borda de destaque no hover */}
            <div className="absolute inset-0 rounded-2xl border border-border group-hover:border-primary/50 transition-colors duration-200" />
            {/* Fundo hover suave */}
            <div className="absolute inset-0 rounded-2xl bg-primary/0 group-hover:bg-primary/5 transition-all duration-200" />

            {/* Ícone */}
            <div
              className="relative z-10 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center flex-shrink-0 text-[22px] group-hover:scale-105 transition-transform duration-200"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            >
              🍽️
            </div>

            {/* Texto */}
            <div className="relative z-10 flex-1 min-w-0 text-left">
              <p className="text-[15px] font-bold text-foreground leading-tight">
                {t.deliveryMenu}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5 truncate font-medium">
                {restaurant.slug}.quiero.food
              </p>
            </div>

            {/* Seta — anima no hover */}
            <div className="relative z-10 flex-shrink-0">
              <ArrowIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </a>

          {/* WhatsApp */}
          {hasWhatsApp && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative flex items-center gap-4 w-full rounded-2xl px-4 py-4 overflow-hidden active:scale-[0.975] transition-all duration-500 delay-200 ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
              style={{
                background: 'linear-gradient(135deg, #25D366 0%, #1fba57 100%)',
                boxShadow: '0 4px 20px rgba(37,211,102,0.35), 0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              {/* Overlay brilho no hover */}
              <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/[0.08] transition-all duration-200" />

              {/* Ícone */}
              <div className="relative z-10 w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <WhatsAppIcon className="w-6 h-6 text-white" />
              </div>

              {/* Texto */}
              <div className="relative z-10 flex-1 min-w-0 text-left">
                <p className="text-[15px] font-bold text-white leading-tight">
                  {t.whatsapp}
                </p>
                <p className="text-[12px] text-white/65 mt-0.5 font-medium">
                  {t.whatsappSub}
                </p>
              </div>

              {/* Seta — anima no hover */}
              <div className="relative z-10 flex-shrink-0">
                <ArrowIcon className="w-4 h-4 text-white/50 group-hover:translate-x-1 transition-transform duration-200" />
              </div>
            </a>
          )}
        </div>

        {/* ── Footer ── */}
        <a
          href="https://quiero.food"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-shrink-0 flex items-center justify-center pb-1 group transition-all duration-500 delay-300 ease-out ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span
            className="inline-block h-[18px] w-12 bg-primary opacity-70 group-hover:opacity-90 transition-opacity duration-300 shrink-0"
            style={{
              maskImage: 'url(/quierofood-logo-f.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/quierofood-logo-f.svg)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
            aria-hidden
          />
          <img src="/quierofood-logo-f.svg" alt="Quiero.food" className="sr-only" width={80} height={18} />
        </a>
      </div>
    </div>
  );
}
