import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Bike,
  Printer,
  Clock,
  MessageCircle,
  LayoutDashboard,
  Shield,
  Zap,
} from 'lucide-react';

const FEATURE_GROUPS = [
  {
    title: 'Venda e cardápio',
    description: 'Seu negócio online profissional, sem complicação.',
    icon: ShoppingBag,
    color: 'orange',
    items: [
      'Cardápio digital com seu link (ex: sua-loja.quiero.food)',
      'Categorias, fotos e descrições dos produtos',
      'Montagem de pizzas: tamanhos, sabores, massas e bordas',
      'Retirada ou entrega; cliente escolhe no checkout',
      'Multi-moeda: Reais e Guaranies no mesmo cardápio',
    ],
  },
  {
    title: 'Pedidos em tempo real',
    description: 'Nada se perde. Tudo num só lugar.',
    icon: Zap,
    color: 'amber',
    items: [
      'Kanban visual: Pendente → Preparando → Pronto → Entrega → Concluído',
      'Pedidos chegam na hora (Realtime); sem F5',
      'Modo Cozinha: tela dedicada para a equipe de produção',
      'Marcar como pago e acompanhar status em um clique',
    ],
  },
  {
    title: 'Entrega sob controle',
    description: 'Taxas certas e entregadores organizados.',
    icon: Bike,
    color: 'blue',
    items: [
      'Zonas de entrega com taxa por bairro (Centro, Km 7, etc.)',
      'Gestão de motoboys: cadastro, status e atribuição ao pedido',
      'Select no pedido para definir quem vai entregar',
      'Endereço e bairro no resumo para o entregador',
    ],
  },
  {
    title: 'Impressão e operação',
    description: 'Cozinha e caixa alinhados, sem papel em branco.',
    icon: Printer,
    color: 'slate',
    items: [
      'Cupom não fiscal para impressoras térmicas (58mm e 80mm)',
      'Impressão automática ao receber pedido (opcional)',
      'Botão imprimir em qualquer pedido quando quiser',
      'Layout pronto: itens, totais, endereço e observações',
    ],
  },
  {
    title: 'Horário e disponibilidade',
    description: 'Você decide quando está aberto.',
    icon: Clock,
    color: 'emerald',
    items: [
      'Horário de funcionamento por dia da semana',
      'Opção "Sempre aberto (24h)" para quem não para',
      'Fechado manualmente: um clique e o cardápio mostra "Fechado"',
      'Cliente não finaliza pedido fora do horário',
    ],
  },
  {
    title: 'Pagamento e WhatsApp',
    description: 'Cliente paga como preferir; você recebe o pedido formatado.',
    icon: MessageCircle,
    color: 'green',
    items: [
      'PIX, cartão na entrega e dinheiro com campo de troco',
      'Ao finalizar, mensagem pronta para enviar no WhatsApp do restaurante',
      'Resumo do pedido, endereço e total na mensagem',
      'Integração pensada para a fronteira (BR/PY)',
    ],
  },
  {
    title: 'Painel e relatórios',
    description: 'Visão clara do seu negócio.',
    icon: LayoutDashboard,
    color: 'violet',
    items: [
      'Dashboard com métricas: pedidos, faturamento e ticket médio',
      'Gráficos e indicadores por período',
      'Configurações: logo, cores, telefone, Instagram',
      'Domínio e link do cardápio na mão',
    ],
  },
  {
    title: 'Segurança e multi-marca',
    description: 'Cada restaurante vê só o que é seu.',
    icon: Shield,
    color: 'red',
    items: [
      'Sistema multi-tenant: um plano, vários restaurantes (super admin)',
      'Favicon dinâmico: cliente vê a logo do seu restaurante na aba',
      'Controle de acesso por perfil (admin, cozinha)',
      'Dados na nuvem (Supabase) com políticas de segurança',
    ],
  },
];

const colorClasses: Record<string, string> = {
  orange: 'bg-orange-100 text-orange-600',
  amber: 'bg-amber-100 text-amber-600',
  blue: 'bg-blue-100 text-blue-600',
  slate: 'bg-slate-100 text-slate-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  green: 'bg-green-100 text-green-600',
  violet: 'bg-violet-100 text-violet-600',
  red: 'bg-red-100 text-red-600',
};

export default function Features() {
  return (
    <section id="features" className="py-20 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
            Tudo o que você precisa para vender mais.
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Um único sistema: cardápio, pedidos, cozinha, entrega e impressão. Sem mensalidades escondidas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {FEATURE_GROUPS.map((group, index) => {
            const Icon = group.icon;
            const color = colorClasses[group.color] || colorClasses.slate;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{group.title}</h3>
                    <p className="text-sm text-slate-500 mb-4">{group.description}</p>
                    <ul className="space-y-2">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-slate-600 font-medium">
            + Modo Cozinha em tela cheia · QR Code na mesa · Logo e cores do seu negócio · Suporte para crescer.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
