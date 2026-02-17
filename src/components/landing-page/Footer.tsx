import { Facebook, Instagram, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1 space-y-6">
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 text-white p-1.5 rounded-lg">
                <span className="font-bold text-lg">Q</span>
              </div>
              <span className="font-bold text-xl text-white tracking-tight">Quiero</span>
            </div>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
              O sistema de delivery mais amado da fronteira. Feito para quem tem fome de crescer.
            </p>
            <div className="flex gap-4 pt-4">
              <a href="#" className="text-slate-500 hover:text-white transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors"><Facebook size={20} /></a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors"><Twitter size={20} /></a>
            </div>
          </div>
          
          <div className="md:col-span-1 space-y-4">
            <h4 className="font-semibold text-white">Produto</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-orange-400 transition-colors">Cardápio Digital</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Gestão de Pedidos</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Integração WhatsApp</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Impressão Térmica</a></li>
            </ul>
          </div>
          
          <div className="md:col-span-1 space-y-4">
            <h4 className="font-semibold text-white">Empresa</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-orange-400 transition-colors">Sobre Nós</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Carreiras</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Contato</a></li>
            </ul>
          </div>
          
          <div className="md:col-span-1 space-y-4">
            <h4 className="font-semibold text-white">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-orange-400 transition-colors">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Privacidade</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Cookies</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Quiero Food. Todos os direitos reservados.</p>
          <p className="flex items-center gap-1">
            Feito com <span className="text-red-500">❤️</span> em Ciudad del Este
          </p>
        </div>
      </div>
    </footer>
  );
}
