import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const comparisonFeatures: { name: string; basic: boolean; pro: boolean; enterprise: boolean }[] = [
  { name: 'Cardápio Digital', basic: true, pro: true, enterprise: true },
  { name: 'Pedidos via WhatsApp', basic: true, pro: true, enterprise: true },
  { name: 'Zonas de entrega (taxa por bairro)', basic: false, pro: true, enterprise: true },
  { name: 'Gestão de motoboys', basic: false, pro: true, enterprise: true },
  { name: 'Impressão automática (cupom térmico)', basic: false, pro: true, enterprise: true },
  { name: 'Pedidos em tempo real (Kanban + Cozinha)', basic: false, pro: true, enterprise: true },
  { name: 'Dashboard e BI (métricas)', basic: false, pro: true, enterprise: true },
  { name: 'BI avançado e relatórios custom', basic: false, pro: false, enterprise: true },
  { name: 'Domínio próprio (.com)', basic: false, pro: false, enterprise: true },
];

const planPrices = { basic: '$15', pro: '$100', enterprise: '$70+' };

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

        {/* Tabela de comparação */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 max-w-4xl mx-auto"
        >
          <h3 className="text-xl font-bold text-slate-900 text-center mb-6">
            Compare os planos
          </h3>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-4 px-4 font-semibold text-slate-900">
                    Funcionalidade
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-600 w-[22%]">
                    Basic
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-orange-600 w-[22%] bg-orange-50/50">
                    Pro
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-600 w-[22%]">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-700">{row.name}</td>
                    <td className="py-3 px-4 text-center">
                      {row.basic ? (
                        <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center bg-orange-50/30">
                      {row.pro ? (
                        <Check className="h-5 w-5 text-orange-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.enterprise ? (
                        <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-4 px-4 text-slate-900">Taxa mensal (CDE)</td>
                  <td className="py-4 px-4 text-center text-slate-900">{planPrices.basic}</td>
                  <td className="py-4 px-4 text-center text-orange-600 bg-orange-50/30">
                    {planPrices.pro}
                  </td>
                  <td className="py-4 px-4 text-center text-slate-900">{planPrices.enterprise}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
