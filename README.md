# Sistema de Gestão de Restaurantes SaaS Multi-tenant

Sistema completo de gestão para pizzarias e restaurantes com cardápio digital, painel administrativo, sistema de cozinha (KDS) e painel super admin.

## 🚀 Tecnologias Utilizadas

- **React** com Vite
- **TypeScript**
- **Tailwind CSS** para estilização
- **Shadcn/UI** para componentes
- **Lucide React** para ícones
- **React Router DOM** para rotas
- **Supabase** (Banco de Dados, Auth e Realtime)
- **Zustand** para estado global
- **Recharts** para gráficos
- **Date-fns** para datas

## 📋 Funcionalidades

### 1. Cardápio Digital (Cliente)
- Interface mobile-first responsiva
- Navegação por categorias
- Sistema especial para pizzas:
  - Seleção de tamanho
  - Escolha de até N sabores (baseado no tamanho)
  - Seleção de massa
  - Seleção de borda recheada
  - Preço calculado pelo sabor mais caro
- Carrinho de compras com persistência
- Checkout completo
- Integração com WhatsApp para envio do pedido

### 2. Painel Administrativo (Restaurante)
- Dashboard com métricas e gráficos
- Gestão de pedidos (Sistema Kanban):
  - Pendente → Em Preparo → Pronto → Saiu para Entrega → Concluído
  - Atualização em tempo real
- CRUD de cardápio (produtos, categorias)
- Gestão de zonas de entrega com taxas
- Configurações do restaurante (logo, cores, dados)

### 3. Sistema de Cozinha (KDS)
- Interface otimizada para tablets/monitores
- Recebe pedidos em tempo real via Supabase Realtime
- Ordenação prioritária (pedidos pagos primeiro)
- Cards com:
  - Tempo decorrido
  - Destaque visual por urgência
  - Detalhes dos itens
  - Observações em destaque
- Botão "PRONTO" para notificar recepção

### 4. Painel Super Admin
- Visualização de métricas globais
- Gestão de restaurantes (criar, ativar/desativar)
- Controle de tenants (Multi-tenant)

## 🛠️ Configuração do Projeto

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o script SQL do arquivo `supabase/db/schema/initial.sql` no SQL Editor do Supabase
3. Copie `.env.example` para `.env` e preencha as variáveis:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

### 3. Executar em Desenvolvimento

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`

### 4. Build para Produção

```bash
npm run build
```

## 🗄️ Estrutura do Banco de Dados

### Principais Tabelas:

- **restaurants** - Dados dos restaurantes (tenants)
- **users** - Usuários com roles (super_admin, restaurant_admin, kitchen)
- **products** - Produtos do cardápio
- **pizza_sizes** - Tamanhos de pizza
- **pizza_flavors** - Sabores de pizza
- **pizza_doughs** - Tipos de massa
- **pizza_edges** - Bordas recheadas
- **delivery_zones** - Zonas de entrega com taxas
- **orders** - Pedidos
- **order_items** - Itens dos pedidos

## 🔐 Sistema de Autenticação

O sistema utiliza o Supabase Auth com controle de acesso baseado em roles:

- **super_admin** - Acesso total ao sistema
- **restaurant_admin** - Acesso ao painel do restaurante
- **kitchen** - Acesso apenas ao KDS (cozinha)

## 📱 Rotas do Sistema

### Públicas
- `/:restaurantSlug` - Cardápio digital
- `/:restaurantSlug/checkout` - Checkout
- `/login` - Login

### Admin do Restaurante
- `/admin` - Dashboard
- `/admin/orders` - Gestão de pedidos (Kanban)
- `/admin/menu` - Gestão de cardápio
- `/admin/delivery-zones` - Zonas de entrega
- `/admin/settings` - Configurações

### Cozinha
- `/kitchen` - Sistema KDS

### Super Admin
- `/super-admin` - Dashboard global
- `/super-admin/restaurants` - Gestão de restaurantes

## 🚀 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório GitHub ao Vercel
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — obrigatória para o webhook `/api/webhooks/evolution` (WhatsApp Evolution API)
3. Deploy automático!

Para deploy completo do fluxo WhatsApp, veja [docs/WHATSAPP-EVOLUTION-DEPLOY.md](docs/WHATSAPP-EVOLUTION-DEPLOY.md).

### Outras Plataformas

O projeto é compatível com qualquer hospedagem que suporte aplicações React (Netlify, Railway, etc.)

## 📝 Próximos Passos

1. Configurar o banco de dados no Supabase
2. Criar o primeiro usuário super admin manualmente no banco
3. Fazer login e criar o primeiro restaurante
4. Configurar produtos e zonas de entrega
5. Compartilhar o link do cardápio digital

## 🆘 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

## 📄 Licença

Este projeto está sob a licença MIT.
