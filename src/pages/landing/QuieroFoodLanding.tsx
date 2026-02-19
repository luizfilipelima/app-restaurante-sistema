/**
 * QuieroFood — Landing Page Premium (v2)
 * Dark Mode · Glass Morphism · Framer Motion 3D Mockups
 * CTA → WhatsApp | Entrar → app.quiero.food
 */

import { useRef } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useSpring,
  animate,
  type Variants,
  type Transition,
} from 'framer-motion';
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
  MessageCircle,
  Clock,
  Bell,
  Smartphone,
  BarChart3,
  Printer,
  QrCode,
  ExternalLink,
} from 'lucide-react';

// ─── Constantes de link ───────────────────────────────────────────────────────

const WA_LINK =
  'https://wa.me/5575992776610?text=Ol%C3%A1%20Filipe%2C%20gostaria%20de%20implementar%20o%20QuieroFood%20no%20meu%20neg%C3%B3cio%20com%20o%20plano%20gratuito%20de%207%20dias';
const APP_LINK = 'https://app.quiero.food';

// ─── Variantes de animação ────────────────────────────────────────────────────

const defaultTransition: Transition = { duration: 0.55, ease: 'easeOut' };

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7 } },
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
  const sizes = {
    sm: 'text-sm px-5 py-3',
    md: 'text-base px-7 py-4',
    lg: 'text-base sm:text-lg px-8 py-5 font-black',
  };
  return (
    <a
      href={WA_LINK}
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

// ─── MOCKUP: Phone Frame com tilt 3D ─────────────────────────────────────────

function PhoneMockup({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 140, damping: 20, mass: 0.7 };
  const rotateX = useSpring(useTransform(mouseY, [-1, 1], [12, -12]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-1, 1], [-12, 12]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
    mouseY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
  };
  const handleMouseLeave = () => {
    animate(mouseX, 0, { duration: 0.6 });
    animate(mouseY, 0, { duration: 0.6 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1000 }}
      className="cursor-pointer"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative"
      >
        {/* Glow de fundo do telefone */}
        <div className="absolute inset-4 rounded-[3rem] bg-[#F87116]/20 blur-3xl pointer-events-none" />

        {/* Frame do telefone */}
        <div className="relative w-[260px] sm:w-[290px] rounded-[2.8rem] border-[3px] border-white/15 bg-slate-900 shadow-[0_40px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden">
          {/* Notch */}
          <div className="flex justify-center pt-3 pb-1 px-4">
            <div className="h-6 w-24 rounded-full bg-black/70 border border-white/10" />
          </div>
          {/* Conteúdo da tela */}
          <div className="px-0 pb-5 overflow-hidden">{children}</div>
          {/* Barra home */}
          <div className="flex justify-center pb-4">
            <div className="h-1 w-24 rounded-full bg-white/20" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Conteúdo do Mockup: KDS Kanban ──────────────────────────────────────────

const kanbanOrders = [
  {
    id: '#127',
    status: 'Pendente',
    color: 'bg-amber-500',
    dot: 'bg-amber-400',
    time: '0:42',
    items: ['Pizza Calabresa G', 'Coca-Cola 2L'],
    total: 'R$ 68,00',
  },
  {
    id: '#126',
    status: 'Preparando',
    color: 'bg-blue-500',
    dot: 'bg-blue-400',
    time: '3:15',
    items: ['4× Coxinha', 'Suco de Laranja'],
    total: 'R$ 37,50',
  },
  {
    id: '#125',
    status: 'Pronto',
    color: 'bg-emerald-500',
    dot: 'bg-emerald-400',
    time: '7:22',
    items: ['Hambúrguer Smash', 'Batata Frita P'],
    total: 'R$ 54,90',
  },
];

function KDSMockupContent() {
  return (
    <div className="bg-slate-950">
      {/* Header do KDS */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-[10px] font-black text-white/80 uppercase tracking-wider">
          Pedidos Ativos
        </span>
        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Ao vivo
        </span>
      </div>

      {/* Cards de pedido */}
      <div className="space-y-2 px-3 pt-3 pb-1">
        {kanbanOrders.map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
            className="rounded-xl bg-white/[0.06] border border-white/10 overflow-hidden"
          >
            {/* Linha de cor superior */}
            <div className={`h-0.5 w-full ${order.color}`} />
            <div className="px-3 py-2.5">
              {/* Cabeçalho do card */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${order.dot}`} />
                  <span className="text-[10px] font-black text-white">{order.id}</span>
                  <span className="text-[9px] text-white/40 font-medium">{order.status}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-white/50">
                  <Clock className="h-2.5 w-2.5" />
                  {order.time}
                </div>
              </div>
              {/* Itens */}
              {order.items.map((item) => (
                <p key={item} className="text-[9px] text-white/50 leading-relaxed">
                  • {item}
                </p>
              ))}
              {/* Total */}
              <div className="flex justify-end mt-2">
                <span className="text-[9px] font-black text-[#F87116]">{order.total}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── SEÇÃO 1: HERO ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-24 pb-16 overflow-hidden">
      {/* Fundo com glow radial */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#F87116]/8 blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/6 blur-[100px]" />
        {/* Grid de pontos decorativo */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        {/* Coluna esquerda — copy */}
        <AnimatedSection className="space-y-8">
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#F87116]/30 bg-[#F87116]/10 text-orange-300 text-[11px] font-bold uppercase tracking-[0.15em] shadow-[0_0_24px_rgba(248,113,22,0.15)]">
              <Zap className="h-3 w-3 flex-shrink-0" />
              Exclusivo para Restaurantes da Tríplice Fronteira
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl xl:text-6xl font-extrabold text-white leading-[1.08] tracking-tight"
          >
            Pare de Dividir Seu{' '}
            <span className="relative inline-block">
              <span className="text-[#F87116]">Lucro</span>
              <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-[#F87116] to-transparent" />
            </span>{' '}
            com Apps e Acabe com o{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
              Caos
            </span>{' '}
            na Cozinha.
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={fadeUp}
            className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-lg"
          >
            Do QR Code na mesa à tela da cozinha — gerencie pedidos em{' '}
            <span className="text-white font-semibold">Reais e Guaraníes</span> sem pagar{' '}
            <span className="text-[#F87116] font-semibold">1% de comissão</span>.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 items-start">
            <CtaButton label="Testar 7 Dias Grátis" size="lg" />
            <a
              href={APP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm text-slate-300 text-base font-semibold hover:bg-white/[0.08] hover:text-white transition-all duration-200"
            >
              <ExternalLink className="h-4 w-4" />
              Entrar na Plataforma
            </a>
          </motion.div>

          {/* Micro-proof */}
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-5 pt-2"
          >
            {[
              { n: '500+', label: 'Restaurantes' },
              { n: 'R$0', label: 'Comissão' },
              { n: '3 Países', label: 'BR · PY · AR' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-black text-[#F87116]">{s.n}</p>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </AnimatedSection>

        {/* Coluna direita — mockup interativo */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="flex justify-center lg:justify-end relative"
        >
          {/* Notificação flutuante (nova ordem) */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-4 -left-4 sm:left-4 z-20 flex items-center gap-2.5 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-lg"
          >
            <div className="h-8 w-8 rounded-xl bg-[#F87116] flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(248,113,22,0.6)]">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-black text-white">Novo pedido! 🎉</p>
              <p className="text-[10px] text-slate-400">#128 · R$ 94,00</p>
            </div>
          </motion.div>

          {/* Badge de impressão */}
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute -bottom-2 -right-2 sm:right-4 z-20 flex items-center gap-2 bg-emerald-500/15 backdrop-blur-xl border border-emerald-500/30 rounded-2xl px-3 py-2 shadow-lg"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] font-bold text-emerald-300">Impresso na cozinha ✓</p>
          </motion.div>

          <PhoneMockup>
            <KDSMockupContent />
          </PhoneMockup>
        </motion.div>
      </div>
    </section>
  );
}

// ─── SEÇÃO 2: STRIP DE PROVA SOCIAL ──────────────────────────────────────────

function SocialStrip() {
  const items = [
    'Cardápio Digital',
    'Pedidos em Tempo Real',
    'KDS — Cozinha',
    'Impressão Térmica',
    'Multi-moeda BRL/PYG',
    'Motoboys & Zonas',
    'QR Code na Mesa',
    'Offline-First',
    'BI & Analytics',
    'Comandas Digitais',
  ];

  return (
    <div className="relative py-5 border-y border-white/[0.06] overflow-hidden bg-white/[0.02]">
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="flex gap-10 whitespace-nowrap"
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <span className="h-1 w-1 rounded-full bg-[#F87116]" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── SEÇÃO 3: PROBLEMA ────────────────────────────────────────────────────────

function ProblemSection() {
  const pains = [
    { emoji: '📱', text: 'O WhatsApp não para de apitar e pedidos chegam errados.' },
    { emoji: '💸', text: 'O iFood e o PedidosYa devoram até 20% da sua margem.' },
    { emoji: '🌐', text: 'O sistema que você usa não entende Guaraníes nem a Fronteira.' },
    { emoji: '🔌', text: 'Qualquer queda de internet paralisa toda a operação.' },
  ];

  return (
    <section className="relative py-20 sm:py-28 px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <AnimatedSection className="max-w-3xl mx-auto text-center space-y-10">
        <motion.h2
          variants={fadeUp}
          className="text-3xl sm:text-4xl font-extrabold text-white"
        >
          Você é{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-500">
            refém do seu restaurante
          </span>
          ?
        </motion.h2>
        <motion.p variants={fadeUp} className="text-slate-400 text-lg">
          Nós conhecemos a realidade de{' '}
          <span className="text-white font-semibold">Ciudad del Este, Foz e Puerto Iguazú</span>.
        </motion.p>

        <motion.ul variants={stagger} className="grid sm:grid-cols-2 gap-3 text-left">
          {pains.map((pain) => (
            <motion.li
              key={pain.text}
              variants={fadeUp}
              className="flex items-start gap-3 bg-white/[0.04] border border-white/10 backdrop-blur-sm rounded-2xl px-4 py-4 hover:bg-white/[0.07] transition-colors"
            >
              <span className="text-xl flex-shrink-0">{pain.emoji}</span>
              <span className="text-sm text-slate-300 leading-relaxed">{pain.text}</span>
            </motion.li>
          ))}
        </motion.ul>

        <motion.p
          variants={fadeUp}
          className="text-lg sm:text-xl font-bold text-white border-t border-white/10 pt-8"
        >
          O sistema genérico que você usa hoje{' '}
          <span className="text-red-400">trava sua operação</span> em vez de libertá-la.
        </motion.p>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 4: FEATURES BENTO ─────────────────────────────────────────────────

interface FeatureCardData {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
  mockupContent?: React.ReactNode;
  wide?: boolean;
}

function MiniPhoneMockup({ children, accentColor }: { children: React.ReactNode; accentColor: string }) {
  return (
    <div className={`relative w-28 h-48 rounded-[1.4rem] border-2 ${accentColor} bg-slate-950 overflow-hidden shadow-lg flex-shrink-0`}>
      <div className="flex justify-center pt-2">
        <div className="h-3 w-10 rounded-full bg-slate-800" />
      </div>
      <div className="px-1.5 pt-1 pb-2 space-y-1 overflow-hidden h-full">
        {children}
      </div>
    </div>
  );
}

function FeatureBento() {
  const features: FeatureCardData[] = [
    {
      icon: MonitorPlay,
      title: 'A Cozinha Silenciosa (KDS)',
      description:
        'Pedidos direto do celular do cliente para telas na cozinha. Timers coloridos. Impressão automática.',
      accent: 'emerald',
      wide: true,
      mockupContent: (
        <MiniPhoneMockup accentColor="border-emerald-500/40">
          <div className="text-[7px] text-emerald-400 font-bold uppercase tracking-wide px-1 py-1">Cozinha</div>
          {[
            { c: 'bg-amber-500', t: '#127 · Pizza G' },
            { c: 'bg-blue-500', t: '#126 · Coxinhas' },
            { c: 'bg-emerald-500', t: '#125 · Pronto' },
          ].map((o) => (
            <div key={o.t} className={`rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 flex items-center gap-1`}>
              <span className={`h-1.5 w-1.5 rounded-full ${o.c} flex-shrink-0`} />
              <span className="text-[7px] text-white/70 truncate">{o.t}</span>
            </div>
          ))}
        </MiniPhoneMockup>
      ),
    },
    {
      icon: Globe,
      title: 'Cardápio Multi-Fronteira',
      description: 'QR Code na mesa. PT/ES. Preços em BRL & PYG. Zero comissão.',
      accent: 'blue',
      mockupContent: (
        <MiniPhoneMockup accentColor="border-blue-500/40">
          <div className="text-[7px] text-blue-400 font-bold uppercase tracking-wide px-1 py-1">Cardápio</div>
          {['🍕 Pizza · R$48', '🍔 Burger · ₲89K', '🥤 Coca · R$8'].map((i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
              <span className="text-[7px] text-white/60">{i}</span>
            </div>
          ))}
        </MiniPhoneMockup>
      ),
    },
    {
      icon: WifiOff,
      title: 'Operação Offline-First',
      description: 'Buffet e Comandas funcionam sem internet. Sincroniza ao reconectar.',
      accent: 'amber',
      mockupContent: (
        <MiniPhoneMockup accentColor="border-amber-500/40">
          <div className="text-[7px] text-amber-400 font-bold uppercase tracking-wide px-1 py-1">Buffet</div>
          <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-center">
            <WifiOff className="h-4 w-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[7px] text-amber-300 font-bold">Offline ✓</span>
          </div>
          <div className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1.5">
            <span className="text-[7px] text-emerald-300">3 itens salvos</span>
          </div>
        </MiniPhoneMockup>
      ),
    },
    {
      icon: TrendingUp,
      title: 'BI & Analytics',
      description: 'Dashboard com Matriz BCG, churn integrado ao WhatsApp e MRR em tempo real.',
      accent: 'violet',
      wide: true,
      mockupContent: (
        <MiniPhoneMockup accentColor="border-violet-500/40">
          <div className="text-[7px] text-violet-400 font-bold uppercase tracking-wide px-1 py-1">Analytics</div>
          {[
            { label: 'Faturamento', val: 'R$ 12.4k', color: 'text-violet-300' },
            { label: 'Pedidos', val: '287', color: 'text-blue-300' },
            { label: 'Ticket Médio', val: 'R$ 43', color: 'text-emerald-300' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 flex justify-between items-center">
              <span className="text-[6px] text-white/40">{m.label}</span>
              <span className={`text-[8px] font-black ${m.color}`}>{m.val}</span>
            </div>
          ))}
        </MiniPhoneMockup>
      ),
    },
  ];

  const accentClasses: Record<string, { border: string; iconBg: string; iconText: string; glow: string }> = {
    emerald: { border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400', glow: 'hover:shadow-[0_0_40px_rgba(16,185,129,0.1)]' },
    blue: { border: 'border-blue-500/20', iconBg: 'bg-blue-500/15', iconText: 'text-blue-400', glow: 'hover:shadow-[0_0_40px_rgba(59,130,246,0.1)]' },
    amber: { border: 'border-amber-500/20', iconBg: 'bg-amber-500/15', iconText: 'text-amber-400', glow: 'hover:shadow-[0_0_40px_rgba(245,158,11,0.1)]' },
    violet: { border: 'border-violet-500/20', iconBg: 'bg-violet-500/15', iconText: 'text-violet-400', glow: 'hover:shadow-[0_0_40px_rgba(139,92,246,0.1)]' },
  };

  return (
    <section className="py-20 sm:py-28 px-5">
      <AnimatedSection className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#F87116]">
            A Solução
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-white">
            Gestão Sem Fronteiras,{' '}
            <span className="text-[#F87116]">Lucro Sem Limites</span>.
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const colors = accentClasses[f.accent];
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`relative group flex flex-col gap-4 rounded-2xl border ${colors.border} bg-white/[0.04] backdrop-blur-md p-5 ${colors.glow} transition-all duration-300 hover:bg-white/[0.07] ${f.wide ? 'lg:col-span-2' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className={`h-10 w-10 rounded-xl ${colors.iconBg} flex items-center justify-center mb-3`}>
                      <Icon className={`h-5 w-5 ${colors.iconText}`} />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                  </div>
                  {f.mockupContent && (
                    <motion.div
                      initial={{ opacity: 0.6, scale: 0.95 }}
                      whileHover={{ opacity: 1, scale: 1.02 }}
                      className="hidden sm:block flex-shrink-0"
                    >
                      {f.mockupContent}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatedSection>
    </section>
  );
}

// ─── SEÇÃO 5: MOCKUP INTERATIVO TABLET (Dashboard) ───────────────────────────

function DashboardMockup() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-16 sm:py-24 px-5 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-10 space-y-3">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#F87116]">
            Painel Administrativo
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-white">
            Visão completa do seu negócio,{' '}
            <span className="text-[#F87116]">em tempo real</span>.
          </motion.h2>
        </AnimatedSection>

        {/* Mockup tablet */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative max-w-3xl mx-auto"
        >
          {/* Glow */}
          <div className="absolute inset-x-10 bottom-0 h-24 bg-[#F87116]/15 blur-3xl pointer-events-none" />

          {/* Frame tablet */}
          <div className="relative rounded-2xl border-2 border-white/10 bg-slate-900 shadow-[0_40px_100px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
            {/* Barra de URL do browser */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-white/5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-3 h-5 rounded bg-white/5 flex items-center px-2 gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F87116]/60 flex-shrink-0" />
                <span className="text-[10px] text-slate-500">app.quiero.food/admin</span>
              </div>
            </div>

            {/* Conteúdo do Dashboard */}
            <div className="flex bg-slate-900">
              {/* Sidebar mini */}
              <div className="w-12 bg-slate-950 border-r border-white/5 flex flex-col items-center gap-3 py-4">
                {[BarChart3, ClipboardIcon, QrCode, Smartphone].map((Icon, i) => (
                  <div
                    key={i}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-[#F87116]/20 text-[#F87116]' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                ))}
              </div>

              {/* Main */}
              <div className="flex-1 p-4 space-y-3">
                {/* KPI row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Faturamento', val: 'R$ 3.847', delta: '+12%', color: 'text-emerald-400' },
                    { label: 'Pedidos Hoje', val: '47', delta: '+5%', color: 'text-blue-400' },
                    { label: 'Ticket Médio', val: 'R$ 81,85', delta: '+2%', color: 'text-amber-400' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl bg-white/[0.04] border border-white/8 p-2.5">
                      <p className="text-[9px] text-slate-500 mb-1">{kpi.label}</p>
                      <p className="text-sm font-black text-white">{kpi.val}</p>
                      <p className={`text-[9px] font-bold ${kpi.color}`}>{kpi.delta}</p>
                    </div>
                  ))}
                </div>

                {/* Pedidos mini kanban */}
                <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Pedidos Ativos
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Pendente (3)', 'Preparando (2)', 'Pronto (1)'].map((col, i) => (
                      <div key={col} className="space-y-1">
                        <p className="text-[8px] font-bold text-slate-500">{col}</p>
                        {Array.from({ length: i === 0 ? 2 : 1 }).map((_, j) => (
                          <div
                            key={j}
                            className="h-7 rounded-lg bg-white/5 border border-white/10 flex items-center px-2 gap-1.5"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-blue-400' : 'bg-emerald-400'}`}
                            />
                            <span className="text-[8px] text-white/50 truncate">
                              #{128 - i - j}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ícone placeholder
const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

// ─── SEÇÃO 6: PRICING ────────────────────────────────────────────────────────

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
  return (
    <section className="relative py-20 sm:py-28 px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <AnimatedSection className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#F87116]">
            Planos
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-white">
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
                href={WA_LINK}
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

const testimonials = [
  {
    quote: 'Desde que usamos o Quiero, nossos pedidos saem 30% mais rápido. O suporte local faz a diferença.',
    name: 'Carlos Benitez',
    role: 'Pizzaria Bella Italia',
    initials: 'CB',
  },
  {
    quote: 'A integração com a impressora térmica é perfeita. Não perdemos mais nenhum pedido no horário de pico.',
    name: 'Maria González',
    role: 'Burger House CDE',
    initials: 'MG',
  },
  {
    quote: 'O cardápio em Guarani e Reais facilitou muito para nossos clientes brasileiros e paraguaios.',
    name: 'Fernando Silva',
    role: 'Sushi House',
    initials: 'FS',
  },
];

function Testimonials() {
  return (
    <section className="py-20 sm:py-24 px-5">
      <AnimatedSection className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#F87116]">
            Depoimentos
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-white">
            Quem usa, recomenda.
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
          Sua transformação{' '}
          <span className="text-[#F87116]">começa agora.</span>
        </motion.h2>

        <motion.p variants={fadeUp} className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Você pode continuar pagando 20% para aplicativos, ou pode transformar seu restaurante
          em uma{' '}
          <span className="text-white font-semibold">máquina lucrativa e silenciosa</span> hoje.
        </motion.p>

        <motion.div variants={fadeUp} className="flex justify-center">
          <CtaButton label="Quero Assumir o Controle do Meu Restaurante" size="lg" />
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="inline-flex items-start gap-3 bg-white/[0.04] border border-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 max-w-md mx-auto text-left"
        >
          <Shield className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Nossa equipe fará um diagnóstico rápido. Se a QuieroFood não for perfeita para
            você,{' '}
            <span className="text-white font-semibold">nós mesmos diremos isso.</span> Risco zero.
          </p>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

function Navbar() {
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
          {['Funcionalidades', 'Planos', 'Contato'].map((item) => (
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
            href={APP_LINK}
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
  return (
    <footer className="border-t border-white/[0.07] py-10 px-5 bg-slate-950">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img src="/logo_quiero_food.svg" alt="QuieroFood" className="h-6 w-auto opacity-70" />
        <p className="text-xs text-slate-600 text-center">
          © {new Date().getFullYear()} QuieroFood. Todos os direitos reservados. Feito para a Tríplice Fronteira.
        </p>
        <a
          href={APP_LINK}
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
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased overflow-x-hidden">
      <Navbar />
      <Hero />
      <SocialStrip />
      <ProblemSection />
      <FeatureBento />
      <DashboardMockup />
      <Pricing />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}
