import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { useMainLanding, mlc, mlcJson } from '@/contexts/MainLandingCtx';

interface Testimonial { name: string; role: string; content: string; rating: number }

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { name: 'Carlos Benitez',  role: 'Dono, Pizzaria Bella Italia', content: 'Desde que usamos o Quiero, nossos pedidos saem 30% mais rápido. O suporte local faz a diferença.', rating: 5 },
  { name: 'Maria González',  role: 'Gerente, Burger King CDE',    content: 'A integração com a impressora térmica é perfeita. Não perdemos mais nenhum pedido no horário de pico.', rating: 5 },
  { name: 'Fernando Silva',  role: 'Sushi House',                 content: 'O cardápio em Guarani e Reais facilitou muito para nossos clientes brasileiros e paraguaios.', rating: 5 },
];

export default function Testimonials() {
  const { c } = useMainLanding();

  const sectionTitle    = mlc(c, 'main_testimonials', 'section_title',    'Quem usa, recomenda.');
  const sectionSubtitle = mlc(c, 'main_testimonials', 'section_subtitle', 'Junte-se aos melhores restaurantes da fronteira.');
  const testimonials    = mlcJson<Testimonial[]>(c, 'main_testimonials', 'items', DEFAULT_TESTIMONIALS);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            {sectionTitle}
          </h2>
          <p className="text-xl text-slate-500">{sectionSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full border-slate-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-8 space-y-4">
                  <div className="flex gap-1" style={{ color: '#f59e0b' }}>
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} fill="currentColor" size={16} />
                    ))}
                  </div>
                  <p className="text-slate-600 leading-relaxed italic">"{t.content}"</p>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
