# 📁 Estrutura do Projeto

## Visão Geral da Arquitetura

```
App-Restaurante-Sistema/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── ui/             # Componentes base do Shadcn/UI
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── badge.tsx
│   │   │   └── textarea.tsx
│   │   ├── admin/          # Componentes específicos do admin
│   │   │   └── AdminLayout.tsx
│   │   ├── public/         # Componentes do cardápio público
│   │   │   ├── ProductCard.tsx
│   │   │   ├── CartDrawer.tsx
│   │   │   └── PizzaModal.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── PublicRoute.tsx
│   │
│   ├── pages/              # Páginas da aplicação
│   │   ├── auth/           # Autenticação
│   │   │   ├── LoginPage.tsx
│   │   │   └── UnauthorizedPage.tsx
│   │   ├── public/         # Páginas públicas (cliente)
│   │   │   ├── Menu.tsx
│   │   │   └── Checkout.tsx
│   │   ├── admin/          # Painel do restaurante
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── Menu.tsx
│   │   │   ├── DeliveryZones.tsx
│   │   │   └── Settings.tsx
│   │   ├── kitchen/        # Sistema de cozinha
│   │   │   └── KitchenDisplay.tsx
│   │   └── super-admin/    # Painel super admin
│   │       ├── Dashboard.tsx
│   │       └── Restaurants.tsx
│   │
│   ├── store/              # Estado global (Zustand)
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   └── restaurantStore.ts
│   │
│   ├── lib/                # Utilitários e configurações
│   │   ├── supabase.ts     # Cliente Supabase
│   │   └── utils.ts        # Funções auxiliares
│   │
│   ├── types/              # TypeScript types/interfaces
│   │   └── index.ts
│   │
│   ├── App.tsx             # Configuração de rotas
│   ├── main.tsx            # Entry point
│   └── index.css           # Estilos globais
│
├── public/                 # Assets públicos
├── supabase-schema.sql     # Schema do banco de dados
├── package.json            # Dependências
├── tsconfig.json           # Configuração TypeScript
├── vite.config.ts          # Configuração Vite
├── tailwind.config.js      # Configuração Tailwind
├── postcss.config.js       # Configuração PostCSS
├── .env.example            # Exemplo de variáveis de ambiente
├── README.md               # Documentação principal
├── DEPLOY.md               # Guia de deploy
└── ESTRUTURA.md            # Este arquivo
```

## 🔑 Componentes Principais

### 1. **Cardápio Digital** (`pages/public/`)
- Interface mobile-first para clientes
- Navegação por categorias
- Modal especial para pizzas com customizações
- Carrinho de compras persistente
- Checkout com integração WhatsApp

### 2. **Painel Admin** (`pages/admin/`)
- Dashboard com métricas e gráficos (Recharts)
- Sistema Kanban de pedidos com 5 status
- CRUD de cardápio
- Gestão de zonas de entrega
- Configurações do restaurante

### 3. **Sistema de Cozinha (KDS)** (`pages/kitchen/`)
- Interface otimizada para tablets/monitores
- Recebe pedidos em tempo real (Supabase Realtime)
- Ordenação prioritária (pagos primeiro)
- Indicadores visuais de urgência
- Botão grande "PRONTO"

### 4. **Painel Super Admin** (`pages/super-admin/`)
- Métricas globais de todos restaurantes
- CRUD de restaurantes (tenants)
- Ativar/desativar restaurantes

## 🗄️ Estrutura do Banco (Supabase)

### Principais Tabelas:

1. **restaurants** - Dados dos restaurantes (tenants)
   - Logo, cores, telefone, slug único

2. **users** - Usuários com roles
   - super_admin, restaurant_admin, kitchen

3. **products** - Produtos do cardápio
   - Categorias, preços, imagens, flag is_pizza

4. **pizza_sizes** - Tamanhos de pizza
   - Nome, max_flavors, multiplicador de preço

5. **pizza_flavors** - Sabores disponíveis
   - Nome, preço, descrição

6. **pizza_doughs** - Tipos de massa
   - Nome, preço extra

7. **pizza_edges** - Bordas recheadas
   - Nome, preço

8. **delivery_zones** - Zonas de entrega
   - Nome do bairro, taxa

