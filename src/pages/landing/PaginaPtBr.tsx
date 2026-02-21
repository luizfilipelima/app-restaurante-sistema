/**
 * PaginaPtBr — Página de Vendas Principal
 * Layout inspirado em https://fabulous-globe-491583.framer.app/ (Alytics)
 * Adaptado com conteúdo Quiero.Food — gestão para restaurantes da fronteira
 */

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Bike,
  LayoutGrid,
  Scale,
  BarChart3,
  Zap,
  Eye,
  Lightbulb,
  Lock,
  FileText,
  Sparkles,
  Plug,
  Star,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PageTransition } from '@/components/ui/PageTransition';

const DEFAULT_WA_LINK =
  'https://wa.me/5575992776610?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20um%20consultor%20sobre%20o%20Quiero.Food';

// ─── Animações (estilo Alytics/Framer) ──────────────────────────────────────

function AnimateOnScroll({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────

function Navbar() {
  const links = [
    { href: '#features', label: 'Funcionalidades' },
    { href: '#benefits', label: 'Benefícios' },
    { href: '#como-funciona', label: 'Como Funciona' },
    { href: '#planos', label: 'Planos' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 lg:h-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <a href="/" className="flex items-center">
          <img src="/logo_quiero_food.svg" alt="Quiero.Food" className="h-7 lg:h-8 w-auto" />
        </a>
        <nav className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Button
            asChild
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full px-6"
          >
            <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
              Falar com Consultor
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ─── 1. HERO ─────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative pt-28 lg:pt-36 pb-16 lg:pb-24 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-sm font-semibold text-orange-500 mb-6"
        >
          Usado por restaurantes da Tríplice Fronteira
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight max-w-4xl"
        >
          Transforme dados caóticos em decisões inteligentes
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl"
        >
          Unifique salão, delivery e buffet em uma única plataforma. Câmbio automático
          BRL/PYG, controle de estoque com CMV e operação à prova de quedas de internet.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row gap-4"
        >
          <Button
            asChild
            size="lg"
            className="h-12 px-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg shadow-orange-200/50"
          >
            <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
              Falar com um Consultor
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 px-8 rounded-full border-slate-300 text-slate-700 hover:border-orange-300 hover:text-orange-600"
          >
            <a href="#planos">Ver Planos e Preços</a>
          </Button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-sm text-slate-500"
        >
          Sem cartão de crédito para testar
        </motion.p>

        {/* Mockup placeholder — estilo Alytics */}
        <AnimateOnScroll className="mt-16 lg:mt-24" delay={0.2}>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center min-h-[280px]">
              <span className="text-slate-400 text-sm font-medium">Dashboard Quiero.Food</span>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}

// ─── 2. UNIQUE FEATURES ─────────────────────────────────────────────────────

const features = [
  {
    icon: Bike,
    title: 'Delivery Dinâmico',
    text: 'Câmbio automático no checkout, zonas de entrega por raio e KDS na cozinha para eliminar o caos do WhatsApp.',
  },
  {
    icon: LayoutGrid,
    title: 'Salão e Autoatendimento',
    text: 'QR Codes por mesa, chamada digital de garçons e construtor avançado para pizzas com impressão roteada.',
  },
  {
    icon: Scale,
    title: 'Operação Offline-First',
    text: 'Módulo de pesagem e comandas virtuais que funcionam 100% mesmo quando a internet do seu restaurante cai.',
  },
  {
    icon: BarChart3,
    title: 'Matriz BCG e Churn',
    text: 'IA categoriza seus produtos pela Matriz BCG e alerta quando clientes fiéis estão em risco de abandono.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">
            Funcionalidades Únicas
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Faça sua operação trabalhar por você
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16 max-w-2xl mx-auto" delay={0.15}>
          <p className="text-lg text-slate-600">
            Unifique métricas, pedidos e gestão em um só lugar — salão, delivery e buffet.
          </p>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <AnimateOnScroll key={f.title} delay={i * 0.05}>
                <Card className="border-slate-200/80 bg-white shadow-sm hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{f.text}</p>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── 3. BENEFITS ────────────────────────────────────────────────────────────

const benefits = [
  { icon: Zap, title: 'Tempo Real', text: 'Pedidos e status atualizam instantaneamente para decisões mais rápidas.' },
  { icon: Eye, title: 'Visão Unificada', text: 'Salão, delivery e buffet em um único painel, sem trocar de ferramentas.' },
  { icon: Lightbulb, title: 'Insights Acionáveis', text: 'Métricas que importam para crescimento sustentável do negócio.' },
  { icon: Lock, title: 'Dados Seguros', text: 'Segurança avançada e criptografia para proteger sua operação.' },
  { icon: FileText, title: 'Relatórios Custom', text: 'Relatórios sob medida que destacam o que importa para você.' },
  { icon: Sparkles, title: 'Simples de Usar', text: 'Interface intuitiva — comece a tomar melhores decisões rapidamente.' },
];

function BenefitsSection() {
  return (
    <section id="benefits" className="py-20 lg:py-28 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">Benefícios</p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Benefícios que importam para você
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16 max-w-2xl mx-auto" delay={0.15}>
          <p className="text-lg text-slate-600">
            Monitore métricas em tempo real, responda rápido e mantenha seus objetivos no caminho.
          </p>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <AnimateOnScroll key={b.title} delay={i * 0.05}>
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{b.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{b.text}</p>
                </div>
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── 4. HOW IT WORKS ───────────────────────────────────────────────────────

const steps = [
  {
    title: 'Conecte seu restaurante',
    text: 'Configure em minutos com seu cardápio existente — sem suporte técnico.',
  },
  {
    title: 'Receba pedidos em tempo real',
    text: 'Veja o que entra, o que sai e o que mantém seus clientes fiéis.',
  },
  {
    title: 'Transforme insights em ação',
    text: 'Recomendações claras para reduzir churn e aumentar o faturamento.',
  },
];

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-20 lg:py-28 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">
            Como Funciona
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Respostas claras em 3 passos simples
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16 max-w-2xl mx-auto" delay={0.15}>
          <p className="text-lg text-slate-600">
            Dos dados à clareza — descubra insights, tome ação e cresça de forma inteligente.
          </p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s, i) => (
            <AnimateOnScroll key={s.title} delay={i * 0.1}>
              <div className="text-center">
                <div className="inline-flex h-12 w-12 rounded-full bg-orange-100 text-orange-600 font-bold text-lg items-center justify-center mb-4">
                  {i + 1}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-600">{s.text}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 5. INTEGRATIONS ───────────────────────────────────────────────────────

function IntegrationsSection() {
  return (
    <section className="py-20 lg:py-28 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto text-center">
        <AnimateOnScroll className="mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">
            Integrações
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Integrações fluidas
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.15}>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-12">
            Conecte o Quiero.Food com WhatsApp, PIX e suas ferramentas favoritas.
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.2}>
          <div className="flex flex-wrap justify-center gap-8 items-center text-slate-400">
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <Plug className="h-6 w-6 text-green-500" />
              <span className="font-semibold text-slate-600">WhatsApp</span>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="font-semibold text-slate-600">PIX</span>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="font-semibold text-slate-600">Impressora Térmica</span>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}

// ─── 6. TESTIMONIALS ────────────────────────────────────────────────────────

const testimonials = [
  {
    quote: 'Desde que usamos o Quiero, nossos pedidos saem 30% mais rápido. O suporte local faz a diferença.',
    name: 'Carlos Benitez',
    role: 'Pizzaria Bella Italia',
  },
  {
    quote: 'A integração com a impressora térmica é perfeita. Não perdemos mais nenhum pedido no horário de pico.',
    name: 'Maria González',
    role: 'Burger House CDE',
  },
  {
    quote: 'O cardápio em Guarani e Reais facilitou muito para nossos clientes brasileiros e paraguaios.',
    name: 'Fernando Silva',
    role: 'Sushi House',
  },
];

function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-28 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">
            Depoimentos
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            O que outros dizem sobre nós
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16 max-w-2xl mx-auto" delay={0.15}>
          <p className="text-lg text-slate-600">
            Veja o que times de sucesso dizem após migrar para uma plataforma mais inteligente.
          </p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <AnimateOnScroll key={t.name} delay={i * 0.05}>
              <Card className="border-slate-200/80 bg-slate-50/50">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((_) => (
                      <Star key={_} className="h-4 w-4 fill-orange-400 text-orange-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed mb-4">"{t.quote}"</p>
                  <div>
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    <p className="text-sm text-slate-500">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 7. PRICING ─────────────────────────────────────────────────────────────

const plans = [
  {
    name: 'Core',
    price: 'R$ 149,90',
    tagline: 'Ideal para começar.',
    features: ['Cardápio digital', 'Kanban de pedidos', 'Dashboard financeira', 'KDS básico'],
    popular: false,
  },
  {
    name: 'Standard',
    price: 'R$ 349,90',
    tagline: 'Para restaurantes em crescimento.',
    features: ['Delivery avançado', 'QR na mesa', 'Multimoeda BRL/PYG', 'Impressão térmica'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'R$ 749,90',
    tagline: 'Para alto volume e redes.',
    features: ['Buffet offline', 'Controle de estoque/CMV', 'BI com Risco de Churn', 'Controle de acessos'],
    popular: false,
  },
];

function PricingSection() {
  return (
    <section id="planos" className="py-20 lg:py-28 px-4 sm:px-6 bg-slate-50 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">
            Nossos Planos
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Escolha o melhor plano para você
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16 max-w-2xl mx-auto" delay={0.15}>
          <p className="text-lg text-slate-600">
            Preços flexíveis para cada etapa — do início à escala, sem taxas escondidas.
          </p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan, i) => (
            <AnimateOnScroll key={plan.name} delay={i * 0.05}>
              <Card
                className={`h-full flex flex-col relative overflow-hidden ${
                  plan.popular ? 'ring-2 ring-orange-400 shadow-xl' : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 text-xs font-bold">
                    Mais Popular
                  </div>
                )}
                <CardContent className={`p-6 flex flex-col flex-1 ${plan.popular ? 'pt-14' : ''}`}>
                  <h3 className={`text-xl font-bold ${plan.popular ? 'text-orange-600' : 'text-slate-900'}`}>
                    {plan.name}
                  </h3>
                  <p className="text-slate-600 text-sm mt-1">{plan.tagline}</p>
                  <div className="mt-6 mb-6">
                    <span className={`text-3xl font-bold ${plan.popular ? 'text-orange-600' : 'text-slate-900'}`}>
                      {plan.price}
                    </span>
                    <span className="text-slate-500 text-sm">/mês</span>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`w-full mt-6 rounded-full h-11 ${
                      plan.popular
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
                      Falar com Consultor
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 8. WHY QUIERO.FOOD (Comparison) ────────────────────────────────────────

const comparison = [
  { other: 'Dados em muitos lugares', us: 'Todas as métricas em uma plataforma' },
  { other: 'Relatórios consomem horas', us: 'Relatórios gerados instantaneamente' },
  { other: 'Insights genéricos', us: 'Insights alinhados aos seus objetivos' },
  { other: 'Sem orientação para decisões', us: 'IA sugere seu próximo passo' },
  { other: 'Difícil ver o que funciona', us: 'Caminho claro para crescimento consistente' },
];

function ComparisonSection() {
  return (
    <section className="py-20 lg:py-28 px-4 sm:px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">
            Por que Quiero.Food
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Uma forma mais inteligente de crescer com dados
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16" delay={0.15}>
          <p className="text-lg text-slate-600">
            Transforme métricas complexas em insights claros para decisões melhores e mais rápidas.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
            <div className="grid grid-cols-2 divide-x divide-slate-200 bg-slate-50">
              <div className="p-4 font-semibold text-slate-500 text-center">Outras ferramentas</div>
              <div className="p-4 font-semibold text-orange-600 text-center">Quiero.Food</div>
            </div>
            {comparison.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200"
              >
                <div className="p-4 flex items-center gap-2 text-slate-600">
                  <X className="h-4 w-4 text-red-400 flex-shrink-0" />
                  {row.other}
                </div>
                <div className="p-4 flex items-center gap-2 text-slate-700 bg-orange-50/30">
                  <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  {row.us}
                </div>
              </div>
            ))}
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}

// ─── 9. FAQ ─────────────────────────────────────────────────────────────────

const faqItems = [
  {
    q: 'Preciso de cartão de crédito para testar?',
    a: 'Não. Você pode criar sua conta e testar sem cartão. Entre em contato para começar.',
  },
  {
    q: 'Funciona em celular e tablet?',
    a: 'Sim! O sistema é 100% responsivo e funciona em qualquer dispositivo com navegador.',
  },
  {
    q: 'Como funciona a impressão automática?',
    a: 'Ative no painel e escolha 58mm ou 80mm. Ao receber um pedido, o cupom sai automaticamente na impressora térmica.',
  },
  {
    q: 'O Quiero.Food integra com WhatsApp?',
    a: 'Sim. Pedidos chegam via WhatsApp e o cliente recebe atualizações de status pelo mesmo canal.',
  },
];

function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28 px-4 sm:px-6 bg-slate-50 scroll-mt-20">
      <div className="max-w-3xl mx-auto">
        <AnimateOnScroll className="text-center mb-4">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-wider">FAQ</p>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-4" delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Perguntas com respostas claras
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll className="text-center mb-16" delay={0.15}>
          <p className="text-lg text-slate-600">
            Respostas para o que mais perguntam antes de começar.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <Accordion type="single" collapsible className="space-y-4">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-slate-200 rounded-xl px-4 bg-white"
              >
                <AccordionTrigger className="text-left font-semibold text-slate-900 py-4 hover:no-underline hover:text-orange-600">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimateOnScroll>
      </div>
    </section>
  );
}

// ─── 10. NEWSLETTER / CTA ───────────────────────────────────────────────────

function NewsletterSection() {
  return (
    <section className="py-20 lg:py-28 px-4 sm:px-6 bg-white">
      <AnimateOnScroll>
        <div className="max-w-2xl mx-auto text-center p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-orange-50 to-slate-50 border border-orange-100">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Pronto para transformar sua operação?
          </h2>
          <p className="text-slate-600 mb-6">
            Fale com um consultor e descubra como o Quiero.Food pode ajudar seu restaurante a crescer.
          </p>
          <Button
            asChild
            size="lg"
            className="rounded-full h-12 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
              Falar com Consultor
            </a>
          </Button>
        </div>
      </AnimateOnScroll>
    </section>
  );
}

// ─── 11. FOOTER ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-12 lg:py-16 px-4 sm:px-6 border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div>
            <img src="/logo_quiero_food.svg" alt="Quiero.Food" className="h-7 w-auto mb-4 opacity-80" />
            <p className="text-slate-600 text-sm max-w-xs">
              Transforme dados caóticos em decisões inteligentes. Gestão completa para restaurantes da Tríplice Fronteira.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 lg:gap-16">
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Seções</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-orange-600 transition-colors">Funcionalidades</a></li>
                <li><a href="#benefits" className="hover:text-orange-600 transition-colors">Benefícios</a></li>
                <li><a href="#como-funciona" className="hover:text-orange-600 transition-colors">Como Funciona</a></li>
                <li><a href="#planos" className="hover:text-orange-600 transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-orange-600 transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Contato</h4>
              <a
                href={DEFAULT_WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-600 hover:text-orange-600 transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Quiero.Food. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function PaginaPtBr() {
  return (
    <PageTransition>
      <div className="min-h-screen bg-white text-slate-900 dark:bg-white dark:text-slate-900">
        <Navbar />
        <main>
          <HeroSection />
          <FeaturesSection />
          <BenefitsSection />
          <HowItWorksSection />
          <IntegrationsSection />
          <TestimonialsSection />
          <PricingSection />
          <ComparisonSection />
          <FAQSection />
          <NewsletterSection />
        </main>
        <Footer />
      </div>
    </PageTransition>
  );
}
