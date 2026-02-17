import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const plans = [
  {
    name: "Iniciante",
    price: "Grátis",
    period: "Para sempre",
    features: [
      "Até 50 pedidos/mês",
      "Cardápio digital básico",
      "Recebimento via WhatsApp",
      "1 usuário admin",
    ],
    cta: "Começar agora",
    popular: false,
    color: "slate",
  },
  {
    name: "Pro",
    price: "$100",
    period: "/mês",
    features: [
      "Pedidos ilimitados",
      "Cardápio digital com seu link (sualoja.quiero.food)",
      "Pedidos em tempo real (Kanban + Modo Cozinha)",
      "Zonas de entrega e taxa por bairro",
      "Gestão de motoboys e atribuição ao pedido",
      "Impressão de cupom térmico (58mm/80mm)",
      "Impressão automática ao receber pedido",
      "Horário de funcionamento e opção 24h",
      "Multi-moeda (Reais e Guaranies)",
      "PIX, cartão e dinheiro com troco",
      "Dashboard com métricas e relatórios",
      "Logo, cores e favicon do seu restaurante",
      "Suporte prioritário",
      "Até 3 usuários admin",
    ],
    cta: "Testar 7 dias grátis",
    popular: true,
    color: "orange",
  },
  {
    name: "Enterprise",
    price: "Consultar",
    period: "",
    features: [
      "Tudo do Pro",
      "Múltiplas filiais",
      "App na loja (sob consulta)",
      "API de integração",
      "Gerente de conta dedicado",
      "Treinamento presencial",
    ],
    cta: "Falar com vendas",
    popular: false,
    color: "slate",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
            Investimento que se paga com mais pedidos.
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Um preço fixo. Todas as funções do sistema. Sem surpresas na fatura.
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
              <Card
                className={`h-full relative flex flex-col ${
                  plan.popular
                    ? "border-orange-500 shadow-xl scale-105 z-10"
                    : "border-slate-200 shadow-sm hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Mais vendido
                  </div>
                )}

                <CardHeader className="text-center pb-6 pt-8">
                  <CardTitle className="text-xl font-medium text-slate-600 mb-2">
                    {plan.name}
                  </CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-slate-400 font-medium text-sm">{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm text-slate-600"
                      >
                        <Check
                          className={`h-5 w-5 shrink-0 ${
                            plan.popular ? "text-orange-500" : "text-slate-400"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-6 pb-8">
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    className={`w-full h-12 rounded-xl font-semibold ${
                      plan.popular
                        ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
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
