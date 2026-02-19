import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Globe } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMainLanding, mlc, mlcJson } from '@/contexts/MainLandingCtx';

interface NavItem { label: string; href: string }

const DEFAULT_NAV: NavItem[] = [
  { label: 'Funcionalidades', href: '#features' },
  { label: 'Preços',          href: '#pricing' },
  { label: 'FAQ',             href: '#faq' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<'pt' | 'es'>('pt');
  const { c, primaryColor, logoUrl, waLink, appLink } = useMainLanding();

  const ctaLabel   = mlc(c, 'main_header', 'cta_label',   'Testar Grátis');
  const loginLabel = mlc(c, 'main_header', 'login_label', 'Entrar');

  // Nav items: JSON array com label + href (backwards-compat com campos individuais)
  const rawNav1 = mlc(c, 'main_header', 'nav_item_1', 'Funcionalidades');
  const rawNav2 = mlc(c, 'main_header', 'nav_item_2', 'Preços');
  const rawNav3 = mlc(c, 'main_header', 'nav_item_3', 'FAQ');
  const fallbackNav: NavItem[] = [
    { label: rawNav1, href: '#features' },
    { label: rawNav2, href: '#pricing' },
    { label: rawNav3, href: '#faq' },
  ];
  const navItems = mlcJson<NavItem[]>(c, 'main_header', 'nav_items', fallbackNav.length ? fallbackNav : DEFAULT_NAV);

  const handleNavClick = (href: string) => {
    if (href.startsWith('#')) {
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (href && href !== '#') {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
    setMobileMenuOpen(false);
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
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <img src={logoUrl} alt="Quiero.food" className="h-8 md:h-9 w-auto object-contain" />
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item, i) => (
            <button
              key={i}
              onClick={() => handleNavClick(item.href)}
              className="text-sm font-medium text-slate-600 transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            onClick={() => setLang(lang === 'pt' ? 'es' : 'pt')}
          >
            <Globe className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700 uppercase">{lang}</span>
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-700" asChild>
            <a href={appLink}>{loginLabel}</a>
          </Button>
          <Button
            className="text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
            asChild
          >
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              {ctaLabel}
            </a>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-slate-600"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
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
              {navItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleNavClick(item.href)}
                  className="text-left font-medium text-slate-900 py-2"
                >
                  {item.label}
                </button>
              ))}
              <hr className="border-slate-100" />
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 text-sm">Idioma</span>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100"
                  onClick={() => setLang(lang === 'pt' ? 'es' : 'pt')}
                >
                  <span className={`text-xs font-bold ${lang === 'pt' ? 'text-orange-600' : 'text-slate-400'}`}>PT</span>
                  <span className="text-slate-300">|</span>
                  <span className={`text-xs font-bold ${lang === 'es' ? 'text-orange-600' : 'text-slate-400'}`}>ES</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button variant="outline" className="w-full justify-center" asChild>
                  <a href={appLink}>{loginLabel}</a>
                </Button>
                <Button
                  className="w-full justify-center text-white"
                  style={{ backgroundColor: primaryColor }}
                  asChild
                >
                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                    {ctaLabel}
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
