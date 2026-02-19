# Guia do Sistema de Gestão de Comandas para Buffet

## 📋 Visão Geral

Sistema completo de gestão de comandas para buffet com arquitetura **offline-first**, permitindo operação mesmo sem conexão com a internet. Ideal para restaurantes self-service que precisam de velocidade e confiabilidade.

## 🚀 Instalação e Configuração

### 1. Executar Migração SQL

Execute o arquivo `supabase/db/migrations/migration_buffet-comandas.sql` no Supabase SQL Editor:

```sql
-- O script cria:
-- - Tabelas: comandas, comanda_items
-- - Atualiza products com campos: price_sale, price_cost, is_by_weight, sku
-- - RLS policies para segurança multi-tenant
-- - Funções auxiliares (get_next_comanda_number, calculate_comanda_total)
```

### 2. Configurar Produtos

Acesse `/admin/products` e cadastre os produtos do buffet:

- **Produtos por Peso**: Marque "Vendido por peso (Buffet)"
- **Preço de Venda**: Preço por kg (ex: R$ 45,90/kg)
- **Custo (CMV)**: Custo do produto para cálculo de lucro real
- **SKU**: Código do produto (opcional, para scanner)

### 3. Importação em Massa (CSV)

Use o botão "Importar CSV" em `/admin/products`:

**Formato do CSV:**
```csv
name,category,price,price_sale,price_cost,sku,description,is_by_weight
Refrigerante,Bebidas,5.00,6.00,3.50,REF001,Refrigerante gelado,false
Buffet Completo,Buffet,45.90,45.90,25.00,BUF001,Buffet self-service,true
```

## 🎯 Como Usar

### Tela Principal: `/admin/buffet`

#### Criar Nova Comanda
- **Tecla F2** ou botão "Nova Comanda"
- Sistema gera número sequencial automaticamente

#### Selecionar Comanda
1. Digite o número da comanda no campo scanner (ex: `045`)
2. Pressione Enter ou escaneie o código de barras
3. A comanda será selecionada automaticamente

#### Adicionar Produtos

**Produtos por Peso (Buffet):**
1. Escaneie o código do produto ou digite o nome/SKU
2. Digite o peso em kg (ex: `0.350` para 350g)
3. Pressione Enter ou clique no botão de calcular
4. O sistema calcula automaticamente: `peso × preço/kg`

**Produtos Unitários:**
1. Escaneie o código ou selecione na lista
2. O produto é adicionado automaticamente (quantidade 1)

#### Fechar Comanda
- **Tecla F8** quando uma comanda estiver selecionada
- Confirme no diálogo
- A comanda será marcada como fechada

#### Remover Item
- Clique no ícone de lixeira ao lado do item
- O item será removido e o total atualizado

### Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| **F2** | Criar nova comanda |
| **F8** | Fechar comanda selecionada |
| **ESC** | Cancelar operação / Desselecionar comanda |
| **Enter** | Confirmar entrada (scanner ou peso) |

## 📊 Dashboard e Métricas

Acesse `/admin` para visualizar:

### Métricas de Buffet
- **Total de Comandas**: Quantidade de comandas fechadas no período
- **Receita Buffet**: Faturamento total do buffet
- **Ticket Médio**: Valor médio por comanda
- **CMV Real**: Custo das Mercadorias Vendidas (usando `price_cost`)
- **Lucro Real**: Receita - CMV
- **Margem**: Percentual de lucro

### Alertas de Ociosidade
- Comandas abertas há mais de **1 hora** sem fechamento
- Ajuda a prevenir perdas e esquecimentos

### Desempenho por Horário
- Gráfico de pesagens por intervalo de **30 minutos**
- Útil para planejar reposição do buffet

## 🔄 Sincronização Offline-First

### Como Funciona

1. **Operação Offline**: Todos os dados são salvos primeiro no IndexedDB (navegador)
2. **Sincronização Automática**: Quando a conexão retorna, os dados são enviados ao Supabase
3. **Indicador Visual**: 
   - 🟢 **Online**: Tudo sincronizado
   - 🔵 **Sincronizando**: Enviando dados pendentes
   - 🔴 **Offline**: Trabalhando localmente

### Status de Sincronização

O sistema mostra no canto superior direito:
- Status da conexão (Online/Offline/Sincronizando)
- Contador de itens pendentes de sincronização

### Garantias

- ✅ **Nunca perde dados**: Tudo é salvo localmente primeiro
- ✅ **Funciona sem internet**: Operação completa offline
- ✅ **Sincronização automática**: Quando voltar a conexão
- ✅ **Multi-dispositivo**: Dados sincronizados entre dispositivos

## 🎨 Interface Visual

### Cores das Comandas (por tempo aberto)

- 🟢 **Verde**: Aberta há menos de 15 minutos
- 🟡 **Amarelo**: Aberta há 15-60 minutos
- 🔴 **Vermelho**: Aberta há mais de 1 hora (atenção!)

### Cards de Comandas

Cada card mostra:
- Número da comanda
- Tempo aberto
- Total acumulado
- Quantidade de itens
- Lista de itens (quando selecionada)

## 📱 Responsividade

O sistema é totalmente responsivo:
- **Desktop**: Layout em grid com múltiplas colunas
- **Tablet**: Layout adaptado
- **Mobile**: Interface otimizada para telas pequenas

## 🔧 Manutenção

### Limpar Dados Locais

Se necessário limpar o cache offline:

```javascript
// No console do navegador (F12)
import { offlineDB } from './lib/offline-db';
await offlineDB.delete();
location.reload();
```

### Exportar Dados

Use a função de exportação CSV em `/admin/products` para backup.

## ⚠️ Troubleshooting

### Comanda não aparece após criar
- Aguarde alguns segundos para sincronização
- Verifique o indicador de status (Online/Offline)
- Recarregue a página se necessário

### Produto não encontrado no scanner
- Verifique se o SKU está cadastrado corretamente
- Tente buscar pelo nome do produto
- Confirme que o produto está ativo

### Erro ao sincronizar
- Verifique a conexão com a internet
- Os dados estão salvos localmente e serão sincronizados depois
- Verifique o console do navegador (F12) para detalhes

## 📝 Notas Importantes

1. **Primeiro Uso**: Configure os produtos antes de começar a operar
2. **Backup**: Exporte os dados regularmente via CSV
3. **Treinamento**: Treine a equipe nos atalhos de teclado para velocidade
4. **Monitoramento**: Acompanhe as métricas no dashboard regularmente
5. **CMV**: Configure o `price_cost` dos produtos para cálculos precisos de lucro

## 🎯 Próximos Passos

- [ ] Configurar produtos no painel `/admin/products`
- [ ] Testar operação offline (desligar WiFi)
- [ ] Treinar equipe nos atalhos de teclado
- [ ] Configurar impressão de comandas (futuro)
- [ ] Integrar com sistema de pagamento (futuro)

---

**Desenvolvido com ❤️ para restaurantes que precisam de velocidade e confiabilidade.**
