/**
 * PaginaPtBr — Página de Vendas Principal
 * Design: Hyper Professional Enterprise
 * Tema: Light (bg-white/slate-50), acentos em laranja, tipografia elegante
 * Rota: /pagina-ptbr
 */

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Bike, LayoutGrid, Scale, BarChart3, Shield, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition } from '@/components/ui/PageTransition';

const DEFAULT_WA_LINK =
  'https://wa.me/5575992776610?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20um%20consultor%20sobre%20o%20Quiero.Food';

// ─── Animações ───────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

function AnimateOnScroll({
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
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── 1. HERO SECTION ─────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 pt-28 pb-20 bg-white">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <Badge
          variant="outline"
          className="border-orange-300 bg-orange-50 text-orange-700 text-[11px] font-bold uppercase tracking-[0.2em] px-4 py-1.5"
        >
          ADEUS AO CAOS NA COZINHA
        </Badge>

        <motion.h1
          {...fadeUp}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight"
        >
          O Sistema de Gestão Definitivo para Restaurantes da Fronteira.
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
          className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto"
        >
          Unifique sua operação de salão, delivery e buffet em uma única plataforma
          inteligente. Câmbio automático BRL/PYG, controle de estoque com CMV e operação
          à prova de quedas de internet.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button
            asChild
            size="lg"
            className="h-12 px-8 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50"
          >
            <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
              Falar com um Consultor
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 px-8 text-base font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-orange-300 hover:text-orange-700"
          >
            <a href="#planos">Ver Planos e Preços</a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

// ─── 2. GRID DE AUDIÊNCIAS ──────────────────────────────────────────────────

const audienceCards = [
  {
    icon: Bike,
    title: 'Delivery Dinâmico',
    text: 'Câmbio automático no checkout, zonas de entrega por raio de precisão e KDS na cozinha para eliminar o caos do WhatsApp.',
  },
  {
    icon: LayoutGrid,
    title: 'Salão e Autoatendimento',
    text: 'QR Codes inteligentes por mesa, chamada digital de garçons e construtor avançado para pizzas com impressão roteada.',
  },
  {
    icon: Scale,
    title: 'Operação Offline-First',
    text: 'O único sistema com módulo de pesagem e comandas virtuais que continua funcionando a 100% mesmo quando a internet do seu restaurante cai.',
  },
];

function AudienciasSection() {
  return (
    <section className="py-20 sm:py-28 px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Para cada modelo de negócio, uma solução
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Escolha o módulo ideal para o seu tipo de operação.
          </p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {audienceCards.map((card) => {
            const Icon = card.icon;
            return (
              <AnimateOnScroll key={card.title}>
                <Card className="h-full border-slate-200 bg-white shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-100 transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-slate-600 leading-relaxed">{card.text}</p>
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

// ─── 3. INTELIGÊNCIA E CONTROLE (Bento) ─────────────────────────────────────

const bentoBlocks = [
  {
    icon: BarChart3,
    title: 'Não apenas venda. Saiba exatamente onde está o seu lucro.',
    text: 'Nossa inteligência artificial categoriza seus produtos pela Matriz BCG e alerta automaticamente quando clientes fiéis estão em risco de churn (abandono).',
  },
  {
    icon: Shield,
    title: 'Controle total sobre a sua operação.',
    text: 'Crie acessos restritos para garçons, caixas e gerentes. Proteja seus dados financeiros e controle seu inventário e CMV com precisão milimétrica.',
  },
];

function InteligenciaSection() {
  return (
    <section className="py-20 sm:py-28 px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Inteligência e Controle
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Recursos Enterprise para quem quer dominar cada detalhe do negócio.
          </p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {bentoBlocks.map((block) => {
            const Icon = block.icon;
            return (
              <AnimateOnScroll key={block.title}>
                <Card className="border-slate-200 bg-white shadow-lg overflow-hidden">
                  <CardHeader className="space-y-4">
                    <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {block.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">{block.text}</p>
                  </CardHeader>
                </Card>
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── 4. PRICING TABLE ───────────────────────────────────────────────────────

const plans = [
  {
    name: 'Core',
    price: 'R$ 149,90',
    period: '/mês',
    tagline: 'Ideal para começar.',
    features: [
      'Cardápio digital',
      'Kanban de pedidos',
      'Dashboard financeira',
      'KDS básico',
    ],
    popular: false,
  },
  {
    name: 'Standard',
    price: 'R$ 349,90',
    period: '/mês',
    tagline: 'Para restaurantes em crescimento.',
    features: [
      'Delivery avançado',
      'QR na mesa',
      'Multimoeda BRL/PYG',
      'Impressão térmica',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'R$ 749,90',
    period: '/mês',
    tagline: 'Para alto volume e redes.',
    features: [
      'Buffet offline',
      'Controle de estoque/CMV',
      'BI com Risco de Churn',
      'Controle de acessos',
    ],
    popular: false,
  },
];

function PricingSection() {
  return (
    <section id="planos" className="py-20 sm:py-28 px-6 bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Planos e Preços
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Escolha o plano que melhor se encaixa no seu negócio.
          </p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => (
            <AnimateOnScroll key={plan.name}>
              <Card
                className={`h-full flex flex-col relative overflow-hidden ${
                  plan.popular
                    ? 'border-orange-300 ring-2 ring-orange-200 shadow-xl shadow-orange-100/50'
                    : 'border-slate-200 shadow-md'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                    Mais Popular
                  </div>
                )}
                <CardHeader className={plan.popular ? 'pt-14' : ''}>
                  <h3
                    className={`text-xl font-bold ${
                      plan.popular ? 'text-orange-600' : 'text-slate-900'
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <p className="text-slate-600 text-sm">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1 pt-4">
                    <span
                      className={`text-3xl font-extrabold ${
                        plan.popular ? 'text-orange-600' : 'text-slate-900'
                      }`}
                    >
                      {plan.price}
                    </span>
                    <span className="text-slate-500 text-sm">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <ChevronRight
                          className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                            plan.popular ? 'text-orange-500' : 'text-slate-400'
                          }`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button
                    asChild
                    className={`w-full h-11 ${
                      plan.popular
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
                      Falar com Consultor
                    </a>
                  </Button>
                </div>
              </Card>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
        <a href="/" className="flex items-center">
          <img
            src="/logo_quiero_food.svg"
            alt="Quiero.Food"
            className="h-7 w-auto"
          />
        </a>
        <nav className="flex items-center gap-4">
          <a
            href="#planos"
            className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors"
          >
            Planos
          </a>
          <Button
            asChild
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <a href={DEFAULT_WA_LINK} target="_blank" rel="noopener noreferrer">
              Falar com Consultor
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-10 px-6 border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img
          src="/logo_quiero_food.svg"
          alt="Quiero.Food"
          className="h-6 w-auto opacity-70"
        />
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Quiero.Food. Todos os direitos reservados.
        </p>
        <a
          href={DEFAULT_WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
        >
          Contato
        </a>
      </div>
    </footer>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function PaginaPtBr() {
  return (
    <PageTransition>
      {/* Força Light Mode: override explícito para tema claro em qualquer dispositivo */}
      <div className="min-h-screen bg-white text-slate-900 dark:bg-white dark:text-slate-900">
        <Navbar />
        <main>
          <HeroSection />
          <AudienciasSection />
          <InteligenciaSection />
          <PricingSection />
        </main>
        <Footer />
      </div>
    </PageTransition>
  );
}
