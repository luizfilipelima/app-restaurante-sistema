import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';

const plans = [
  {
    name: "Iniciante",
    price: "Grátis",
    period: "Para sempre",
    features: [
      "Até 50 pedidos/mês",
      "Cardápio Digital Básico",
      "Recebimento no WhatsApp",
      "1 Usuário Admin"
    ],
    cta: "Começar Agora",
    popular: false,
    color: "slate"
  },
  {
    name: "Pro",
    price: "U$ 29",
    period: "/mês",
    features: [
      "Pedidos Ilimitados",
      "Impressão Automática",
      "Domínio Próprio (.com)",
      "Gestão de Motoboys",
      "Suporte Prioritário",
      "3 Usuários Admin"
    ],
    cta: "Testar Grátis 7 dias",
    popular: true,
    color: "orange"
  },
  {
    name: "Enterprise",
    price: "Consultar",
    period: "",
    features: [
      "Múltiplas Filiais",
      "App Próprio na Loja",
      "API de Integração",
      "Gerente de Conta",
      "Treinamento Presencial"
    ],
    cta: "Falar com Vendas",
    popular: false,
    color: "slate"
  }
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-slate-50 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">Investimento Simples.</h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Escolha o plano ideal para o tamanho da sua fome de crescer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`h-full relative flex flex-col ${plan.popular ? 'border-orange-500 shadow-xl scale-105 z-10' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Mais Vendido
                  </div>
                )}
                
                <CardHeader className="text-center pb-8 pt-8">
                  <CardTitle className="text-xl font-medium text-slate-600 mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{plan.price}</span>
                    <span className="text-slate-400 font-medium text-sm">{plan.period}</span>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <ul className="space-y-4">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <Check className={`h-5 w-5 shrink-0 ${plan.popular ? 'text-orange-500' : 'text-slate-400'}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter className="pt-8 pb-8">
                  <Button 
                    variant={plan.popular ? 'default' : 'outline'}
                    className={`w-full h-12 rounded-xl font-semibold ${plan.popular ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
