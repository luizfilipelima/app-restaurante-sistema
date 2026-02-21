# ARCHITECTURE.md — Fonte da Verdade Técnica
### Sistema `app.quiero.food` — SaaS de Gestão Gastronômica

> **Última atualização:** 21/02/2026  
> **Propósito:** Este documento descreve toda a arquitetura do sistema. Ao lê-lo, qualquer desenvolvedor deve entender como o sistema funciona sem precisar ler todo o código-fonte.

---

## Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Tech Stack](#2-tech-stack)
3. [Estrutura de Pastas e Componentes](#3-estrutura-de-pastas-e-componentes)
4. [Arquitetura Multi-Tenant e Roteamento](#4-arquitetura-multi-tenant-e-roteamento)
5. [Fluxos de Dados Críticos](#5-fluxos-de-dados-críticos)
6. [Estratégia de SaaS Tiers (Planos)](#6-estratégia-de-saas-tiers-planos)
7. [RBAC — Controle de Acesso por Cargo](#7-rbac--controle-de-acesso-por-cargo)
8. [Princípios de UI/UX](#8-princípios-de-uiux)
9. [Esquema do Banco de Dados (Destaques)](#9-esquema-do-banco-de-dados-destaques)
10. [Internacionalização (i18n)](#10-internacionalização-i18n)
11. [Estratégia de Performance](#11-estratégia-de-performance)
12. [Estado Global (State Management)](#12-estado-global-state-management)
13. [Segurança (RLS e Autenticação)](#13-segurança-rls-e-autenticação)
14. [Testes E2E e Monitoramento Sintético](#14-testes-e2e-e-monitoramento-sintético)

---

## 1. Visão Geral do Sistema

O **app.quiero.food** é um SaaS de gestão gastronômica focado na **Tríplice Fronteira** (Brasil, Paraguai, Argentina). A plataforma permite que restaurantes criem cardápios digitais, recebam pedidos e gerenciem operações completas — delivery, mesas, buffet, cozinha, fidelidade e analytics.

### Características Centrais

| Característica | Detalhe |
|---|---|
| **Multimoeda** | BRL (Real), PYG (Guaraní), ARS (Peso Argentino), USD |
| **Multi-idioma** | Português (padrão) e Espanhol |
| **Multi-tenant** | Cada restaurante é um tenant isolado por `restaurant_id` via RLS |
| **Multi-canal** | Delivery, Retirada no local, Mesa (QR Code), Buffet |
| **Offline-first** | Módulo Buffet funciona sem internet via IndexedDB |

### Contextos de Uso

```
quiero.food              → Landing page pública do SaaS
app.quiero.food          → Painel administrativo (todos os restaurantes)
{slug}.quiero.food       → Cardápio público do restaurante (ex: pizzaria.quiero.food)
kds.quiero.food          → Display de Cozinha (KDS) em tempo real
```

---

## 2. Tech Stack

### Frontend

| Tecnologia | Versão | Função |
|---|---|---|
| **React** | 18.2 | Framework principal de UI |
| **TypeScript** | 5.2 | Tipagem estática |
| **Vite** | 5.1 | Build tool e dev server |
| **Tailwind CSS** | 3.4 | Estilização utilitária |
| **Shadcn/UI** + Radix UI | — | Design System base (componentes acessíveis) |
| **React Router DOM** | 6.22 | Roteamento SPA |
| **Zustand** | 4.5 | Estado global (auth, carrinho, restaurante) |
| **TanStack Query** | 5.90 | Cache e sincronização de dados do servidor |
| **Framer Motion** | 12 | Animações (lazy loaded) |
| **i18next** | 25 | Internacionalização |
| **Recharts** | 2.12 | Gráficos do dashboard (chunk separado) |
| **Dexie** | 4.3 | IndexedDB para operação offline (buffet) |
| **Leaflet** | 1.9 | Mapa de endereço no checkout (lazy loaded) |
| **DnD Kit** | — | Drag & drop no cardápio admin |
| **XLSX** | 0.18 | Exportação de relatórios (chunk separado) |

### Backend / BaaS

| Tecnologia | Função |
|---|---|
| **Supabase Auth** | Autenticação (email/senha, JWT, sessões multi-tab) |
| **PostgreSQL** (Supabase) | Banco de dados relacional com RLS por tenant |
| **Supabase Realtime** | Atualizações em tempo real (pedidos, KDS) |
| **Supabase Edge Functions** | Lógica serverless em Deno (TypeScript) |
| **Supabase Storage** | Upload de imagens de produtos e logos (convertidas para WebP) |

---

## 3. Estrutura de Pastas e Componentes

```
src/
├── components/
│   ├── ui/                  # Design System: button, card, dialog, input, badge,
│   │                        # select, tabs, toast, skeleton, status-badge, etc.
│   │                        # (base Shadcn/UI + Radix UI)
│   ├── admin/               # Componentes do painel admin:
│   │                        # AdminLayout, CategoryManager, ProductRow, ProductAddonsSection,
│   │                        # DashboardHeatmapWidget, MenuMatrixBCG, ChurnRecoveryList,
│   │                        # WhatsAppTemplatesModal, DashboardPrintReport
│   ├── public/              # Componentes do cardápio público:
│   │                        # ProductCard, ProductCardBeverage (layout horizontal),
│   │                        # ProductCardViewOnly (suporta grid/beverage), CartDrawer,
│   │                        # PizzaModal, MarmitaModal, ProductAddonModal,
│   │                        # MapAddressPicker, LoyaltyCard, InitialSplashScreen
│   ├── auth/                # RoleProtectedRoute, FeatureGuard, UpgradeBanner
│   ├── kitchen/             # (lógica interna nas páginas kitchen/)
│   ├── orders/              # CompletedOrdersView
│   ├── receipt/             # OrderReceipt (impressão térmica)
│   ├── landing-page/        # Hero, Features, Pricing, FAQ, Testimonials
│   └── super-admin/         # SuperAdminLayout
│
├── pages/
│   ├── public/              # Menu, MenuViewOnly, MenuTable, Checkout,
│   │                        # OrderTracking, OrderConfirmation, LinkBio, VirtualComanda
│   ├── admin/               # Dashboard, Orders, Menu, Settings, DeliveryZones,
│   │                        # Couriers, Buffet, Cashier, Tables, Offers,
│   │                        # Inventory, ProductsInventory, UpgradePage
│   ├── kitchen/             # KitchenDisplay (KDS), ExpoScreen
│   ├── super-admin/         # Dashboard, Restaurants, Plans, SaasMetrics,
│   │                        # LandingPageEditor, RestaurantDetails
│   ├── auth/                # LoginPage, Register, UnauthorizedPage
│   └── landing/             # LandingPage, QuieroFoodLanding
│
├── hooks/
│   ├── queries/             # Hooks TanStack Query (dados do servidor):
│   │                        # useRestaurantMenuData → RPC get_restaurant_menu
│   │                        #   prefetchRestaurantMenu(), keepPreviousData
│   │                        # useOrders, useCompletedOrders
│   │                        # useDashboardStats, useDashboardKPIs, useDashboardAnalytics
│   │                        # useProductAddons, useProductAddonsMap, useSaveProductAddons,
│   │                        # useProductOffers, useProductUpsells
│   │                        # useCouriers, useLoyaltyProgram, useTables
│   │                        # useDeliveryZones, usePrintSettings
│   │                        # useSuperAdminExchangeRates (câmbio para métricas em BRL)
│   │                        # useFeatureAccess, useSubscriptionManager
│   ├── useOfflineSync.ts    # Sincronização offline (buffet via IndexedDB)
│   ├── usePrinter.ts        # Impressão térmica (58mm / 80mm)
│   ├── useSessionManager.ts # Sessões multi-tab (Supabase Auth)
│   ├── useComandas.ts       # Comandas virtuais (buffet)
│   ├── useUserRole.ts       # Verificação de role do usuário
│   └── useFeatureAccess.ts  # Verificação de feature flags por plano
│
├── store/                   # Estado global (Zustand):
│   ├── authStore.ts         # user, session, signIn/Out, hasRole()
│   ├── cartStore.ts         # items, restaurantId, orderNotes, persistido em localStorage
│   ├── restaurantStore.ts   # Dados do restaurante em cache
│   ├── adminLanguageStore.ts
│   └── tableOrderStore.ts
│
├── contexts/
│   ├── AdminRestaurantContext.tsx  # restaurantId, restaurant, isSuperAdminView,
│   │                               # basePath — distribuído para toda a árvore admin
│   └── MainLandingCtx.ts
│
├── lib/
│   ├── supabase.ts          # Cliente Supabase configurado
│   ├── i18n.ts              # Configuração i18next (pt/es, sessionStorage, hasStoredMenuLanguage)
│   ├── subdomain.ts         # Detecção de subdomínio para multi-tenant
│   ├── invalidatePublicCache.ts  # Invalidação TanStack Query (Admin → Cardápio)
│   ├── queryClient.ts       # TanStack Query client (staleTime, retry)
│   ├── offline-db.ts        # Schema IndexedDB (Dexie) para buffet offline
│   ├── whatsappTemplates.ts # Templates de mensagens WhatsApp (pt/es)
│   ├── priceHelper.ts       # Formatação de preços por moeda
│   ├── imageUpload.ts       # Upload e conversão para WebP
│   ├── productCardLayout.ts # shouldUseBeverageCard(product) — layout por produto no cardápio
│   ├── lazyWithRetry.ts     # Code splitting com retry automático
│   └── utils.ts             # formatCurrency, generateSlug, getCardapioPublicUrl, etc.
│
├── types/
│   └── index.ts             # Interfaces principais: User, Restaurant, Product (card_layout),
│                            # Order, Category, Courier, LoyaltyProgram, etc.
│
├── locales/
│   ├── pt.json              # Traduções em Português
│   └── es.json              # Traduções em Espanhol
│
├── i18n/
│   └── adminTranslations.ts # Traduções específicas do painel admin
│
└── layouts/
    └── StoreLayout.tsx      # Layout cardápio público: prefetch menu, InitialSplashScreen

supabase/
├── db/
│   └── migrations/          # Migrações SQL (histórico completo)
└── functions/
    ├── create-restaurant-user/   # Criar usuário com cargo específico (admin)
    └── get-or-create-my-profile/ # Bootstrap do perfil pós-login
```

---

## 4. Arquitetura Multi-Tenant e Roteamento

### Detecção de Contexto por Subdomínio

O arquivo `src/lib/subdomain.ts` é o ponto de entrada. Ao carregar o app, ele lê `window.location.hostname` e decide qual contexto renderizar:

```
Hostname                    → Contexto
─────────────────────────────────────────────────────
quiero.food                 → Landing Page pública
www.quiero.food             → Landing Page pública
app.quiero.food             → Painel Administrativo
admin.quiero.food           → Painel Administrativo (alias)
kds.quiero.food             → Display de Cozinha (KDS)
{qualquer-outro}.quiero.food → Cardápio do restaurante (slug = subdomínio)
localhost                   → Desenvolvimento (path-based routing)
app.localhost / admin.localhost → Admin em dev; preview do cardápio abre em localhost/{slug}
```

### URL Pública do Cardápio (`getCardapioPublicUrl`)

```
Produção:    https://{slug}.quiero.food
Dev path-based: origin/{slug}
Dev com subdomínio admin (app.localhost): localhost/{slug} — layout path-based correto
```

### Isolamento de Dados (Multi-tenant)

Cada restaurante é isolado no banco via `restaurant_id` (UUID). O RLS do PostgreSQL garante que nenhuma query de um tenant acesse dados de outro:

```
Usuário autenticado (admin)
  └─ auth.uid() → users.id → users.restaurant_id
       └─ AdminRestaurantContext.restaurantId
            └─ todas as queries usam este ID como filtro

Visitante anônimo (cardápio público)
  └─ slug do subdomínio → restaurants.slug → restaurants.id
       └─ RPC get_restaurant_menu(slug) → dados do tenant
```

---

## 5. Fluxos de Dados Críticos

### 5.1 Ciclo Completo do Pedido

#### Delivery (WhatsApp + Rastreamento)

```
1. Cliente visita {slug}.quiero.food
   └─ InitialSplashScreen exibido imediatamente (CSS puro, sem Framer)
   └─ StoreLayout detecta subdomínio, busca restaurant por slug + prefetch do menu em paralelo
   └─ RPC get_restaurant_menu(slug) → 1 única chamada ao banco

2. Cliente monta o carrinho
   └─ cartStore (Zustand) persiste em localStorage (items, orderNotes)
   └─ Ao carregar o cardápio: removeInactiveProducts() remove itens cujos produtos
      foram desativados/deletados pelo Admin (evita erro em place_order)
   └─ Suporta: produtos simples, pizza (tamanho/sabores/massa/borda),
      marmita (tamanho/proteínas/acompanhamentos), combos, adicionais (ProductAddonModal)
   └─ CartDrawer: observações do pedido (orderNotes) opcional, sincronizado com Checkout

3. Checkout (src/pages/public/Checkout.tsx)
   └─ Cliente informa: nome, endereço (complemento/referência obrigatório), zona de entrega, forma de pagamento
   └─ Formas de pagamento: dinheiro, cartão, PIX, transferência bancária (PYG/ARS — exibe dados da conta)
   └─ Para transferência PYG/ARS: snapshot bank_account gravado em payment_bank_account no pedido
   └─ Zonas de entrega: modelo por raio (center_lat, center_lng, radius_meters)
   └─ MapAddressPicker (Leaflet, lazy loaded): TileLayer CartoDB Light; MapUpdater (useMap + flyTo)
      recentraliza ao trocar zona; Leaflet CSS em index.css (evita tiles "laranja"); ícones via
      L.Icon.Default.mergeOptions; Select com value correta evita travamento
   └─ RPC place_order() é chamada com todos os dados, incluindo geo_lat/geo_lng
      e customer_language (idioma da jornada para templates WhatsApp)
   └─ Pedido criado no banco com status 'pending'

4. Despacho para o restaurante (Checkout.tsx)
   └─ Janela aberta sincronamente antes do await (window.open vazio na mesma call stack
      da gesture do usuário) — necessário porque Safari iOS e Chrome Android bloqueiam
      window.open chamado em contextos assíncronos
   └─ Após place_order() retornar: janela pré-aberta recebe location.href com link
      gerado via whatsappTemplates.ts (idioma = getStoredMenuLanguage()) → wa.me/...
   └─ Navegação na aba atual para /{slug}/order-confirmed (tela "Pedido Recebido")
      via React Router (client-side, sem hard-reload)
   └─ Em caso de erro: janela em branco é fechada automaticamente
   └─ Rastreamento: /{slug}/track/:orderId (OrderTracking.tsx) — acessível quando
      o cliente receber o link por WhatsApp ou navegar manualmente

5. Rastreamento em tempo real (OrderTracking.tsx)
   └─ RPC get_order_tracking(order_id) carrega estado inicial (pedido, restaurante, entregador)
   └─ Retorna payment_bank_account (snapshot do pedido) e restaurant.bank_account — exibidos quando
      pagamento for transferência bancária (PYG/ARS), para o cliente ver os dados ao confirmar
   └─ Supabase Realtime subscription em orders WHERE id = order_id
   └─ A tela atualiza automaticamente quando o restaurante muda o status

6. Restaurante gerencia pelo Kanban (Orders.tsx)
   └─ Colunas: Pendente → Em Preparo → Pronto → Em Entrega → Concluído
   └─ Ao mover para "Em Entrega": atribuir entregador (Couriers)
   └─ WhatsApp "saiu para entrega" e "pedido pronto para retirada" usam
      order.customer_language ?? restaurant.language (templates pt/es)
   └─ Supabase Realtime publica a mudança → KDS e OrderTracking atualizam
```

### 5.1.1 Invalidação de Cache (Admin → Cardápio)

Quando o Admin altera Produto, Categoria, Zona de Entrega ou Configuração do restaurante,
o sistema invalida os caches do TanStack Query do cardápio público via `invalidatePublicMenuCache()`:

```
Admin altera: Menu (produto), Settings, DeliveryZones, Offers
  └─ invalidatePublicMenuCache(queryClient, restaurantSlug)
  └─ Queries invalidadas: restaurant-menu, active-offers, deliveryZones, bio-restaurant
  └─ RPC get_restaurant_menu(slug) reflete alterações imediatamente no cardápio
```

#### Mesa (Table Mode)

```
1. Cliente escaneia QR Code da mesa
   └─ Rota: /{slug}/cardapio/{tableNumber}
   └─ MenuTable.tsx valida existência da mesa no banco

2. Pedido registrado diretamente no banco (sem WhatsApp)
   └─ order_source = 'table', table_number = {número}

3. Garçom pode ser chamado digitalmente
   └─ Registra WaiterCall no Supabase
   └─ Painel admin exibe chamadas pendentes em Tables.tsx
```

### 5.2 Logística de Impressão Dual (Cozinha / Bar)

A impressão é dividida em dois destinos físicos, configurável por **categoria** e por **produto individual**:

```
Pedido recebido
  └─ usePrinter.ts lê print_destination de cada item
       └─ category.print_destination = 'kitchen' | 'bar' | 'both'
       └─ product.print_destination (override individual)

  → Cupom "Cozinha Central" (kitchen)
     Itens: pratos principais, grelhados, frituras
     Destino: impressora da cozinha

  → Cupom "Garçom / Bar" (bar)
     Itens: bebidas, sobremesas, petiscos do bar
     Destino: impressora do balcão/bar

Configuração no banco:
  migrations/20260253_category_print_destination.sql
  migrations/20260263_products_print_destination.sql
  migrations/20260245_print_settings_by_sector.sql
```

**Configuração de papel:** 58mm ou 80mm, definido por restaurante em `print_settings`.

### 5.3 Fidelidade por Telefone (Sem Login)

O programa de fidelidade não exige cadastro ou login — funciona apenas pelo número de telefone (WhatsApp):

```
Cliente faz pedido
  └─ informa telefone no Checkout
  └─ place_order() verifica/cria registro em loyalty_program
     WHERE restaurant_id = ? AND customer_phone = ?

Acumulação de pontos
  └─ A cada pedido: loyalty_program.total_orders += 1
                    loyalty_program.total_spent += valor
  └─ Regra configurável por restaurante (ex: 10 pedidos = 1 recompensa)

Resgate
  └─ Cliente acessa LoyaltyCard.tsx com seu telefone
  └─ Se atingiu a meta: campo loyalty_redeemed = true no pedido
  └─ place_order() registra o resgate e reseta o contador

Banco:
  migrations/20260254_loyalty_program.sql
  migrations/20260262_place_order_loyalty.sql
```

### 5.4 Módulo Buffet (Offline-First)

```
Operador usa Buffet.tsx com leitor de código de barras
  └─ F2: nova comanda | F8: fechar comanda | ESC: limpar

Estado local: IndexedDB (Dexie) via offline-db.ts
  └─ Comandas salvas localmente primeiro
  └─ useOfflineSync.ts monitora navigator.onLine
  └─ Ao reconectar: sincroniza com Supabase automaticamente

Fluxo de pesagem:
  1. Operador escaneia SKU do produto
  2. Informa peso em gramas
  3. Sistema calcula: total = (peso / 100) * preço_por_100g
  4. Item adicionado à comanda ativa
```

### 5.5 Câmbio Inteligente (Multimoeda)

```
Restaurante configura moeda base (BRL ou PYG)
  └─ migrations/20260268_cambio_inteligente.sql

No Checkout e cardápio:
  └─ priceHelper.ts formata o preço na moeda do restaurante
  └─ Conversão em tempo real se o cliente selecionar outra moeda
  └─ Moedas suportadas: BRL, PYG, ARS, USD
```

### 5.6 Super-Admin: GMV e Configuração de Câmbio

```
Dashboard do Super-Admin (useSuperAdminRestaurants):
  └─ revenueByCurrency: Record<string, number> — GMV agrupado por moeda
  └─ ordersByCurrency: Record<string, number> — pedidos por moeda
  └─ useSuperAdminExchangeRates, useUpdateSuperAdminExchangeRates: cotações (pyg_per_brl, ars_per_brl) para conversão em BRL
  └─ KPIs GMV e Ticket médio: exibidos em Real (BRL) após conversão com câmbio configurado
  └─ Cards de restaurantes: faturamento na moeda nativa de cada restaurante (BRL, PYG, ARS)
  └─ Tabela super_admin_settings (migration 20260291): armazena exchange_rates
```

### 5.7 Exibição de Produtos no Cardápio (card_layout)

Cada produto pode definir como aparece no cardápio público:

```
Admin (Central do Cardápio) cria/edita produto
  └─ Campo "Exibição no cardápio": Card vertical (grid) ou Card horizontal (beverage)
  └─ products.card_layout = 'grid' | 'beverage' (migration 20260295)

Cardápio público (Menu.tsx, MenuViewOnly.tsx)
  └─ productCardLayout.ts: shouldUseBeverageCard(product)
  └─ Prioridade: product.card_layout → fallback por categoria (Bebidas, Drinks)
  └─ grid: ProductCard / ProductCardViewOnly (layout vertical, foto em destaque)
  └─ beverage: ProductCardBeverage / ProductCardViewOnly horizontal (lista compacta)
  └─ Container: flex col quando todos beverage; grid caso contrário
```

**Arquivos:** `src/lib/productCardLayout.ts`, `src/components/public/ProductCardBeverage.tsx`, `src/components/public/ProductCardViewOnly.tsx` (prop `layout`), Admin Menu form.

---

## 6. Estratégia de SaaS Tiers (Planos)

### Os Três Planos

| Plano | Tier | Público-Alvo | Posicionamento |
|---|---|---|---|
| **Core** | Básico | Primeiro contato, restaurante pequeno | Entrada gratuita ou baixo custo |
| **Standard** | Intermediário | Restaurante em crescimento | Plano mais popular |
| **Enterprise** | Avançado | Redes de restaurantes, alto volume | Alto valor, contrato anual |

### Resumo das Features por Plano

| Feature | Core | Standard | Enterprise |
|---|:---:|:---:|:---:|
| Cardápio interativo público | ✅ | ✅ | ✅ |
| Receber pedidos (Kanban) | ✅ | ✅ | ✅ |
| Display de Cozinha (KDS) | ✅ | ✅ | ✅ |
| KPIs básicos de dashboard | ✅ | ✅ | ✅ |
| CRUD de produtos e categorias | ✅ | ✅ | ✅ |
| Configurações básicas | ✅ | ✅ | ✅ |
| — | — | — | — |
| Pedidos de mesa + QR por mesa | ❌ | ✅ | ✅ |
| Chamada de garçom digital | ❌ | ✅ | ✅ |
| Delivery com zonas de entrega | ❌ | ✅ | ✅ |
| Gestão de entregadores | ❌ | ✅ | ✅ |
| Notificação WhatsApp | ❌ | ✅ | ✅ |
| Impressão térmica automática | ❌ | ✅ | ✅ |
| Configuração de Pizza / Marmita | ❌ | ✅ | ✅ |
| Exportação de pedidos (CSV) | ❌ | ✅ | ✅ |
| Gráficos de faturamento e analytics | ❌ | ✅ | ✅ |
| Personalização de marca (logo, cores) | ❌ | ✅ | ✅ |
| Multi-idioma / Multi-moeda | ❌ | ✅ | ✅ |
| — | — | — | — |
| BI: Análise de Retenção | ❌ | ❌ | ✅ |
| BI: Risco de Churn + WhatsApp | ❌ | ❌ | ✅ |
| BI: Matriz BCG de Produtos | ❌ | ❌ | ✅ |
| Módulo Buffet completo (offline) | ❌ | ❌ | ✅ |
| Inventário com CMV e margens | ❌ | ❌ | ✅ |
| Importação/Exportação de produtos (CSV) | ❌ | ❌ | ✅ |
| Filtros avançados de período (365d/máx) | ❌ | ❌ | ✅ |
| RBAC granular (múltiplos usuários) | ❌ | ❌ | ✅ |

### Implementação Técnica dos Feature Flags

```
Tabelas no banco (migrations/20260219_init_access_control.sql):
  ├── subscription_plans      → core, standard, enterprise
  ├── features                → catálogo de flags (ex: 'feature_bcg_matrix')
  ├── plan_features           → join plano ↔ feature (quais planos incluem quais flags)
  ├── restaurant_subscriptions → qual plano cada restaurante contratou
  └── restaurant_feature_overrides → overrides individuais (add-ons)

Frontend:
  ├── useFeatureAccess.ts     → hook que verifica se a feature está ativa
  ├── FeatureGuard.tsx        → componente que bloqueia rotas por feature
  └── UpgradeBanner.tsx       → exibe banner de upgrade quando feature bloqueada

Fluxo de verificação:
  1. App inicializa → authStore carrega user.restaurant_id
  2. AdminRestaurantContext distribui restaurantId
  3. useFeatureAccess(flag) consulta via TanStack Query
     (staleTime alto — dados raramente mudam)
  4. Componente renderiza ou redireciona para /upgrade
```

---

## 7. RBAC — Controle de Acesso por Cargo

### Roles Disponíveis

| Role | Nível | Descrição |
|---|---|---|
| `super_admin` | SaaS | Controla toda a plataforma, acesso irrestrito |
| `restaurant_admin` | Restaurante | Dono — acesso total ao seu restaurante |
| `manager` | Restaurante | Gerente operacional (sem financeiro sensível) |
| `waiter` | Restaurante | Garçom — pedidos e mesas |
| `kitchen` | Restaurante | Cozinheiro — somente KDS |
| `cashier` | Restaurante | Operador de caixa / buffet |

### Mecanismo de Verificação

```
Frontend:
  ├── authStore.hasRole(role)   → verificação síncrona no client
  ├── RoleProtectedRoute        → bloqueia rotas por role
  └── useUserRole()             → hook para acesso ao role atual

Banco (RLS):
  ├── restaurant_user_roles     → tabela de vínculos user ↔ restaurante ↔ role
  ├── auth.uid()                → identifica o usuário em todas as policies
  └── Cada tabela tem RLS que verifica o role via restaurant_user_roles
```

### Matriz de Permissões Resumida

| Módulo | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard / Analytics | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pedidos — Kanban | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Cancelar pedido | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar Cardápio | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buffet / Comandas | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Mesas / Chamada garçom | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Display de Cozinha (KDS) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Configurações (dados básicos) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| BI Avançado (Churn, BCG) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Resetar dados | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 8. Princípios de UI/UX

### Design System

- **Base:** Shadcn/UI (componentes Radix UI sem estilo opinionado) + Tailwind CSS
- **Localização:** `src/components/ui/` — fonte única de componentes base
- **Tokens de cor:** Variáveis CSS HSL (`--primary`, `--secondary`, `--muted`, `--destructive`, etc.)
- **Dark mode:** Suportado via classe `.dark` (configurado no `tailwind.config.js`)
- **Personalização por restaurante:** Cor primária e secundária do cardápio público, configurável em Settings

### Componentização

```
src/components/ui/       → Átomos: Button, Input, Card, Badge, Dialog, etc.
src/components/admin/    → Moléculas/Organismos admin: AdminLayout, ProductRow, etc.
src/components/public/   → Moléculas/Organismos públicos: ProductCard, CartDrawer, etc.
```

### Experiências Chave

| Tela | Princípio |
|---|---|
| **Cardápio público** | Mobile-first, splash screen inicial (CSS puro), prefetch de dados, exibição configurável por produto (card vertical ou horizontal), sem login necessário |
| **Checkout** | Mapa de zonas (Leaflet + CartoDB), flyTo ao trocar zona, geolocalização opcional, suporte a WhatsApp, PIX e transferência bancária (PYG/ARS) |
| **Kanban de Pedidos** | Atualização em tempo real (Realtime), cores por status, ação em 1 clique |
| **KDS (Cozinha)** | Interface dark otimizada para cozinha, timers visuais, sem distrações |
| **Buffet** | Atalhos de teclado (F2/F8/ESC), funciona offline, scanner de código de barras |
| **Dashboard** | Período filtrável, exportação em CSV/XLSX, Matriz BCG visual |

### Feedback Visual

- **InitialSplashScreen** no cardápio público — tela de carregamento com ícone Quiero.food e animação CSS (splash-breathe); fade-out suave ao carregar dados
- **Skeletons** para estados de carregamento (admin, checkout)
- **Toast** (Sonner) para confirmações e erros
- **Status Badge** com cores semânticas (verde = ativo, vermelho = cancelado, etc.)
- **PageTransition** com Framer Motion entre navegações

---

## 9. Esquema do Banco de Dados (Destaques)

### Tabelas Core

```sql
-- Tenant principal
restaurants (
  id UUID PK,
  slug TEXT UNIQUE,          -- subdomínio do cardápio
  name TEXT,
  whatsapp TEXT,
  currency TEXT,             -- 'BRL' | 'PYG' | 'ARS'
  primary_color TEXT,
  secondary_color TEXT,
  phone_country TEXT,        -- 'BR' | 'PY'
  is_active BOOLEAN,
  pix_key TEXT,
  pix_key_type TEXT,
  bank_account JSONB,        -- dados bancários PYG/ARS: {pyg: {bank_name, holder, alias}, ars: {...}}
  ...
)

-- Produtos
products (
  id UUID PK,
  restaurant_id UUID FK,
  name TEXT,
  price NUMERIC,
  price_sale NUMERIC,        -- preço promocional
  category TEXT,
  order_index INT,
  is_active BOOLEAN,
  is_combo BOOLEAN,
  product_type TEXT,         -- 'simple' | 'pizza' | 'marmita' | 'combo'
  print_destination TEXT,    -- 'kitchen' | 'bar' | 'both'
  card_layout TEXT,          -- 'grid' | 'beverage' — exibição no cardápio (migration 20260295)
  sku TEXT,
  cost_price NUMERIC,        -- para CMV
  ...
)

-- Pedidos
orders (
  id UUID PK,
  restaurant_id UUID FK,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT,               -- 'pending' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled'
  delivery_type TEXT,        -- 'delivery' | 'pickup' | 'table'
  order_source TEXT,         -- 'whatsapp' | 'table' | 'buffet'
  subtotal NUMERIC,
  delivery_fee NUMERIC,
  total NUMERIC,
  payment_method TEXT,
  geo_lat NUMERIC,           -- coordenadas do endereço
  geo_lng NUMERIC,
  courier_id UUID FK,
  loyalty_redeemed BOOLEAN,
  customer_language TEXT,     -- 'pt' | 'es' — idioma da jornada (templates WhatsApp)
  payment_bank_account JSONB, -- snapshot da conta bancária para transferência PYG/ARS
  table_number TEXT,
  ...
)

-- Itens do pedido
order_items (
  id UUID PK,
  order_id UUID FK,
  product_id UUID FK,
  quantity INT,
  unit_price NUMERIC,
  pizza_size TEXT,
  pizza_flavors JSONB,
  pizza_dough TEXT,
  pizza_edge TEXT,
  marmita_size TEXT,
  marmita_proteins JSONB,
  marmita_sides JSONB,
  addons JSONB,              -- adicionais selecionados
  notes TEXT
)
```

### Tabelas de Cardápio Especializado

```sql
-- Pizza
pizza_sizes (id, restaurant_id, name, multiplier, order_index)
pizza_flavors (id, restaurant_id, name, price, is_active)
pizza_doughs (id, restaurant_id, name, price, is_active)
pizza_edges (id, restaurant_id, name, price, is_active)

-- Marmita
marmita_sizes (id, restaurant_id, name, weight_g, base_price, is_active, order_index)
marmita_proteins (id, restaurant_id, name, extra_price, is_active)
marmita_sides (id, restaurant_id, name, category, is_active)

-- Combos
product_combo_items (id, combo_product_id, product_id, quantity, sort_order)

-- Adicionais (grupos e itens)
product_addon_groups (id, product_id, name, order_index)
product_addon_items (id, addon_group_id, name, price, order_index)
```

### Tabelas de Operação

```sql
categories (id, restaurant_id, name, order_index, print_destination)
subcategories (id, restaurant_id, category_id, name, order_index)
delivery_zones (id, restaurant_id, name, fee, is_active,
  center_lat, center_lng, radius_meters)   -- modelo por raio (migration 20260290)
couriers (id, restaurant_id, name, phone, vehicle_plate, status, phone_country)
tables (id, restaurant_id, table_number)
waiter_calls (id, restaurant_id, table_number, status, created_at)
print_settings (id, restaurant_id, paper_width, auto_print, kitchen_printer, bar_printer)

-- Ofertas (migration 20260274, 20260292)
product_offers (id, restaurant_id, product_id, offer_price, original_price,
  starts_at, ends_at, label, is_active, always_active, sort_order)
  -- always_active=true: oferta visível no cardápio independente de período
```

### Tabelas de Analytics e Fidelidade

```sql
loyalty_program (
  id UUID PK,
  restaurant_id UUID FK,
  customer_phone TEXT,
  customer_name TEXT,
  total_orders INT,
  total_spent NUMERIC,
  points INT,
  last_order_at TIMESTAMPTZ
)

-- Ingredientes e CMV
ingredients (id, restaurant_id, name, unit, cost_per_unit)
product_ingredients (id, product_id, ingredient_id, quantity)
ingredient_stock (id, ingredient_id, quantity)
ingredient_movements (id, ingredient_id, quantity_delta, reason, order_id)
```

### Tabelas SaaS (Multi-tenant Control)

```sql
super_admin_settings (key TEXT PK, value JSONB, updated_at)  -- câmbio para métricas BRL (20260291)
subscription_plans (id, name, label, price_brl)
features (id, flag, label, min_plan)          -- catálogo global de features
plan_features (plan_id, feature_id)           -- quais features cada plano inclui
restaurant_subscriptions (restaurant_id, plan_id, status, expires_at)
restaurant_feature_overrides (restaurant_id, feature_flag, is_enabled)

-- RBAC
restaurant_user_roles (
  id UUID PK,
  restaurant_id UUID FK,
  user_id UUID FK,
  role restaurant_role_type   -- owner | manager | waiter | kitchen | cashier
)
```

### RPCs Principais

| RPC | Propósito |
|---|---|
| `get_restaurant_menu(slug)` | Retorna todo o cardápio em 1 chamada (restaurante, produtos, categorias, pizza, marmita, combos, productAddonsMap) |
| `place_order(...)` | Cria pedido, atualiza fidelidade, valida estoque, grava customer_language, payment_bank_account |
| `get_order_tracking(order_id)` | Rastreamento público sem autenticação. Retorna pedido (incl. payment_bank_account), restaurante (pix_key, bank_account), entregador |
| `get_dashboard_kpis(...)` | KPIs do dashboard com filtros de período e canal |
| `get_advanced_dashboard_stats(...)` | Analytics avançados (retenção, churn, BCG) |
| `setup_new_tenant(...)` | Cria restaurante, usuário admin e dados iniciais |

---

## 10. Internacionalização (i18n)

### Configuração

- **Biblioteca:** i18next + react-i18next
- **Arquivo de configuração:** `src/lib/i18n.ts`
- **Idiomas suportados:** Português (`pt`) — padrão, Espanhol (`es`)
- **Persistência:** `sessionStorage` com chave `menu_lang` (por aba, não global)
- **Helpers:** `hasStoredMenuLanguage()`, `getStoredMenuLanguage()`, `setStoredMenuLanguage()`
- **Traduções públicas:** `src/locales/pt.json` e `src/locales/es.json`
- **Traduções admin:** `src/i18n/adminTranslations.ts` (objeto TypeScript)

### Escopo de Tradução

```
Cardápio público ({slug}.quiero.food):
  └─ Interface completa traduzida (pt/es)
  └─ Botão de troca de idioma visível no cardápio
  └─ Hook: useTranslation() do react-i18next

Painel administrativo (app.quiero.food):
  └─ Parcialmente traduzido via adminTranslations.ts
  └─ Hook: useAdminTranslation()
  └─ Store: adminLanguageStore (Zustand)
```

### Fluxo de Seleção de Idioma

```
1. Cliente abre o cardápio
2. hasStoredMenuLanguage() verifica se sessionStorage['menu_lang'] já foi definido
3. Se não existir: usa idioma padrão do restaurante (restaurant.language)
4. Cliente pode trocar manualmente via botão no cardápio
5. O idioma é preservado em toda a jornada: Menu → Checkout → OrderConfirmation → OrderTracking
6. StoreLayout, Menu, Checkout e OrderTracking respeitam a escolha (não sobrescrevem)
```

### WhatsApp e Idioma do Cliente

```
Templates (whatsappTemplates.ts):
  └─ DEFAULT_TEMPLATES (pt) e DEFAULT_TEMPLATES_ES (es)
  └─ getTemplate(key, templates, lang) retorna template no idioma correto

Checkout (new_order):
  └─ Usa getStoredMenuLanguage() ao gerar mensagem

Admin Orders (delivery_notification, courier_dispatch, pronto para retirada):
  └─ Usa order.customer_language ?? restaurant.language
  └─ customer_language gravado no pedido via place_order (migration 20260289)
```

---

## 11. Estratégia de Performance

### Code Splitting

Todas as páginas usam `lazyWithRetry()` para carregamento sob demanda:

```
Bundle inicial (cardápio): ~200 KB (61 KB gzip)
  └─ Antes das otimizações: ~605 KB (166 KB gzip)

Chunks separados (Vite manualChunks):
  ├── vendor-supabase     → Supabase JS client
  ├── vendor-lucide       → Ícones (tree-shaking preservado)
  ├── vendor-recharts     → Gráficos (carrega só no Dashboard admin)
  ├── vendor-xlsx         → Exportação (carrega só ao exportar)
  └── vendor-framer       → Animações (carrega só ao abrir modais)
```

### Carregamento do Cardápio Público

| Técnica | Detalhe |
|---|---|
| **InitialSplashScreen** | Tela de carregamento imediata (CSS puro, sem Framer Motion) |
| **Prefetch no StoreLayout** | `prefetchRestaurantMenu(tenantSlug)` em paralelo com logo/idioma |
| **keepPreviousData** | Dados em cache exibidos durante refetch — sem skeleton ao recarregar |
| **Barra de refresh** | Indicador sutil no topo quando refetch em background |
| **Fade-in** | Transição suave ao exibir conteúdo (animate-in fade-in) |

### Otimizações de Queries

| Problema | Solução |
|---|---|
| 11+ queries paralelas para carregar cardápio | RPC `get_restaurant_menu(slug)` — 1 chamada |
| N+1 queries na RPC (correlated subqueries) | LEFT JOIN e LEFT JOIN LATERAL |
| Supabase reconnect em multi-tab | `useSessionManager.ts` deduplica eventos |
| Re-render de ProductCard a cada mudança de carrinho | `React.memo()` |
| `filteredProducts` calculado em todo render | `useMemo([products, category, query])` |
| Leaflet CSS carregado globalmente | `@import 'leaflet/dist/leaflet.css'` em `index.css` (evita tiles "laranja" com lazy load) |
| Sem preconnect ao Supabase | `<link rel="preconnect">` no `index.html` |

### Indexação no PostgreSQL

```sql
-- Índices em todas as FKs não-indexadas (migration 20260286)
-- Exemplos críticos:
CREATE INDEX ON orders(restaurant_id);
CREATE INDEX ON products(restaurant_id);
CREATE INDEX ON order_items(order_id);
CREATE INDEX ON loyalty_program(restaurant_id, customer_phone);
CREATE INDEX ON restaurant_user_roles(user_id);
```

---

## 12. Estado Global (State Management)

### Zustand Stores

| Store | Conteúdo | Persistência |
|---|---|---|
| `authStore` | `user`, `session`, `loading`, `initialized`, `signIn/Out`, `hasRole()` | Memória |
| `cartStore` | `items[]`, `restaurantId`, `orderNotes`, `addItem/remove/update/clear`, `removeInactiveProducts(activeIds)` | `localStorage` |
| `restaurantStore` | Dados do restaurante em cache | Memória |
| `adminLanguageStore` | Idioma selecionado no admin | Memória |
| `tableOrderStore` | Pedidos de mesa em aberto | Memória |

### TanStack Query (Server State)

Toda comunicação com o Supabase passa pelo TanStack Query (`queryClient.ts`):

```typescript
// Padrão de uso nos hooks de queries:
const { data, isLoading } = useQuery({
  queryKey: ['orders', restaurantId],
  queryFn: () => supabase.from('orders').select('*').eq('restaurant_id', restaurantId),
  staleTime: 30_000,  // 30s para dados que mudam com frequência
});

// Feature flags: staleTime alto (raramente mudam)
const { data: features } = useQuery({
  queryKey: ['features', restaurantId],
  staleTime: Infinity,
});
```

### Contextos React

```
AdminRestaurantContext
  ├── restaurantId     → ID do tenant ativo no painel
  ├── restaurant       → Dados completos do restaurante
  ├── isSuperAdminView → true quando super admin "entrou" em um restaurante
  └── basePath         → Prefixo das rotas admin ('/admin' ou '/super-admin/restaurants/:id')

Hooks derivados:
  ├── useAdminRestaurant()    → { restaurantId, restaurant, isSuperAdminView }
  ├── useAdminRestaurantId()  → string (usado em todas as queries admin)
  ├── useAdminBasePath()      → string (para navegação relativa)
  └── useAdminCurrency()      → 'BRL' | 'PYG' | 'ARS'
```

---

## 13. Segurança (RLS e Autenticação)

### Row Level Security (RLS)

**Todas as tabelas** têm RLS habilitado. As políticas seguem o padrão:

```sql
-- Padrão para leitura de dados do próprio restaurante
CREATE POLICY "Users can read own restaurant data"
ON public.products
FOR SELECT
TO authenticated
USING (
  restaurant_id IN (
    SELECT restaurant_id FROM public.users WHERE id = auth.uid()
    UNION
    SELECT restaurant_id FROM public.restaurant_user_roles WHERE user_id = auth.uid()
  )
);
```

### Otimização Anti-InitPlan

Uma das otimizações críticas de RLS aplicada na `migration 20260285`:

```sql
-- PROBLEMÁTICO (causa re-evaluate por linha):
USING (auth.uid() = user_id)

-- CORRETO (avaliado uma vez por query):
USING ((SELECT auth.uid()) = user_id)
```

### Funções SECURITY DEFINER

Usadas quando clientes anônimos precisam acessar dados de forma segura:

| Função | Por quê SECURITY DEFINER |
|---|---|
| `get_restaurant_menu(slug)` | Cardápio público acessível sem login |
| `get_order_tracking(order_id)` | Rastreamento público sem login (acesso restrito por UUID não-adivinhável) |
| `place_order(...)` | Cliente anônimo pode criar pedido |

### Edge Functions

```
supabase/functions/create-restaurant-user/
  └─ Usa supabaseAdmin (service_role) para criar usuários
  └─ Só executável por super_admin ou owner
  └─ Valida permissões antes de criar

supabase/functions/get-or-create-my-profile/
  └─ Bootstrap do perfil quando login funciona mas não existe em public.users
```

### Autenticação Multi-tab

```
useSessionManager.ts
  └─ Detecta múltiplas abas abertas do painel
  └─ Supabase Auth emite onAuthStateChange em todas as abas
  └─ Sessões sincronizadas via broadcast channel
  └─ migrations/20260236_multi_tab_sessions.sql
```

---

## 14. Testes E2E e Monitoramento Sintético

### Playwright

| Item | Descrição |
|---|---|
| **Config** | `playwright.config.ts` — projetos admin e public-menu |
| **webServer** | `npm run dev` (desativado quando CHECKLY=1) |
| **baseURL** | `PLAYWRIGHT_BASE_URL` ou `http://localhost:5173` |

### Scripts e variáveis

| Script | Descrição |
|---|---|
| `npm run test:e2e` | Todos os testes (usa `dotenv -e .env.e2e`) |
| `npm run test:e2e:smoke` | Apenas smoke @checkly |
| `npm run test:e2e:ui` | Playwright UI |

Crie `.env.e2e` a partir de `.env.e2e.example` e preencha credenciais reais para rodar os testes completos. O `.env` principal (com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) deve existir para o webServer iniciar o app em dev. Com valores placeholder em `.env.e2e`, order-flow, i18n e super-admin são automaticamente ignorados (skip condicional).

| Variável | Uso |
|---|---|
| `PLAYWRIGHT_BASE_URL` | URL base (local ou prod) |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Order-flow, i18n |
| `E2E_SUPER_ADMIN_EMAIL`, `E2E_SUPER_ADMIN_PASSWORD` | Super-admin (conta com role super_admin) |
| `E2E_RESTAURANT_SLUG` | Slug de restaurante de teste |

### Testes

| Arquivo | Cenário | Requisitos |
|---|---|---|
| `tests/e2e/smoke.spec.ts` | Smoke @checkly — login e landing (não altera DB) | Nenhum |
| `tests/e2e/order-flow.spec.ts` | Admin → altera preço, ativa zona → Cardápio → Checkout → OrderConfirmation | Admin, slug, restaurante com zonas e produtos |
| `tests/e2e/super-admin-metrics.spec.ts` | GMV segregado por moeda (BRL, PYG, ARS) | Conta super_admin |
| `tests/e2e/i18n.spec.ts` | Labels PT/ES no cardápio; toggle de idioma (skip se inexistente) | Slug de restaurante real |

**Comportamento dos testes:**
- **i18n**: Idioma padrão depende de `restaurant.language`; aceita PT ou ES. Segundo teste (troca de idioma) só roda se houver seletor PT/ES visível (ex.: LinkBio; Menu padrão não tem).
- **order-flow**: Multi-moeda (BRL, PYG); aguarda `cart-checkout` visível antes de clicar.
- **super-admin**: GMV total em BRL (conversão via câmbio configurado); assertion flexível.

### Checkly (Monitoramento Sintético)

```
checkly.config.ts
  └─ Smoke @checkly a cada 10 min
  └─ PLAYWRIGHT_BASE_URL e E2E_RESTAURANT_SLUG no dashboard
  └─ Use restaurante de teste para não sujar o banco de produção
```

### data-testid (Design System)

| Componente | testid |
|---|---|
| LoginPage | login-email, login-password, login-submit |
| ProductCard | product-add-{id} |
| Menu (header) | menu-view-cart |
| CartDrawer | cart-checkout |
| Checkout | checkout-name, checkout-phone, checkout-submit, map-address-picker |
| OrderTracking | order-tracking-page |
| OrderConfirmation | order-confirmation-page |
| InitialSplashScreen | (tela de carregamento — role="status") |
| Admin Menu | product-price-input, menu-save-product |
| DeliveryZones | zone-toggle-{id}, delivery-zone-new |
| Super-Admin Dashboard | gmv-by-currency (GMV total em BRL) |

---

## Apêndice: Referências Rápidas

### Arquivos Mais Importantes

| Arquivo | Função |
|---|---|
| `src/App.tsx` | Definição completa de todas as rotas |
| `src/lib/subdomain.ts` | Detecção de contexto por subdomínio |
| `src/contexts/AdminRestaurantContext.tsx` | Contexto central do painel admin |
| `src/store/authStore.ts` | Estado de autenticação global |
| `src/store/cartStore.ts` | Estado do carrinho |
| `src/hooks/queries/useRestaurantMenuData.ts` | Hook do cardápio público |
| `src/lib/whatsappTemplates.ts` | Templates de mensagens para pedidos (pt/es) |
| `src/lib/invalidatePublicCache.ts` | Invalidação de cache Admin → Cardápio |
| `src/components/public/InitialSplashScreen.tsx` | Splash de carregamento do cardápio (CSS puro) |
| `src/hooks/queries/useSuperAdminExchangeRates.ts` | Câmbio para métricas do super admin |
| `playwright.config.ts` | Config E2E (Admin + Cardápio) |
| `checkly.config.ts` | Monitoramento sintético (smoke a cada 10 min) |
| `src/lib/offline-db.ts` | Schema do IndexedDB para buffet |
| `supabase/db/migrations/20260219_init_access_control.sql` | RBAC + Feature Flags |
| `supabase/db/migrations/20260288_fix_get_restaurant_menu_n1_queries.sql` | RPC do cardápio otimizada |
| `supabase/db/migrations/20260289_orders_customer_language.sql` | orders.customer_language + place_order |
| `supabase/db/migrations/20260290_delivery_zones_radius_model.sql` | Zonas por raio (center_lat, center_lng, radius_meters) |
| `supabase/db/migrations/20260291_super_admin_exchange_rates.sql` | super_admin_settings (câmbio para métricas BRL) |
| `supabase/db/migrations/20260292_product_offers_always_active.sql` | product_offers.always_active — oferta sempre visível |
| `supabase/db/migrations/20260293_order_tracking_payment_bank_account.sql` | get_order_tracking retorna payment_bank_account e bank_account |
| `supabase/db/migrations/20260294_order_tracking_currency.sql` | get_order_tracking retorna restaurant.currency |
| `supabase/db/migrations/20260295_products_card_layout.sql` | products.card_layout ('grid' | 'beverage') — exibição no cardápio |
| `src/lib/productCardLayout.ts` | shouldUseBeverageCard() — escolha ProductCard vs ProductCardBeverage por produto |

### Documentação Complementar

| Arquivo | Conteúdo |
|---|---|
| `ARQUITETURA_PRODUTO_E_PLANOS.md` | RBAC granular e Feature Flags detalhadas |
| `docs/PERFORMANCE.md` | Diagnóstico e otimizações de performance |
| `DEPLOY.md` | Guia de deploy na Vercel + Supabase |
| `CONFIGURAR-SUPABASE.md` | Setup inicial do projeto Supabase |

---

*Documento mantido em `ARCHITECTURE.md` na raiz do projeto. Atualizar sempre que houver mudanças arquiteturais significativas.*
