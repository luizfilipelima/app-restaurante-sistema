import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useMainLanding, mlc, mlcJson } from '@/contexts/MainLandingCtx';

interface FaqItem { question: string; answer: string }

const DEFAULT_FAQ: FaqItem[] = [
  { question: 'Preciso de cartão de crédito para testar?', answer: 'Não. Você pode criar sua conta e testar o plano Pro por 7 dias grátis. Só pedimos o cartão se decidir continuar após o período de teste.' },
  { question: 'Funciona em celular e tablet?', answer: 'Sim! O sistema é 100% responsivo e funciona em qualquer dispositivo com navegador (Chrome, Safari, etc). O painel do restaurante é otimizado para tablets e computadores.' },
  { question: 'O que está incluso nos $100/mês?', answer: 'Tudo: cardápio digital com seu link, pedidos em tempo real (Kanban + Modo Cozinha), zonas de entrega, gestão de motoboys, impressão de cupom térmico (inclusive automática), horário de funcionamento, multi-moeda, dashboard com métricas e até 3 usuários. Sem custos escondidos.' },
  { question: 'Como funciona a impressão automática?', answer: 'No painel você ativa a opção "Impressão automática ao receber pedido" e escolhe a largura do papel (58mm ou 80mm). Quando um novo pedido chega, o navegador abre a janela de impressão e você seleciona a impressora térmica. O cupom sai com itens, totais e endereço.' },
  { question: 'Posso usar meu próprio domínio .com?', answer: 'No plano Pro você usa seu link no formato sualoja.quiero.food. Domínio próprio (.com) pode ser disponibilizado em versões Enterprise; consulte-nos.' },
];

export default function FAQ() {
  const { c, primaryColor } = useMainLanding();

  const sectionTitle    = mlc(c, 'main_faq', 'section_title',    'Dúvidas frequentes.');
  const sectionSubtitle = mlc(c, 'main_faq', 'section_subtitle', 'Tudo o que você precisa saber antes de começar.');
  const items           = mlcJson<FaqItem[]>(c, 'main_faq', 'items', DEFAULT_FAQ);

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
            {sectionTitle}
          </h2>
          <p className="text-xl text-slate-500">{sectionSubtitle}</p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <AccordionItem
                value={`item-${index}`}
                className="border border-slate-200 rounded-xl px-4 bg-slate-50"
              >
                <AccordionTrigger
                  className="text-left font-semibold text-slate-900 py-4 transition-colors"
                  style={{ ['--hover-color' as string]: primaryColor }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = primaryColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-4 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
