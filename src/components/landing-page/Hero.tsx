import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star } from 'lucide-react';

export default function Hero() {
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
            <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            Novo: Modo Cozinha Inteligente v2.0
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          >
            O Delivery que vende sozinho no <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">WhatsApp</span>.
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed"
          >
            Chega de perder pedidos no chat. Cardápio digital, impressão automática na cozinha e gestão inteligente para Ciudad del Este.
          </motion.p>

          {/* CTA + Input */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md"
          >
            <input 
              type="email" 
              placeholder="seu@email.com" 
              className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all shadow-sm"
            />
            <Button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-lg shadow-orange-600/25 whitespace-nowrap group">
              Criar Cardápio Grátis
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
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
              <div className="h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">+100</div>
            </div>
            <p className="text-sm text-slate-500">
              Usado por <strong className="text-slate-900">+100 restaurantes</strong> no Paraguai
            </p>
          </motion.div>
        </div>

        {/* Hero Image Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.5, type: 'spring' }}
          className="mt-16 md:mt-24 relative max-w-5xl mx-auto perspective-1000"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white aspect-[16/9] group">
            {/* Mockup Content Placeholder */}
            <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
              <span className="text-slate-400 font-medium">Dashboard Screenshot Mockup</span>
            </div>
            {/* Phone Mockup Floating */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-4 -bottom-12 w-1/4 aspect-[9/16] bg-slate-900 rounded-[2.5rem] border-[8px] border-slate-900 shadow-xl overflow-hidden hidden md:block"
            >
              <div className="w-full h-full bg-white flex items-center justify-center">
                 <span className="text-slate-300 text-xs">Mobile App</span>
              </div>
            </motion.div>
          </div>
          {/* Glow Effect */}
          <div className="absolute -inset-4 bg-orange-500/20 blur-3xl -z-10 rounded-[3rem]" />
        </motion.div>
      </div>
    </section>
  );
}
