import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Globe } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<'pt' | 'es'>('pt');

  const toggleLanguage = () => setLang(lang === 'pt' ? 'es' : 'pt');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50"
    >
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/quierofood-logo-f.svg" alt="Quiero.food" className="h-8 md:h-9 w-auto object-contain" />
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">Funcionalidades</button>
          <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">Preços</button>
          <button onClick={() => scrollToSection('faq')} className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">FAQ</button>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer" onClick={toggleLanguage}>
            <Globe className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700 uppercase">{lang}</span>
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-200" asChild>
            <a href="https://app.quiero.food">Entrar</a>
          </Button>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20" asChild>
            <a href="https://wa.me/5575992776610?text=Hola%20Filipe%2C%20me%20gustaria%20testar%20gratis%20el%20sistema%20Quiero%20Food" target="_blank" rel="noopener noreferrer">
              Testar Grátis
            </a>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4 flex flex-col">
              <button onClick={() => scrollToSection('features')} className="text-left font-medium text-slate-900 py-2">Funcionalidades</button>
              <button onClick={() => scrollToSection('pricing')} className="text-left font-medium text-slate-900 py-2">Preços</button>
              <button onClick={() => scrollToSection('faq')} className="text-left font-medium text-slate-900 py-2">FAQ</button>
              <hr className="border-slate-100" />
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 text-sm">Idioma</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100" onClick={toggleLanguage}>
                  <span className={`text-xs font-bold ${lang === 'pt' ? 'text-orange-600' : 'text-slate-400'}`}>PT</span>
                  <span className="text-slate-300">|</span>
                  <span className={`text-xs font-bold ${lang === 'es' ? 'text-orange-600' : 'text-slate-400'}`}>ES</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button variant="outline" className="w-full justify-center" asChild>
                  <a href="https://app.quiero.food">Entrar</a>
                </Button>
                <Button className="w-full justify-center bg-orange-600 hover:bg-orange-700 text-white" asChild>
                  <a href="https://wa.me/5575992776610?text=Hola%20Filipe%2C%20me%20gustaria%20testar%20gratis%20el%20sistema%20Quiero%20Food" target="_blank" rel="noopener noreferrer">
                    Testar Grátis
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
