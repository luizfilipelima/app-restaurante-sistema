import { motion } from 'framer-motion';
import { BadgeCheck, Printer, QrCode, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProblemSolution() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <BadgeCheck className="w-12 h-12 text-orange-500 mx-auto" />
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">Adeus, caderninho.</h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Automatize o processo desde o pedido até a entrega.
          </p>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]"
        >
          {/* Card 1 (Large) - 2 cols */}
          <motion.div variants={item} className="md:col-span-2 row-span-2 relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Fim do Caos no WhatsApp</h3>
                <p className="text-slate-500 max-w-xs">Organize todos os pedidos em um único painel. Sem prints, sem áudios perdidos.</p>
              </div>
              <Button className="w-fit bg-slate-900 text-white hover:bg-slate-800">Ver Demo</Button>
            </div>
            {/* Visual Abstract Representation */}
            <div className="absolute right-0 bottom-0 w-1/2 h-3/4 bg-white rounded-tl-3xl border-t border-l border-slate-200 shadow-xl translate-y-4 translate-x-4 group-hover:translate-y-2 transition-transform">
              <div className="p-4 space-y-2">
                <div className="h-2 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
                <div className="h-4 w-1/2 bg-slate-100 rounded" />
              </div>
            </div>
          </motion.div>

          {/* Card 2 (Small) */}
          <motion.div variants={item} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-4 shadow-sm hover:border-orange-200 transition-colors group">
            <div className="p-4 bg-orange-50 rounded-2xl group-hover:scale-110 transition-transform">
              <Printer className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Impressão Automática</h3>
            <p className="text-sm text-slate-500">O pedido sai direto na cozinha.</p>
          </motion.div>

          {/* Card 3 (Small) */}
          <motion.div variants={item} className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col items-center justify-center text-center gap-4 shadow-xl text-white">
            <div className="p-4 bg-white/10 rounded-2xl">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold">QR Code na Mesa</h3>
            <p className="text-sm text-slate-400">Cardápio digital sem contato.</p>
          </motion.div>

          {/* Card 4 (Medium) - 1 col, row-span-1 (adjust if needed) */}
          <motion.div variants={item} className="md:col-span-1 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg">
            <BarChart className="w-8 h-8 opacity-80" />
            <div>
              <h3 className="text-xl font-bold mb-1">Mapa de Calor</h3>
              <p className="text-orange-100 text-sm">Saiba onde seus clientes estão.</p>
            </div>
            <div className="h-24 mt-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