9. **orders** - Pedidos
   - Cliente, valores, status, tipo entrega

10. **order_items** - Itens dos pedidos
    - Produtos, quantidades, customizações

## 🔐 Sistema de Autenticação

### Roles e Permissões:

1. **super_admin**
   - Acesso total ao sistema
   - Gerencia todos os restaurantes
   - Rota: `/super-admin`

2. **restaurant_admin**
   - Gerencia seu restaurante
   - Dashboard, pedidos, cardápio, configurações
   - Rotas: `/admin/*`

3. **kitchen**
   - Apenas visualiza pedidos em preparo
   - Interface KDS otimizada
   - Rota: `/kitchen`

### Fluxo de Autenticação:

```
1. Usuário faz login
2. Sistema busca role no Supabase
3. Redireciona para painel apropriado
4. Componentes ProtectedRoute validam acesso
```

## 🔄 Fluxo de Pedidos

### 1. Cliente (Cardápio Digital)
```
Navegar produtos
  ↓
Adicionar ao carrinho
  ↓
Checkout (dados + pagamento)
  ↓
Salvar no Supabase (status: pending)
  ↓
Redirecionar para WhatsApp
```

### 2. Recepcionista (Admin)
```
Pedido chega (status: pending)
  ↓
Visualiza no Kanban
  ↓
Confirma pagamento (opcional)
  ↓
Envia para cozinha (status: preparing)
```

### 3. Cozinha (KDS)
```
Pedido aparece automaticamente
  ↓
Prepara o pedido
  ↓
Clica "PRONTO" (status: ready)
```

### 4. Recepcionista (Admin)
```
Pedido volta ao Kanban (coluna "Pronto")
  ↓
"Saiu para Entrega" (status: delivering)
  ↓
"Concluir" (status: completed)
```

## 🎨 Sistema de Estilização

### Tailwind CSS
- Utility-first CSS framework
- Responsivo por padrão
- Dark mode suportado

### Shadcn/UI
- Componentes acessíveis (Radix UI)
- Customizáveis via Tailwind
- Copy-paste friendly

### Tema de Cores
```css
--primary: Cor principal (botões, links)
--secondary: Cor secundária
--accent: Cor de destaque
--muted: Texto secundário
--destructive: Ações destrutivas
```

## 🚀 Performance

### Otimizações Implementadas:

1. **Code Splitting** (React Router)
   - Carrega apenas rotas necessárias

2. **Lazy Loading** de imagens
   - Melhora tempo de carregamento

3. **Estado Persistente** (Zustand + localStorage)
   - Carrinho persiste entre sessões

4. **Realtime Eficiente** (Supabase)
   - Apenas subscrições necessárias

5. **Índices no Banco**
   - Queries otimizadas

## 📱 Responsividade

### Breakpoints:
```
sm: 640px   - Smartphones landscape
md: 768px   - Tablets
lg: 1024px  - Laptops
xl: 1280px  - Desktops
2xl: 1400px - Large screens
```

### Layouts:
- Mobile-first approach
- Sidebar colapsável no admin
- Cards reorganizados em grid responsivo
- KDS otimizado para tablets

## 🧪 Próximas Melhorias Sugeridas

1. [ ] Sistema de notificações push
2. [ ] Relatórios em PDF
3. [ ] Integração com pagamentos (Stripe/Mercado Pago)
4. [ ] App mobile nativo (React Native)
5. [ ] Sistema de cupons/promoções
6. [ ] Programa de fidelidade
7. [ ] Multi-idioma (i18n)
8. [ ] Modo escuro completo
9. [ ] PWA (Progressive Web App)
10. [ ] Analytics avançado

## 📚 Tecnologias e Versões

```json
{
  "react": "^18.2.0",
  "typescript": "^5.2.2",
  "vite": "^5.1.4",
  "tailwindcss": "^3.4.1",
  "@supabase/supabase-js": "^2.39.7",
  "zustand": "^4.5.0",
  "react-router-dom": "^6.22.0",
  "recharts": "^2.12.0",
  "date-fns": "^3.3.1",
  "lucide-react": "^0.335"
}
```

## 🤝 Contribuindo

Para contribuir com o projeto:

1. Fork o repositório
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

MIT License - Sinta-se livre para usar este projeto!
