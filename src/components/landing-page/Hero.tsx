import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useMainLanding, mlc } from '@/contexts/MainLandingCtx';

export default function Hero() {
  const { c, primaryColor, waLink } = useMainLanding();

  const badgeText       = mlc(c, 'main_hero', 'badge_text',         'Novo: Modo Cozinha Inteligente v2.0');
  const headline        = mlc(c, 'main_hero', 'headline',           'O Delivery que vende sozinho no WhatsApp.');
  const highlight       = mlc(c, 'main_hero', 'headline_highlight', 'WhatsApp');
  const subheadline     = mlc(c, 'main_hero', 'subheadline',        'Cardápio digital, pedidos em tempo real, zonas de entrega, motoboys, cupom térmico e impressão automática. Tudo em um só lugar.');
  const ctaLabel        = mlc(c, 'main_hero', 'cta_label',          'Criar Cardápio Grátis');
  const emailPH         = mlc(c, 'main_hero', 'email_placeholder',  'seu@email.com');
  const socialCount     = mlc(c, 'main_hero', 'social_proof_count', '+100');
  const socialText      = mlc(c, 'main_hero', 'social_proof_text',  'Usado por <strong>+100 restaurantes</strong> no Paraguai');
  const heroImageUrl    = mlc(c, 'main_hero', 'hero_image_url',     '');
  const heroImageLabel  = mlc(c, 'main_hero', 'hero_image_label',   'Dashboard Screenshot Mockup');
  const heroImageAlt    = mlc(c, 'main_hero', 'hero_image_alt',     'Dashboard do QuieroFood');

  // Divide o headline em volta do highlight
  const hlIdx   = headline.indexOf(highlight);
  const beforeH = hlIdx >= 0 ? headline.slice(0, hlIdx) : headline;
  const afterH  = hlIdx >= 0 ? headline.slice(hlIdx + highlight.length) : '';

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 bg-slate-50 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-100/30 to-slate-50/0 pointer-events-none" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-8">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-600"
          >
            <span className="flex h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
            {badgeText}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          >
            {hlIdx >= 0 ? (
              <>
                {beforeH}
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: `linear-gradient(to right, ${primaryColor}, #f59e0b)` }}
                >
                  {highlight}
                </span>
                {afterH}
              </>
            ) : headline}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed"
          >
            {subheadline}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md"
          >
            <input
              type="email"
              placeholder={emailPH}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-200 outline-none transition-all shadow-sm"
              style={{ ['--tw-ring-color' as string]: `${primaryColor}33` }}
            />
            <Button
              className="w-full sm:w-auto h-12 px-8 rounded-xl text-white font-semibold shadow-lg whitespace-nowrap group"
              style={{ backgroundColor: primaryColor }}
              asChild
            >
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="pt-8 flex flex-col items-center gap-4"
          >
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-8 rounded-full ring-2 ring-white bg-slate-200" />
              ))}
              <div className="h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                {socialCount}
              </div>
            </div>
            <p
              className="text-sm text-slate-500"
              dangerouslySetInnerHTML={{ __html: socialText }}
            />
          </motion.div>
        </div>

        {/* Hero Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.5, type: 'spring' }}
          className="mt-16 md:mt-24 relative max-w-5xl mx-auto perspective-1000"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white aspect-[16/9] group">
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={heroImageAlt}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                <span className="text-slate-400 font-medium">{heroImageLabel}</span>
              </div>
            )}
            {/* Phone Mockup Floating */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -right-4 -bottom-12 w-1/4 aspect-[9/16] bg-slate-900 rounded-[2.5rem] border-[8px] border-slate-900 shadow-xl overflow-hidden hidden md:block"
            >
              <div className="w-full h-full bg-white flex items-center justify-center">
                <span className="text-slate-300 text-xs">Mobile App</span>
              </div>
            </motion.div>
          </div>
          {/* Glow */}
          <div
            className="absolute -inset-4 blur-3xl -z-10 rounded-[3rem] opacity-20"
            style={{ backgroundColor: primaryColor }}
          />
        </motion.div>
      </div>
    </section>
  );
}
