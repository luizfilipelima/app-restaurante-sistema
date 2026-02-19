import { motion } from 'framer-motion';
import {
  BadgeCheck, Printer, QrCode, BarChart, Zap, Clock, TrendingUp,
  MessageCircle, Star, Award, Bell, Layers, Shield, Target, Rocket,
  Globe, Package, Users, Monitor, Wallet, Database, Heart, Wifi,
  Lock, CheckCircle, BarChart2, PieChart, Activity, Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMainLanding, mlc } from '@/contexts/MainLandingCtx';

const BENTO_ICON_MAP: Record<string, React.ElementType> = {
  BadgeCheck, Printer, QrCode, BarChart, Zap, Clock, TrendingUp,
  MessageCircle, Star, Award, Bell, Layers, Shield, Target, Rocket,
  Globe, Package, Users, Monitor, Wallet, Database, Heart, Wifi,
  Lock, CheckCircle, BarChart2, PieChart, Activity, Flame,
};

function BentoIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = BENTO_ICON_MAP[name] ?? Zap;
  return <Icon className={className} style={style} />;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function ProblemSolution() {
  const { c, primaryColor } = useMainLanding();

  const sectionTitle    = mlc(c, 'main_problem', 'section_title',    'Adeus, caderninho.');
  const sectionSubtitle = mlc(c, 'main_problem', 'section_subtitle', 'Automatize o processo desde o pedido até a entrega.');

  const card1Title = mlc(c, 'main_problem', 'card1_title', 'Fim do Caos no WhatsApp');
  const card1Desc  = mlc(c, 'main_problem', 'card1_desc',  'Organize todos os pedidos em um único painel. Sem prints, sem áudios perdidos.');
  const card1Cta   = mlc(c, 'main_problem', 'card1_cta',   'Ver Demo');

  const card2Title = mlc(c, 'main_problem', 'card2_title', 'Impressão Automática');
  const card2Desc  = mlc(c, 'main_problem', 'card2_desc',  'O pedido sai direto na cozinha.');
  const card2Icon  = mlc(c, 'main_problem', 'card2_icon',  'Printer');

  const card3Title = mlc(c, 'main_problem', 'card3_title', 'QR Code na Mesa');
  const card3Desc  = mlc(c, 'main_problem', 'card3_desc',  'Cardápio digital sem contato.');
  const card3Icon  = mlc(c, 'main_problem', 'card3_icon',  'QrCode');

  const card4Title = mlc(c, 'main_problem', 'card4_title', 'Mapa de Calor');
  const card4Desc  = mlc(c, 'main_problem', 'card4_desc',  'Saiba onde seus clientes estão.');
  const card4Icon  = mlc(c, 'main_problem', 'card4_icon',  'BarChart');

  const card5Title = mlc(c, 'main_problem', 'card5_title', 'Entregas em Tempo Real');
  const card5Desc  = mlc(c, 'main_problem', 'card5_desc',  'Acompanhe cada pedido até a porta do cliente.');
  const card5Icon  = mlc(c, 'main_problem', 'card5_icon',  'Zap');

  const card6Title = mlc(c, 'main_problem', 'card6_title', 'Relatórios Inteligentes');
  const card6Desc  = mlc(c, 'main_problem', 'card6_desc',  'Dados e insights para crescer mais rápido.');
  const card6Icon  = mlc(c, 'main_problem', 'card6_icon',  'TrendingUp');

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <BadgeCheck className="w-12 h-12 mx-auto" style={{ color: primaryColor }} />
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
            {sectionTitle}
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">{sectionSubtitle}</p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]"
        >
          {/* Card 1 — destaque grande (col-span-2, row-span-2) */}
          <motion.div
            variants={item}
            className="md:col-span-2 row-span-2 relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{card1Title}</h3>
                <p className="text-slate-500 max-w-xs">{card1Desc}</p>
              </div>
              <Button className="w-fit bg-slate-900 text-white hover:bg-slate-800">
                {card1Cta}
              </Button>
            </div>
            <div className="absolute right-0 bottom-0 w-1/2 h-3/4 bg-white rounded-tl-3xl border-t border-l border-slate-200 shadow-xl translate-y-4 translate-x-4 group-hover:translate-y-2 transition-transform">
              <div className="p-4 space-y-2">
                <div className="h-2 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
                <div className="h-4 w-1/2 bg-slate-100 rounded" />
              </div>
            </div>
          </motion.div>

          {/* Card 2 — fundo branco, ícone centralizado */}
          <motion.div
            variants={item}
            className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-4 shadow-sm transition-colors group"
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${primaryColor}40`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
          >
            <div className="p-4 rounded-2xl group-hover:scale-110 transition-transform" style={{ backgroundColor: `${primaryColor}15` }}>
              <BentoIcon name={card2Icon} className="w-8 h-8" style={{ color: primaryColor } as React.CSSProperties} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{card2Title}</h3>
            <p className="text-sm text-slate-500">{card2Desc}</p>
          </motion.div>

          {/* Card 3 — fundo escuro */}
          <motion.div
            variants={item}
            className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col items-center justify-center text-center gap-4 shadow-xl text-white"
          >
            <div className="p-4 bg-white/10 rounded-2xl">
              <BentoIcon name={card3Icon} className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold">{card3Title}</h3>
            <p className="text-sm text-slate-400">{card3Desc}</p>
          </motion.div>

          {/* Card 4 — gradiente colorido */}
          <motion.div
            variants={item}
            className="md:col-span-1 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #f59e0b)` }}
          >
            <BentoIcon name={card4Icon} className="w-8 h-8 opacity-80" />
            <div>
              <h3 className="text-xl font-bold mb-1">{card4Title}</h3>
              <p className="text-sm opacity-80">{card4Desc}</p>
            </div>
            <div className="h-24 mt-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20" />
          </motion.div>

          {/* Card 5 — gradiente colorido (novo) */}
          <motion.div
            variants={item}
            className="md:col-span-1 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg"
            style={{ background: `linear-gradient(135deg, #0ea5e9, ${primaryColor})` }}
          >
            <BentoIcon name={card5Icon} className="w-8 h-8 opacity-80" />
            <div>
              <h3 className="text-xl font-bold mb-1">{card5Title}</h3>
              <p className="text-sm opacity-80">{card5Desc}</p>
            </div>
            <div className="h-24 mt-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20" />
          </motion.div>

          {/* Card 6 — gradiente colorido (novo) */}
          <motion.div
            variants={item}
            className="md:col-span-1 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg"
            style={{ background: `linear-gradient(135deg, #7c3aed, #0ea5e9)` }}
          >
            <BentoIcon name={card6Icon} className="w-8 h-8 opacity-80" />
            <div>
              <h3 className="text-xl font-bold mb-1">{card6Title}</h3>
              <p className="text-sm opacity-80">{card6Desc}</p>
            </div>
            <div className="h-24 mt-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
