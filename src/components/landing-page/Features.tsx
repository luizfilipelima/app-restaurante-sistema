import { motion } from 'framer-motion';
import { DollarSign, MapPin } from 'lucide-react';

export default function Features() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 space-y-24">
        
        {/* Feature 1 */}
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1 space-y-6"
          >
            <div className="inline-flex p-3 bg-orange-100 text-orange-600 rounded-2xl">
              <DollarSign className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Cardápio Multi-moeda.</h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              Venda em <strong className="text-slate-800">Guaranies, Reais e Dólar</strong> simultaneamente. 
              O sistema atualiza a cotação e calcula o troco automaticamente para o seu caixa.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Cotação do dia personalizada
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Relatórios de fechamento em cada moeda
              </li>
            </ul>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-white aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                 <span className="text-slate-400">Mockup Tela de Pagamento</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Feature 2 */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12">
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1 space-y-6"
          >
            <div className="inline-flex p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <MapPin className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Taxa de Entrega por Bairro.</h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              Configure taxas específicas para o Centro, Km 7, Presidente Franco ou Foz.
              O cliente seleciona o bairro e a taxa é somada automaticamente.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Desenhe zonas de entrega no mapa
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Taxa grátis acima de X valor
              </li>
            </ul>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-white aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                 <span className="text-slate-400">Mockup Mapa de Entrega</span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
