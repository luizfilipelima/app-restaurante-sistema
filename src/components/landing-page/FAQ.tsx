import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function FAQ() {
  const items = [
    {
      question: "Preciso de cartão de crédito para testar?",
      answer: "Não. Você pode criar sua conta gratuita e testar por 7 dias sem compromisso. Só pedimos o cartão se você decidir assinar o plano Pro."
    },
    {
      question: "Funciona em celular e tablet?",
      answer: "Sim! O sistema é 100% responsivo e funciona em qualquer dispositivo com navegador (Chrome, Safari, etc). O painel do restaurante é otimizado para tablets e computadores."
    },
    {
      question: "Posso usar meu próprio domínio .com?",
      answer: "Sim, no plano Pro você pode conectar seu domínio (ex: suapizzaria.com) para fortalecer sua marca."
    },
    {
      question: "Como funciona a impressão automática?",
      answer: "Você instala nosso pequeno programa no computador do caixa (Windows). Ele detecta novos pedidos e envia para a impressora térmica configurada em segundos."
    }
  ];

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">Dúvidas frequentes.</h2>
          <p className="text-xl text-slate-500">Tudo o que você precisa saber antes de começar.</p>
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
              <AccordionItem value={`item-${index}`} className="border border-slate-200 rounded-xl px-4 bg-slate-50">
                <AccordionTrigger className="text-left font-semibold text-slate-900 hover:text-orange-600 transition-colors py-4">
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
