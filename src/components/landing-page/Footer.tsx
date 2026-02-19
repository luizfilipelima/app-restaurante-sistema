import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useMainLanding, mlc, mlcJson } from '@/contexts/MainLandingCtx';

interface FooterLink  { label: string; href: string }
interface FooterCol   { title: string; links: FooterLink[] }

const DEFAULT_COLS: FooterCol[] = [
  { title: 'Produto',  links: [{ label: 'Cardápio Digital', href: '#' }, { label: 'Gestão de Pedidos', href: '#' }, { label: 'Integração WhatsApp', href: '#' }, { label: 'Impressão Térmica', href: '#' }] },
  { title: 'Empresa',  links: [{ label: 'Sobre Nós', href: '#' }, { label: 'Carreiras', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Contato', href: '#' }] },
  { title: 'Legal',    links: [{ label: 'Termos de Uso', href: '#' }, { label: 'Privacidade', href: '#' }, { label: 'Cookies', href: '#' }] },
];

export default function Footer() {
  const { c, primaryColor, logoUrl, appLink } = useMainLanding();

  const tagline        = mlc(c, 'main_footer', 'tagline',        'O sistema de delivery mais amado da fronteira. Feito para quem tem fome de crescer.');
  const instagramUrl   = mlc(c, 'main_footer', 'instagram_url',  '#');
  const facebookUrl    = mlc(c, 'main_footer', 'facebook_url',   '#');
  const twitterUrl     = mlc(c, 'main_footer', 'twitter_url',    '#');
  const copyrightText  = mlc(c, 'main_footer', 'copyright_text', 'Quiero Food. Todos os direitos reservados.');
  const madeInText     = mlc(c, 'main_footer', 'made_in_text',   'Feito com ❤️ em Ciudad del Este');
  const footerLogoUrl  = mlc(c, 'main_footer', 'footer_logo_url','');
  const productCols    = mlcJson<FooterCol[]>(c, 'main_footer', 'product_cols', DEFAULT_COLS);

  // Logo exclusiva do rodapé; fallback para a logo principal
  const displayLogo = footerLogoUrl || logoUrl;

  return (
    <footer className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

          {/* Brand */}
          <div className="md:col-span-1 space-y-6">
            <a href="/" className="inline-block">
              <img src={displayLogo} alt="Quiero.food" className="h-9 w-auto object-contain" />
            </a>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{tagline}</p>
            <div className="flex gap-4 pt-4">
              <a
                href={instagramUrl}
                className="text-slate-500 hover:text-white transition-colors"
                style={{ ['--hover-color' as string]: primaryColor }}
                onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '')}
              >
                <Instagram size={20} />
              </a>
              <a
                href={facebookUrl}
                className="text-slate-500 hover:text-white transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '')}
              >
                <Facebook size={20} />
              </a>
              <a
                href={twitterUrl}
                className="text-slate-500 hover:text-white transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '')}
              >
                <Twitter size={20} />
              </a>
            </div>
          </div>

          {/* Colunas dinâmicas */}
          {productCols.map((col, idx) => (
            <div key={idx} className="md:col-span-1 space-y-4">
              <h4 className="font-semibold text-white">{col.title}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                {col.links.map((link, li) => (
                  <li key={li}>
                    <a
                      href={link.href}
                      className="transition-colors hover:text-slate-200"
                      onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {copyrightText}</p>
          <p className="flex items-center gap-1">{madeInText}</p>
          <a
            href={appLink}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = '')}
          >
            Acessar Plataforma →
          </a>
        </div>
      </div>
    </footer>
  );
}
