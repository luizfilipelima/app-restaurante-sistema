/**
 * QuieroFood — Landing Page Premium (v2)
 * Dark Mode · Z-Pattern · Foco em conversão · Tríplice Fronteira
 * CTA → WhatsApp | Entrar → app.quiero.food
 *
 * Conteúdo editável via painel Super Admin → /super-admin/landing-page
 * O conteúdo é lido do banco; valores padrão são usados enquanto carrega.
 */

import { useRef, createContext, useContext } from 'react';
import { useLandingPageContent, type LandingContent } from '@/hooks/queries/useLandingPageContent';
import {
  motion,
  useInView,
  type Variants,
  type Transition,
} from 'framer-motion';
import {
  MapPin,
  Banknote,
  WifiOff,
  BrainCircuit,
  Shield,
  ChevronRight,
  Check,
  Star,
  ArrowRight,
  MessageCircle,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Links padrão (fallback enquanto o conteúdo do banco carrega) ─────────────

const DEFAULT_WA_LINK =
  'https://wa.me/5575992776610?text=Ol%C3%A1%20Filipe%2C%20gostaria%20de%20implementar%20o%20QuieroFood%20no%20meu%20neg%C3%B3cio%20com%20o%20plano%20gratuito%20de%207%20dias';
const DEFAULT_APP_LINK = 'https://app.quiero.food';

// ─── Context de conteúdo da landing ──────────────────────────────────────────

interface LandingCtxValue {
  c: LandingContent;
  waLink: string;
  appLink: string;
}

const LandingCtx = createContext<LandingCtxValue>({
  c: {},
  waLink: DEFAULT_WA_LINK,
  appLink: DEFAULT_APP_LINK,
});

function useLandingCtx() {
  return useContext(LandingCtx);
}

function lc(content: LandingContent, section: string, key: string, fallback = ''): string {
  return content[section]?.[key] ?? fallback;
}

// ─── Variantes de animação ────────────────────────────────────────────────────

const defaultTransition: Transition = { duration: 0.55, ease: 'easeOut' };

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Hook: animação de scroll ─────────────────────────────────────────────────

function AnimatedSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Botão CTA WhatsApp ───────────────────────────────────────────────────────

function CtaButton({
  label,
  size = 'md',
  className = '',
}: {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { waLink } = useLandingCtx();
  const sizes = {
    sm: 'text-sm px-5 py-3',
    md: 'text-base px-7 py-4',
    lg: 'text-base sm:text-lg px-8 py-5 font-black',
  };
  return (
    <a
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2.5 rounded-2xl bg-[#F87116] text-white font-bold
        shadow-[0_0_0_1px_rgba(248,113,22,0.4),0_8px_40px_rgba(248,113,22,0.45)]
        hover:shadow-[0_0_0_1px_rgba(248,113,22,0.6),0_8px_60px_rgba(248,113,22,0.65)]
        hover:bg-orange-500 hover:-translate-y-0.5 active:translate-y-0
        transition-all duration-200 ${sizes[size]} ${className}`}
    >
      <MessageCircle className="h-4 w-4 flex-shrink-0" />
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </a>
  );
}

// ─── SEÇÃO 1: HERO (Foco em Conversão · Tríplice Fronteira) ───────────────────

function Hero() {
  const { c, waLink } = useLandingCtx();

  const headline    = lc(c, 'hero', 'headline',    'Pare de perder pedidos (e entregadores) por causa de sistemas que não entendem a fronteira.');
  const subheadline = lc(c, 'hero', 'subheadline', 'O Quiero.Food é a única plataforma de gestão gastronômica feita sob medida para Foz, CDE e Iguazú. Mapa interativo que funciona, conversão automática de moedas e pedidos direto no seu WhatsApp.');
  const ctaPrimary  = lc(c, 'hero', 'cta_primary_label',  'Testar Grátis por 30 Dias');
  const ctaSecond   = lc(c, 'hero', 'cta_secondary_label', 'Ver Demonstração');

  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-5 pt-24 pb-16 overflow-hidden">
      {/* Fundo com glow radial */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#F87116]/8 blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/6 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <AnimatedSection className="relative z-10 max-w-4xl mx-auto w-full text-center space-y-8">
        <motion.h1
          variants={fadeUp}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.1] tracking-tight"
        >
          {headline}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-lg sm:text-xl text-muted-foreground text-slate-400 leading-relaxed max-w-3xl mx-auto"
        >
          {subheadline}
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row gap-3 items-center justify-center"
        >
          <Button
            asChild
            size="lg"
            className="h-12 px-8 text-base font-bold bg-[#F87116] hover:bg-orange-500 text-white border-0"
          >
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              {ctaPrimary}
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 px-8 text-base font-semibold border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <a href="#funcionalidades">
              {ctaSecond}
            </a>
          </Button>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 2: FEATURE ZIGZAG (Z-Pattern · Alternando Imagem e Texto) ───────────

interface FeatureZigZagProps {
  title: string;
  description: string;
  imageSrc?: string;
  isReversed: boolean;
  icon: LucideIcon;
}

function FeatureZigZag({ title, description, imageSrc, isReversed, icon: Icon }: FeatureZigZagProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`flex flex-col md:flex-row gap-8 md:gap-12 lg:gap-16 items-center w-full max-w-6xl mx-auto ${
        isReversed ? 'md:flex-row-reverse' : ''
      }`}
    >
      {/* Bloco de texto */}
      <div className="flex-1 space-y-4 text-center md:text-left order-2 md:order-1">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F87116]/15 text-[#F87116]">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {title}
        </h3>
        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Bloco de imagem/placeholder */}
      <div className="flex-1 w-full order-1 md:order-2">
        {/* TODO: Substituir por print/mockup real para que eu saiba onde colocar as imagens (como a do mapa no celular) depois. */}
        <div className="bg-slate-800/60 rounded-xl border border-white/10 shadow-lg aspect-video flex items-center justify-center min-h-[200px] md:min-h-[280px]">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <span className="text-slate-500 text-sm font-medium">Preview</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── SEÇÃO 6: PRICING ────────────────────────────────────────────────────────

function PricingHeader() {
  const { c } = useLandingCtx();
  const sectionLabel = lc(c, 'pricing', 'section_label', 'Planos');
  const headline     = lc(c, 'pricing', 'headline',      'Escolha o seu nível de poder.');
  const subtext      = lc(c, 'pricing', 'subtext',       'Sem taxas escondidas. Sem comissão sobre as suas vendas.');
  return (
    <div className="text-center space-y-3">
      <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#F87116]">
        {sectionLabel}
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-white">
        {headline}
      </motion.h2>
      <motion.p variants={fadeUp} className="text-slate-400">
        {subtext}
      </motion.p>
    </div>
  );
}

const plans = [
  {
    name: 'Core',
    tagline: 'Para dar o primeiro passo',
    features: ['Cardápio Público (QR Code)', 'Kanban de Pedidos', 'Display de Cozinha (KDS)', 'KPIs Essenciais'],
    cta: 'Começar Gratuitamente',
    highlight: false,
  },
  {
    name: 'Standard',
    tagline: 'Para controle total da operação',
    badge: 'Mais Escolhido',
    features: ['Tudo do Core', 'QR Code por Mesa', 'Zonas de Entrega com Taxa', 'Impressão Térmica Automática', 'Preços em BRL & PYG', 'Análise de Canais'],
    cta: 'Quero Este Plano',
    highlight: true,
  },
  {
    name: 'Enterprise',
    tagline: 'Para redes e alto volume',
    features: ['Tudo do Standard', 'BI Avançado — Matriz BCG', 'Churn Recovery via WhatsApp', 'Módulo Buffet Offline', 'Inventário com CMV', 'RBAC Completo'],
    cta: 'Falar com Especialista',
    highlight: false,
  },
];

function Pricing() {
  const { waLink } = useLandingCtx();

  return (
    <section className="relative py-20 sm:py-28 px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <AnimatedSection className="max-w-5xl mx-auto space-y-12">
        <PricingHeader />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className={`relative flex flex-col rounded-2xl p-6 border backdrop-blur-xl transition-all duration-300 ${
                plan.highlight
                  ? 'border-[#F87116]/40 bg-[#F87116]/[0.08] shadow-[0_0_60px_rgba(248,113,22,0.12)] md:-translate-y-3 md:scale-[1.03]'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-[#F87116] text-white text-[11px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(248,113,22,0.5)]">
                    <Star className="h-2.5 w-2.5 fill-white" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="space-y-1 mb-6">
                <h3 className={`text-xl font-extrabold ${plan.highlight ? 'text-[#F87116]' : 'text-white'}`}>
                  {plan.name}
                </h3>
                <p className="text-sm text-slate-400">{plan.tagline}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className={`h-4 w-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-[#F87116]' : 'text-emerald-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  plan.highlight
                    ? 'bg-[#F87116] text-white shadow-[0_0_30px_rgba(248,113,22,0.4)] hover:shadow-[0_0_50px_rgba(248,113,22,0.6)]'
                    : 'border border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                {plan.cta}
                <ChevronRight className="h-4 w-4" />
              </a>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 7: DEPOIMENTOS ─────────────────────────────────────────────────────

const DEFAULT_TESTIMONIALS = [
  { quote: 'Desde que usamos o Quiero, nossos pedidos saem 30% mais rápido. O suporte local faz a diferença.', name: 'Carlos Benitez', role: 'Pizzaria Bella Italia', initials: 'CB' },
  { quote: 'A integração com a impressora térmica é perfeita. Não perdemos mais nenhum pedido no horário de pico.', name: 'Maria González', role: 'Burger House CDE', initials: 'MG' },
  { quote: 'O cardápio em Guarani e Reais facilitou muito para nossos clientes brasileiros e paraguaios.', name: 'Fernando Silva', role: 'Sushi House', initials: 'FS' },
];

function Testimonials() {
  const { c } = useLandingCtx();

  const sectionLabel = lc(c, 'testimonials', 'section_label', 'Depoimentos');
  const headline     = lc(c, 'testimonials', 'headline',      'Quem usa, recomenda.');

  let testimonials: Array<{ quote: string; name: string; role: string; initials: string }> = DEFAULT_TESTIMONIALS;
  try {
    const raw = c.testimonials?.items;
    if (raw) testimonials = JSON.parse(raw);
  } catch { /* usa default */ }

  return (
    <section className="py-20 sm:py-24 px-5">
      <AnimatedSection className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#F87116]">
            {sectionLabel}
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-white">
            {headline}
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 space-y-4 hover:bg-white/[0.07] transition-all"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#F87116] text-[#F87116]" />
                ))}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                  {t.initials}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 8: FINAL CTA ───────────────────────────────────────────────────────

function FinalCTA() {
  const { c } = useLandingCtx();

  const headline      = lc(c, 'final_cta', 'headline',       'Sua transformação começa agora.');
  const body          = lc(c, 'final_cta', 'body',           'Você pode continuar pagando 20% para aplicativos, ou pode transformar seu restaurante em uma máquina lucrativa e silenciosa hoje.');
  const ctaLabel      = lc(c, 'final_cta', 'cta_label',      'Quero Assumir o Controle do Meu Restaurante');
  const guaranteeText = lc(c, 'final_cta', 'guarantee_text', 'Nossa equipe fará um diagnóstico rápido. Se a QuieroFood não for perfeita para você, nós mesmos diremos isso. Risco zero.');

  return (
    <section className="relative py-24 sm:py-32 px-5 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[400px] bg-[#F87116]/5 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <AnimatedSection className="relative z-10 max-w-2xl mx-auto text-center space-y-8">
        <motion.h2
          variants={fadeUp}
          className="text-3xl sm:text-5xl font-extrabold text-white leading-tight"
        >
          {headline}
        </motion.h2>

        <motion.p variants={fadeUp} className="text-base sm:text-lg text-slate-400 leading-relaxed">
          {body}
        </motion.p>

        <motion.div variants={fadeUp} className="flex justify-center">
          <CtaButton label={ctaLabel} size="lg" />
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="inline-flex items-start gap-3 bg-white/[0.04] border border-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 max-w-md mx-auto text-left"
        >
          <Shield className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {guaranteeText}
          </p>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

function Navbar() {
  const { c, appLink } = useLandingCtx();

  let navItems: string[] = ['Funcionalidades', 'Planos', 'Contato'];
  try {
    const raw = c.navbar?.nav_items;
    if (raw) navItems = JSON.parse(raw) as string[];
  } catch { /* usa default */ }

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-5 border-b border-white/[0.07] bg-slate-950/75 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        {/* Logo SVG */}
        <a href="/" className="flex items-center flex-shrink-0">
          <img
            src="/logo_quiero_food.svg"
            alt="QuieroFood"
            className="h-7 w-auto"
          />
        </a>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a
            href={appLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2 hidden sm:block"
          >
            Entrar
          </a>
          <CtaButton label="Testar Grátis" size="sm" />
        </div>
      </div>
    </header>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  const { c, appLink } = useLandingCtx();

  // O copyright_text pode estar em 'footer' ou 'navbar' (editor unificado na aba Navbar & Rodapé)
  const copyrightText = c.footer?.copyright_text
    ?? c.navbar?.copyright_text
    ?? 'QuieroFood. Todos os direitos reservados. Feito para a Tríplice Fronteira.';

  return (
    <footer className="border-t border-white/[0.07] py-10 px-5 bg-slate-950">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img src="/logo_quiero_food.svg" alt="QuieroFood" className="h-6 w-auto opacity-70" />
        <p className="text-xs text-slate-600 text-center">
          © {new Date().getFullYear()} {copyrightText}
        </p>
        <a
          href={appLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Acessar Plataforma
        </a>
      </div>
    </footer>
  );
}

// ─── PAGE SHELL ───────────────────────────────────────────────────────────────

export default function QuieroFoodLanding() {
  const { data: content = {} } = useLandingPageContent();

  const waLink  = content.hero?.wa_link  ?? DEFAULT_WA_LINK;
  const appLink = content.hero?.app_link ?? DEFAULT_APP_LINK;

  const features = [
    {
      title: 'Mapa Anti-Erro: O fim do motoboy perdido',
      description:
        'Chega de clientes mandando áudio de 2 minutos para explicar onde moram. Nosso sistema abre o mapa da sua cidade e o cliente apenas arrasta o pino. Seu entregador recebe a rota exata no WhatsApp.',
      icon: MapPin,
      isReversed: false,
    },
    {
      title: 'PIX, Guaraníes ou Pesos? Tudo na mesma tela.',
      description:
        'O Quiero.Food faz o câmbio automático no momento do pedido. No fim da noite, seu fechamento de caixa mostra exatamente quanto você tem que ter na gaveta de cada moeda. Diga adeus à calculadora no balcão.',
      icon: Banknote,
      isReversed: true,
    },
    {
      title: 'Operação à Prova de Queda de Internet',
      description:
        'A internet caiu no meio do almoço de domingo? Nosso Módulo Buffet e Comandas funciona 100% offline. Pese a comida, feche contas e o sistema sincroniza sozinho quando a internet voltar.',
      icon: WifiOff,
      isReversed: false,
    },
    {
      title: 'Fidelidade Automática e IA que previne perdas',
      description:
        'Reconheça seu cliente pelo número do WhatsApp. Na 10ª compra, o prêmio é liberado automaticamente. Nossa Inteligência Artificial analisa suas vendas e avisa quem está sumido para você reativar.',
      icon: BrainCircuit,
      isReversed: true,
    },
  ];

  return (
    <LandingCtx.Provider value={{ c: content, waLink, appLink }}>
      <div className="min-h-screen bg-slate-950 text-white font-sans antialiased overflow-x-hidden">
        <Navbar />
        <Hero />
        <section id="funcionalidades" className="py-16 sm:py-24 md:py-28 px-5 space-y-20 md:space-y-28">
          {features.map((f) => (
            <FeatureZigZag
              key={f.title}
              title={f.title}
              description={f.description}
              icon={f.icon}
              isReversed={f.isReversed}
            />
          ))}
        </section>
        <Pricing />
        <Testimonials />
        <FinalCTA />
        <Footer />
      </div>
    </LandingCtx.Provider>
  );
}
