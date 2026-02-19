/**
 * QuieroFood — Landing Page Premium (Dark Mode)
 * Arquétipo: Soberano + Mago | Paleta: Slate-950 + Amber-400
 * Animações: Framer Motion (scroll-triggered fade/slide)
 * Layout: Mobile-first, Bento Box features, Glassmorphism cards
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, type Variants, type Transition } from 'framer-motion';
import {
  MonitorPlay,
  Globe,
  WifiOff,
  TrendingUp,
  Shield,
  ChevronRight,
  Check,
  Zap,
  Star,
  ArrowRight,
} from 'lucide-react';

// ─── Helpers de animação ─────────────────────────────────────────────────────

const defaultTransition: Transition = { duration: 0.6, ease: 'easeOut' };

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

function AnimatedSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
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

// ─── SEÇÃO 1: HERO ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-24 pb-16 overflow-hidden text-center">
      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      <AnimatedSection className="relative z-10 max-w-4xl mx-auto space-y-8">
        {/* Badge */}
        <motion.div variants={fadeUp} className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-[11px] font-bold uppercase tracking-[0.15em] shadow-[0_0_24px_rgba(251,191,36,0.15)]">
            <Zap className="h-3 w-3 flex-shrink-0" />
            Exclusivo para Pizzarias, Hamburguerias e Restaurantes da Fronteira
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight"
        >
          Pare de Dividir Seu{' '}
          <span className="relative">
            <span className="text-amber-400">Lucro</span>
          </span>{' '}
          com Aplicativos e Acabe com o{' '}
          <span className="text-emerald-400">Caos</span> na Sua Cozinha.
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          variants={fadeUp}
          className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
        >
          O único sistema operacional gastronômico desenhado para a dinâmica da{' '}
          <span className="text-slate-200 font-medium">Tríplice Fronteira</span>. Do QR Code
          na mesa à tela da cozinha, gerencie pedidos em{' '}
          <span className="text-amber-300 font-semibold">Reais e Guaraníes</span> sem perder
          1% de comissão.
        </motion.p>

        {/* CTA */}
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-3">
          <Link
            to="/register"
            className="group relative inline-flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base sm:text-lg px-8 py-4 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.35)] hover:shadow-[0_0_60px_rgba(251,191,36,0.55)] transition-all duration-300 hover:-translate-y-1 active:translate-y-0"
          >
            Ver Demonstração na Prática
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="text-xs text-slate-500">
            Rápido. Sem cartão de crédito. Sem burocracia.
          </p>
        </motion.div>

        {/* Social proof strip */}
        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-6 pt-4"
        >
          {[
            { value: '500+', label: 'Restaurantes Ativos' },
            { value: 'R$0', label: 'de Comissão' },
            { value: '3 Países', label: 'Fronteira BR/PY/AR' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-black text-amber-400">{s.value}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 2: PROBLEM AGITATION ──────────────────────────────────────────────

function ProblemAgitation() {
  const pains = [
    'O WhatsApp não para de apitar e os pedidos chegam errados.',
    'Os garçons correm, mas a cozinha ainda não sabe o que preparar.',
    'O iFood e o PedidosYa devoram até 20% da sua margem.',
    'O sistema genérico que você usa hoje não entende a Fronteira.',
  ];

  return (
    <section className="relative py-20 sm:py-28 px-5 bg-slate-900/60">
      {/* Linha decorativa */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <AnimatedSection className="max-w-3xl mx-auto text-center space-y-10">
        <motion.h2
          variants={fadeUp}
          className="text-3xl sm:text-4xl font-extrabold text-white"
        >
          Você é{' '}
          <span className="text-red-400">dono do seu restaurante</span>{' '}
          ou{' '}
          <span className="text-red-400">refém dele?</span>
        </motion.h2>

        <motion.p variants={fadeUp} className="text-slate-400 text-base sm:text-lg leading-relaxed">
          Nós conhecemos a realidade de{' '}
          <span className="text-slate-200">Ciudad del Este, Foz e Puerto Iguazú</span>.
        </motion.p>

        <motion.ul variants={stagger} className="space-y-3 text-left">
          {pains.map((pain) => (
            <motion.li
              key={pain}
              variants={fadeUp}
              className="flex items-start gap-3 bg-white/5 border border-white/8 backdrop-blur-sm rounded-xl px-4 py-3.5"
            >
              <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              </span>
              <span className="text-slate-300 text-sm sm:text-base">{pain}</span>
            </motion.li>
          ))}
        </motion.ul>

        <motion.p
          variants={fadeUp}
          className="text-lg sm:text-xl font-bold text-white border-t border-slate-700 pt-8"
        >
          O sistema genérico que você usa hoje{' '}
          <span className="text-red-400">trava sua operação</span> em vez de libertá-la.
        </motion.p>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 3: FEATURES BENTO ─────────────────────────────────────────────────

const features = [
  {
    icon: MonitorPlay,
    title: 'A Cozinha Silenciosa (KDS)',
    description:
      'Pedidos vão direto do celular do cliente para telas na cozinha, com timers coloridos. Impressão térmica automática.',
    accent: 'emerald',
    size: 'large', // 2 colunas no desktop
  },
  {
    icon: Globe,
    title: 'O Cardápio Multi-Fronteira',
    description:
      'Cardápio interativo via QR Code operando nativamente em PT/ES e calculando preços em BRL/PYG.',
    accent: 'blue',
    size: 'small',
  },
  {
    icon: WifiOff,
    title: 'Operação Blindada (Offline-First)',
    description:
      'O módulo de Buffet e Comandas funciona perfeitamente mesmo sem internet, sincronizando ao reconectar.',
    accent: 'amber',
    size: 'small',
  },
  {
    icon: TrendingUp,
    title: 'A Inteligência de um CEO',
    description:
      'Painel Analytics avançado com Matriz BCG e Lista de Risco de Churn integrada ao WhatsApp.',
    accent: 'violet',
    size: 'large',
  },
];

const accentMap: Record<string, { border: string; glow: string; icon: string; badge: string }> = {
  emerald: {
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_40px_rgba(16,185,129,0.1)]',
    icon: 'bg-emerald-500/15 text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-300',
  },
  blue: {
    border: 'border-blue-500/30',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.1)]',
    icon: 'bg-blue-500/15 text-blue-400',
    badge: 'bg-blue-500/10 text-blue-300',
  },
  amber: {
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.1)]',
    icon: 'bg-amber-500/15 text-amber-400',
    badge: 'bg-amber-500/10 text-amber-300',
  },
  violet: {
    border: 'border-violet-500/30',
    glow: 'shadow-[0_0_40px_rgba(139,92,246,0.1)]',
    icon: 'bg-violet-500/15 text-violet-400',
    badge: 'bg-violet-500/10 text-violet-300',
  },
};

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const { icon: Icon, title, description, accent } = feature;
  const colors = accentMap[accent];

  return (
    <motion.div
      variants={fadeUp}
      className={`relative flex flex-col gap-4 rounded-2xl border ${colors.border} ${colors.glow} bg-white/[0.04] backdrop-blur-md p-6 hover:bg-white/[0.07] transition-colors duration-300 h-full`}
    >
      {/* Glow de canto */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20 blur-2xl -translate-y-6 translate-x-6"
        style={{ background: accent === 'emerald' ? '#10b981' : accent === 'blue' ? '#3b82f6' : accent === 'amber' ? '#f59e0b' : '#8b5cf6' }} />

      <div className={`h-12 w-12 rounded-xl ${colors.icon} flex items-center justify-center flex-shrink-0`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function FeaturesGrid() {
  return (
    <section className="py-20 sm:py-28 px-5">
      <AnimatedSection className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
            A Solução
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl font-extrabold text-white"
          >
            Conheça a QuieroFood:{' '}
            <br className="hidden sm:block" />
            <span className="text-amber-400">Gestão Sem Fronteiras</span>, Lucro Sem Limites.
          </motion.h2>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {/* Card 1 — KDS (largo: ocupa 2 colunas no lg) */}
          <div className="lg:col-span-2">
            <FeatureCard feature={features[0]} />
          </div>
          {/* Card 2 — Multi-Fronteira */}
          <div>
            <FeatureCard feature={features[1]} />
          </div>
          {/* Card 3 — Offline */}
          <div>
            <FeatureCard feature={features[2]} />
          </div>
          {/* Card 4 — Analytics (largo: ocupa 2 colunas no lg) */}
          <div className="lg:col-span-2">
            <FeatureCard feature={features[3]} />
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 4: PRICING ────────────────────────────────────────────────────────

const plans = [
  {
    name: 'Core',
    tagline: 'Para dar o primeiro passo',
    badge: null,
    highlight: false,
    features: [
      'Cardápio Público (QR Code)',
      'Kanban de Pedidos',
      'Display de Cozinha (KDS)',
      'KPIs Essenciais',
    ],
    cta: 'Começar Agora',
    ctaStyle: 'border border-slate-600 text-slate-200 hover:bg-slate-800',
  },
  {
    name: 'Standard',
    tagline: 'Para controle da operação',
    badge: 'Mais Escolhido',
    highlight: true,
    features: [
      'Tudo do Core',
      'QR Code por Mesa',
      'Zonas de Entrega com Taxa',
      'Impressão Térmica Automática',
      'Preços em BRL & PYG',
      'Análise de Canais e Pagamentos',
    ],
    cta: 'Quero Este Plano',
    ctaStyle: 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-[0_0_30px_rgba(251,191,36,0.3)]',
  },
  {
    name: 'Enterprise',
    tagline: 'Para redes e alto volume',
    badge: null,
    highlight: false,
    features: [
      'Tudo do Standard',
      'BI Avançado — Matriz BCG',
      'Churn Recovery via WhatsApp',
      'Módulo Buffet Offline-First',
      'Inventário com CMV',
      'RBAC Completo por Cargo',
    ],
    cta: 'Falar com Especialista',
    ctaStyle: 'border border-violet-500/50 text-violet-300 hover:bg-violet-500/10',
  },
];

function Pricing() {
  return (
    <section className="relative py-20 sm:py-28 px-5 bg-slate-900/60">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <AnimatedSection className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
            Planos
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl font-extrabold text-white"
          >
            Escolha o seu nível de poder.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400">
            Sem taxas escondidas.{' '}
            <span className="text-emerald-400 font-semibold">Sem comissão sobre as suas vendas.</span>
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              className={`relative flex flex-col rounded-2xl p-6 border backdrop-blur-md transition-all duration-300 ${
                plan.highlight
                  ? 'border-amber-400/50 bg-amber-400/5 shadow-[0_0_60px_rgba(251,191,36,0.12)] md:-translate-y-3 md:scale-[1.02]'
                  : 'border-slate-700/60 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              {/* Badge "Mais Escolhido" */}
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg">
                    <Star className="h-3 w-3 fill-slate-950" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="space-y-1 mb-6">
                <h3 className={`text-xl font-extrabold ${plan.highlight ? 'text-amber-400' : 'text-white'}`}>
                  {plan.name}
                </h3>
                <p className="text-sm text-slate-400">{plan.tagline}</p>
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className={`h-4 w-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-amber-400' : 'text-emerald-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${plan.ctaStyle}`}
              >
                {plan.cta}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 5: FINAL CTA + FOOTER ─────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="relative py-24 sm:py-32 px-5 overflow-hidden">
      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[500px] bg-amber-500/6 blur-[100px]" />
      </div>

      <AnimatedSection className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
        <motion.h2
          variants={fadeUp}
          className="text-3xl sm:text-5xl font-extrabold text-white leading-tight"
        >
          Sua transformação{' '}
          <span className="text-amber-400">começa agora.</span>
        </motion.h2>

        <motion.p variants={fadeUp} className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Você pode continuar pagando 20% para aplicativos, ou pode transformar seu restaurante
          em uma{' '}
          <span className="text-white font-semibold">máquina lucrativa e silenciosa</span> hoje.
        </motion.p>

        <motion.div variants={fadeUp}>
          <Link
            to="/register"
            className="group inline-flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base px-8 py-5 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.4)] hover:shadow-[0_0_80px_rgba(251,191,36,0.6)] transition-all duration-300 hover:-translate-y-1"
          >
            Quero Assumir o Controle do Meu Restaurante
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Garantia */}
        <motion.div
          variants={fadeUp}
          className="inline-flex items-start gap-3 bg-white/5 border border-white/10 backdrop-blur rounded-2xl px-5 py-4 max-w-lg mx-auto text-left"
        >
          <Shield className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Nossa equipe fará um diagnóstico rápido. Se a QuieroFood não for perfeita para a
            sua realidade na fronteira,{' '}
            <span className="text-white font-semibold">nós mesmos diremos isso a você.</span>{' '}
            Risco zero.
          </p>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 py-10 px-5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-amber-400">quiero</span>
          <span className="text-xl font-black text-white">.food</span>
        </div>
        <p className="text-xs text-slate-600 text-center">
          © {new Date().getFullYear()} QuieroFood. Todos os direitos reservados.
          <br className="sm:hidden" />
          {' '}Feito com ❤️ para a Tríplice Fronteira.
        </p>
        <Link
          to="/login"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Já tenho conta → Entrar
        </Link>
      </div>
    </footer>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-5 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xl font-black text-amber-400">quiero</span>
          <span className="text-xl font-black text-white">.food</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2"
          >
            Entrar
          </Link>
          <Link
            to="/register"
            className="text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-colors"
          >
            Começar Grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── PAGE SHELL ───────────────────────────────────────────────────────────────

export default function QuieroFoodLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased overflow-x-hidden">
      <Navbar />
      <Hero />
      <ProblemAgitation />
      <FeaturesGrid />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
