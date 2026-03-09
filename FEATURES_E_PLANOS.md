# FEATURES E PLANOS — Quiero.food

**SaaS para restaurantes · Ciudad del Este (Paraguai)**  
**Documento:** Mapeamento de funcionalidades por plano e guia para desenvolvimento  
**Última atualização:** Março 2026

---

## Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Mapeamento de Funcionalidades por Plano](#2-mapeamento-de-funcionalidades-por-plano)
3. [Funcionalidades Pendentes / WIP](#3-funcionalidades-pendentes--wip)
4. [Limites Técnicos Requeridos](#4-limites-técnicos-requeridos)

---

## 1. Visão Geral do Sistema

### 1.1 Resumo técnico da arquitetura

O Quiero.food é uma aplicação **multi-tenant** (um código, vários restaurantes) com as seguintes características:

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 18, Vite 5, TypeScript |
| **Estado** | Zustand (auth, carrinho, restaurante, comanda de mesa) |
| **Dados** | TanStack React Query + Supabase (Auth, Database, Realtime, Storage) |
| **UI** | Radix UI, Tailwind CSS, Framer Motion, Recharts, Leaflet |
| **Outros** | react-router-dom v6, i18next (pt/es/en), Dexie (offline buffet), jspdf (PDF), qrcode.react (QR) |

**Roteamento:**

- **Landing / Login:** domínio raiz ou `app.quiero.food` → login, registro, upgrade.
- **Admin:** subdomínio `app` ou `admin` → dashboard, pedidos, cardápio, mesas, caixa, configurações, etc.
- **Público (cliente final):** subdomínio `{slug}.quiero.food` ou path `app.quiero.food/{slug}` → cardápio, checkout, reservas, link na bio, comanda digital.
- **Cozinha / Expo:** rotas `/kitchen` e `/expo` (KDS e tela de pedidos prontos).

**Supabase:**

- **Auth:** login por e-mail ou usuário (RPC `get_email_for_login`), sessão persistida, roles em `users` e `restaurant_user_roles`.
- **Database:** PostgreSQL com RLS; tabelas principais: `restaurants`, `users`, `products`, `categories`, `orders`, `order_items`, `tables`, `reservations`, `delivery_zones`, `couriers`, `virtual_comandas`, `comandas`, entre outras.
- **Realtime:** canais por `restaurant_id` em `orders`, `order_items`, `tables`, `waiter_calls`, `reservations`, `waiting_queue`, `comandas`, etc., para atualização ao vivo no admin, KDS, caixa e telas públicas.
- **Storage:** upload de imagens (logo, produtos) com conversão para WebP.

**Controle de acesso:**

- **RBAC:** roles (`super_admin`, `owner`/`restaurant_admin`, `manager`, `waiter`, `kitchen`, `cashier`) em `restaurant_user_roles`; rotas protegidas por `RoleProtectedRoute`.
- **Feature flags:** tabelas `subscription_plans`, `features`, `plan_features`, `restaurant_subscriptions`, `restaurant_feature_overrides`. RPC `restaurant_has_feature(restaurant_id, flag)`; rotas e componentes usam `ProtectedRoute requiredFeature="..."` e `FeatureGuard` / `useFeatureAccess`.

No banco, os planos atuais estão como **core**, **standard** e **enterprise**. Este documento utiliza a nomenclatura comercial para Ciudad del Este:

| Nome no documento | Preço (USD) | PYG (referência) | Equivalência técnica |
|-------------------|-------------|------------------|----------------------|
| **Presença** | $29 | 180.000 | Subconjunto de core + link bio + cotação + BI/analytics |
| **Delivery** | $59 | 350.000 | core + standard (delivery, entregadores, KDS/Expo) |
| **Gestão Total** | $89 | 559.000 | core + standard + enterprise (mesas, reservas, caixa, comanda digital, buffet, etc.) |

---

## 2. Mapeamento de Funcionalidades por Plano

### 2.1 Plano Presença — $29 (PYG 180.000)

Foco: **Menu Digital (QR), Link na Bio, Cotação Automática de Moedas.**

---

#### 2.1.1 Menu digital (cardápio público e QR)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Cardápio online acessível por link ou QR: listagem por categorias, produtos com preços, addons (pizza, marmita, combos), carrinho e checkout (retirada ou entrega, conforme plano). |
| **Visão do cliente final** | Acessa o link ou escaneia o QR do restaurante; vê produtos, adiciona ao carrinho, escolhe entrega ou retirada (se o plano permitir), forma de pagamento e finaliza. Pode usar em pt/es e ver preços em BRL ou PYG conforme cotação. |
| **Visão do dono do restaurante** | No admin: gerencia produtos, categorias, subcategorias, tamanhos de pizza/marmita; ativa/desativa itens; reordena; faz upload de fotos; gera e baixa QR do cardápio geral (e por categoria). Configurações básicas: nome, horário, moeda, idioma. |
| **Componentes / tabelas** | **Páginas:** `src/pages/public/menu/Menu.tsx`, `MenuViewOnly.tsx`; **hooks:** `useRestaurantMenuData` → RPC `get_restaurant_menu`; **componentes:** `src/components/public/menu/` (ProductCard, CartDrawer, CurrencySelector, modais de produto); **admin:** `Menu.tsx`, `MenuQRCodeCard.tsx`. **Tabelas:** `restaurants`, `products`, `categories`, `subcategories`, `product_addon_groups`, `product_addon_items`, `pizza_sizes`, `pizza_flavors`, `marmita_*`, etc. |

---

#### 2.1.2 Link na Bio

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Página única com botões configuráveis (cardápio delivery, WhatsApp, reservar, fila de espera) para usar no link da bio do Instagram/WhatsApp. |
| **Visão do cliente final** | Clica no link da bio e vê os botões do restaurante (ex.: “Ver cardápio”, “Falar no WhatsApp”, “Reservar mesa”, “Entrar na fila”). Redireciona para o fluxo correspondente. |
| **Visão do dono do restaurante** | Em configurações (ou área dedicada) define quais botões aparecem e para onde levam. Reserva e fila só aparecem se o plano tiver a feature de reservas. |
| **Componentes / tabelas** | **Páginas:** `src/pages/public/link-bio/LinkBio.tsx`, `LinkBioAbout.tsx`. **Hook:** `useLinkBioButtons`; **tabela:** `link_bio_buttons`. **Rotas públicas:** `/:restaurantSlug/bio`, `/:restaurantSlug/bio/sobre`. Uso de `useFeatureAccess('feature_reservations')` para exibir reserva/fila. |

---

#### 2.1.3 Cotação automática de moedas

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Exibe preços no cardápio e no checkout em mais de uma moeda (ex.: BRL e PYG) usando taxas de câmbio configuráveis; no checkout permite escolher moeda de pagamento e exibe dados bancários/PIX por moeda. |
| **Visão do cliente final** | Seleciona preferência de moeda (ex.: PYG); vê todos os preços convertidos; no checkout escolhe pagar em PYG ou BRL e vê instruções de transferência/PIX na moeda escolhida. |
| **Visão do dono do restaurante** | Em Configurações edita taxas de câmbio (ou usa fonte global). Define moedas aceitas e dados bancários por moeda. Relatórios e dashboard podem usar conversão para uma moeda base (ex.: BRL no super admin). |
| **Componentes / tabelas** | **Checkout:** `Checkout.tsx` — `exchange_rates`, `payment_currencies`, `CurrencySelector`, `getBankAccountForCurrency`. **Menu:** `useMenuCurrency.ts`, `formatForDisplay`, `convertBetweenCurrencies`. **Lib:** `src/lib/priceHelper.ts`. **Tabelas/colunas:** `restaurants.exchange_rates`, `restaurants.payment_currencies`; `super_admin_settings` (key `exchange_rates`) para métricas. **Migrations:** `20260268_cambio_inteligente.sql`, `20260291_super_admin_exchange_rates.sql`. |

---

#### 2.1.4 BI e analytics

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Dashboard com KPIs (pedidos, faturamento, ticket médio); gráficos de faturamento e métodos de pagamento; análise por canal; análise de retenção; lista de risco de churn com link WhatsApp; Matriz BCG de produtos; filtros de período; exportação CSV/XLSX e relatório impresso. Disponível em **todos os planos** (Presença, Delivery e Gestão Total). |
| **Visão do cliente final** | Não se aplica. |
| **Visão do dono do restaurante** | Dashboard: abas por canal, gráficos, tabelas; Churn Recovery: lista de clientes em risco e botão WhatsApp; BCG: classificação Estrelas/Vacas/Interrogações/Abacaxis; exportar e imprimir relatório. |
| **Componentes / tabelas** | **Página:** `Dashboard.tsx`; **hooks:** `useDashboardKPIs`, `useDashboardAnalytics`, `useDashboardStats`; **RPCs:** `get_dashboard_kpis`, `get_dashboard_analytics`, `get_advanced_dashboard_stats`. **Componentes:** `DashboardPrintReport.tsx`, `MenuMatrixBCG.tsx`, `ChurnRecoveryList.tsx`. **Features:** `feature_bcg_matrix`, `feature_churn_recovery`, `feature_retention_analytics`, `feature_buffet_analytics`, `feature_advanced_date_filter`. |

---

### 2.2 Plano Delivery — $59 (PYG 350.000)

Inclui **tudo do Presença** + **Gestão de Pedidos (Delivery), Fluxo do Entregador, Localização e Display de Cozinha (KDS/Expo).**

---

#### 2.2.1 Gestão de pedidos (delivery e retirada)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Recebe pedidos online (delivery e retirada), exibe em Kanban (Pendente, Em preparo, Pronto, Em entrega), atualização em tempo real, impressão térmica, atribuição de entregador e notificação ao cliente (WhatsApp). |
| **Visão do cliente final** | Faz pedido no checkout (entrega ou retirada); recebe confirmação. |
| **Visão do dono do restaurante** | Tela de Pedidos: Kanban com arraste de status, atribuir entregador, imprimir cupom, cancelar pedido, enviar link de status por WhatsApp; histórico e exportação CSV. |
| **Componentes / tabelas** | **Admin:** `src/pages/admin/delivery-logistics/Orders.tsx`; Realtime em `orders` e `order_items`. **Checkout:** `Checkout.tsx` → RPC `place_order`. **Tabelas:** `orders`, `order_items`. **Features:** pedidos delivery/retirada não têm flag única; acesso à tela pode ser condicionado ao plano (Delivery ou superior). |

---

#### 2.2.2 Zonas de entrega e taxa por localização

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Define zonas (bairros/regiões) com taxa de entrega fixa ou usa modo “por quilômetro” com faixas de distância e taxa; no checkout o cliente escolhe zona ou informa endereço e vê a taxa; suporte a geolocalização e mapa. |
| **Visão do cliente final** | No checkout de delivery: seleciona zona no dropdown ou informa endereço; vê taxa e total; opcionalmente usa mapa para localizar. |
| **Visão do dono do restaurante** | Admin → Zonas de entrega: CRUD de zonas (nome, taxa); ou configura faixas por km e endereço do restaurante para cálculo automático. |
| **Componentes / tabelas** | **Admin:** `DeliveryZones.tsx`; **hooks:** `useDeliveryZones`, `useDeliveryDistanceTiers`. **Checkout:** seleção de zona, `MapAddressPicker`, `getDeliveryFeeByDistance` (`src/lib/geo/geo.ts`). **Tabelas:** `delivery_zones`, `delivery_distance_tiers`. **Feature:** `feature_delivery_zones`; rota protegida com `requiredFeature="feature_delivery_zones"`. |

---

#### 2.2.3 Entregadores (fluxo do entregador)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Cadastro de entregadores (nome, telefone, placa); atribuição de entregador ao pedido de delivery no Kanban; link WhatsApp para avisar o entregador com detalhes do pedido. |
| **Visão do cliente final** | Indiretamente: status do pedido é atualizado quando o restaurante atribui entregador e altera etapas. |
| **Visão do dono do restaurante** | Admin → Entregadores: CRUD; em Pedidos atribui entregador ao pedido pronto e envia link WhatsApp ao entregador com endereço e dados do pedido. |
| **Componentes / tabelas** | **Admin:** `Couriers.tsx`; **hooks:** `useCouriers`, `useCourierMetrics`. **Orders:** atribuição `courier_id`, botão “Enviar para entregador” (WhatsApp). **Tabela:** `couriers`; **feature:** `feature_couriers`; rota `couriers` com `requiredFeature="feature_couriers"`. |

---

#### 2.2.4 Display de Cozinha (KDS) e Expo

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Display de cozinha (KDS) mostra pedidos em tempo real para preparo; tela Expo exibe pedidos prontos para retirada/entrega. Atualização via Realtime. |
| **Visão do cliente final** | Não acessa; fluxo é interno (cozinha/balcão). |
| **Visão do dono do restaurante** | Cozinha: tela com cards de pedidos por status (pendente, em preparo, pronto); filtros por canal (Delivery/Retirada, Mesa, Buffet). Expo: lista de pedidos prontos; marcar como entregue/retirado. |
| **Componentes / tabelas** | **Páginas:** `KitchenDisplay.tsx`, `ExpoScreen.tsx`; **hook:** `useReadyOrders.ts`. **Realtime:** canais em `orders` por `restaurant_id`. **Tabelas:** `orders`, `order_items`. Rotas `/kitchen` e `/expo`. |

---

### 2.3 Plano Gestão Total — $89 (PYG 559.000)

Inclui **tudo do Presença e do Delivery** + **Mesas e cardápio por mesa (QR), Reservas, Caixa, Comanda Digital, Buffet, Inventário/CMV, etc.**

---

#### 2.3.1 Mesas e cardápio por mesa (QR por mesa)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Criação de mesas no salão; geração de QR por mesa; cliente escaneia e acessa o cardápio daquela mesa; pedidos ficam vinculados à mesa; chamada de garçom pelo app. Disponível apenas no plano **Gestão Total**. |
| **Visão do cliente final** | Escaneia QR da mesa; vê cardápio e faz pedidos associados à mesa; pode “chamar garçom”. |
| **Visão do dono do restaurante** | Admin → Mesas: CRUD de mesas, ver/baixar QR por mesa, copiar link; marcar chamados de garçom como atendidos. |
| **Componentes / tabelas** | **Admin:** `Tables.tsx`; **público:** `MenuTable.tsx` (cardápio por mesa). **RPCs:** `reset_table`, `transfer_table_to_table`, `update_table_customer_name`, etc. **Realtime:** `tables`, `waiter_calls`, `orders`. **Tabelas:** `tables`, `waiter_calls`, `hall_zones`, `table_comanda_links`. **Features:** `feature_tables`; rotas `tables` e cardápio por mesa protegidas por esse conceito. |

---

#### 2.3.2 Reservas e fila de espera

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Cliente agenda reserva ou entra na fila de espera pela página pública; admin gerencia reservas (criar, ativar, cancelar, atribuir mesa) e fila; integração com mesas e caixa. |
| **Visão do cliente final** | Acessa “Reservar” ou “Fila” no link na bio ou cardápio; preenche dados e horário; recebe confirmação/código; na fila vê posição em tempo real. |
| **Visão do dono do restaurante** | Admin → Reservas: criar reserva, ativar ao chegar, cancelar, colocar na fila; ver fila de espera e notificar próximo da lista. |
| **Componentes / tabelas** | **Admin:** `Reservations.tsx`; **público:** `PublicReservation.tsx`, `PublicWaitingQueue.tsx`. **RPCs:** `create_reservation_by_slug`, `list_my_reservations_by_slug`, `add_to_waiting_queue_by_slug`, `get_my_waiting_position_by_slug`, `cancel_my_reservation_by_slug`, `activate_reservation`, `complete_reservation_for_table`, etc. **Realtime:** `reservations`, `waiting_queue`, `tables`. **Tabelas:** `reservations`, `waiting_queue`. **Feature:** `feature_reservations` (enterprise); rota `reservations` com `requiredFeature="feature_reservations"`. |

---

#### 2.3.3 Caixa (fechamento de comandas / mesas)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Fila de itens a fechar (comandas digitais, mesas, reservas); operador seleciona comanda/mesa, confere itens, aplica pagamento e finaliza; integração com comanda digital e mesas. |
| **Visão do cliente final** | Cliente que abriu comanda digital escaneia QR no caixa para pagar; ou a mesa é fechada pelo garçom/caixa após pagamento. |
| **Visão do dono do restaurante** | Tela Caixa: lista de comandas/mesas abertas; ao selecionar, vê itens; pode remover item, aplicar desconto e finalizar; sessões de caixa para controle. |
| **Componentes / tabelas** | **Página:** `Cashier.tsx`; **RPCs:** `cashier_complete_comanda`, `cashier_remove_order_item`, `complete_reservation`, `reset_table`, `reset_virtual_comanda`. **Realtime:** canal `cashier-queue-*`; **tabela:** `cashier_sessions`. **Feature:** `feature_virtual_comanda`; rota `cashier` com `requiredFeature="feature_virtual_comanda"`. |

---

#### 2.3.4 Comanda digital (QR comanda)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Cliente abre uma comanda digital via QR no celular; adiciona itens ao longo do consumo; no caixa o operador lê o código da comanda e fecha a conta. |
| **Visão do cliente final** | Escaneia QR “Comanda”; abre comanda no navegador; adiciona produtos; ao final apresenta código para o caixa fechar. |
| **Visão do dono do restaurante** | Admin → Comanda QR: gera QR para impressão (link da comanda); Caixa usa essa comanda para fechamento. |
| **Componentes / tabelas** | **Público:** `VirtualComanda.tsx`; **admin:** `ComandaQRCode.tsx`. **RPCs:** `open_virtual_comanda`, `sync_virtual_comanda_to_order`, `update_virtual_comanda_customer_name`, `recalculate_virtual_comanda_total`, `close_virtual_comanda`. **Tabelas:** `virtual_comandas`, `virtual_comanda_items`. **Feature:** `feature_virtual_comanda`; rotas `cashier` e `comanda-qr` protegidas. |

---

#### 2.3.5 Módulo Buffet (comandas físicas, peso, offline)

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Comandas físicas (ex.: CMD-XXXX); leitura de código de barras para produto e comanda; venda por peso (gramas); fechamento de comanda; operação offline com sincronização ao reconectar. |
| **Visão do cliente final** | Não acessa o módulo buffet; consome no salão e a comanda é gerenciada pelo operador. |
| **Visão do dono do restaurante** | Tela Buffet: criar comanda (F2), escanear produto/comanda, informar peso; fechar comanda (F8); ver grade de comandas abertas; indicador online/offline/sincronizando. |
| **Componentes / tabelas** | **Página:** `Buffet.tsx`; **hooks:** `useComandas` (Realtime em `comandas`). **Tabelas:** `comandas`, `comanda_items`. **Feature:** `feature_buffet_module`; rota `buffet` com `requiredFeature="feature_buffet_module"`. Dexie/IndexedDB para offline. |

---

#### 2.3.6 BI e analytics avançados

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Mesmo conjunto de BI e analytics descrito no [Plano Presença (2.1.4)](#214-bi-e-analytics): dashboard com KPIs por canal, gráficos, retenção, churn, Matriz BCG, exportação e relatório impresso. Disponível em **todos os planos** (Presença, Delivery e Gestão Total). |
| **Visão do cliente final** | Não se aplica. |
| **Visão do dono do restaurante** | Dashboard: abas por canal, gráficos, tabelas; Churn Recovery: lista de clientes em risco e botão WhatsApp; BCG: classificação Estrelas/Vacas/Interrogações/Abacaxis; exportar e imprimir relatório. |
| **Componentes / tabelas** | **Página:** `Dashboard.tsx`; **hooks:** `useDashboardKPIs`, `useDashboardAnalytics`, `useDashboardStats`; **RPCs:** `get_dashboard_kpis`, `get_dashboard_analytics`, `get_advanced_dashboard_stats`. **Componentes:** `DashboardPrintReport.tsx`, `MenuMatrixBCG.tsx`, `ChurnRecoveryList.tsx`. **Features:** `feature_bcg_matrix`, `feature_churn_recovery`, `feature_retention_analytics`, `feature_buffet_analytics`, `feature_advanced_date_filter`. |

---

#### 2.3.7 Inventário com CMV e produtos

| Aspecto | Descrição |
|--------|-----------|
| **O que faz** | Produtos com preço de custo e margem; inventário de insumos e movimentações; CMV; importação/exportação de produtos em CSV. |
| **Visão do cliente final** | Não se aplica. |
| **Visão do dono do restaurante** | Admin → Produtos/Inventário: listar com custo e margem; CRUD; importar/exportar CSV. Configuração de ingredientes e estoque. |
| **Componentes / tabelas** | **Páginas:** `Inventory.tsx`, `InventoryIngredients.tsx`, produtos/inventário; **tabelas:** `inventory_*`, `ingredients`, `ingredient_stock`, `product_ingredients`. **Feature:** `feature_inventory_cost`. |

---

#### 2.3.8 Outras funcionalidades do Gestão Total

| Funcionalidade | Descrição breve | Feature / rota |
|----------------|-----------------|----------------|
| **Domínio personalizado** | Cardápio em domínio próprio (ex.: cardapio.seudominio.com.br) via RPC `get_restaurant_slug_by_hostname`. | `feature_custom_domain` |
| **Terminal do garçom** | Pedidos e chamados por zona do garçom; place_order no PDV. | `WaiterTerminal.tsx`, `WaiterPDV.tsx`; mesas/roles |
| **Ofertas, cupons, fidelidade** | Ofertas por produto; cupons de desconto; programa de pontos e resgate no checkout. | `Offers.tsx`, `Coupons.tsx`, `Loyalty.tsx`; `product_offers`, `discount_coupons`, `loyalty_programs`, `loyalty_points`; RPCs `get_loyalty_points`, `redeem_loyalty` |

---

## 3. Funcionalidades Pendentes / WIP

- **Nomenclatura e preços dos planos no banco:** Os planos no banco estão como `core`, `standard`, `enterprise` com preços/valores diferentes dos comerciais (Presença $29, Delivery $59, Gestão Total $89). É necessário alinhar nomes e preços (ou criar novos planos) e manter o mapeamento `plan_features` e `restaurant_subscriptions`.
- **Integração FactPy:** Não foi encontrada referência a “FactPy” no código (nem TODO/FIXME). Se houver integração planejada (ex.: faturação Paraguai), deve ser tratada como pendência em documento de produto e backlog.
- **Feature “Presença” explícita:** Não existe flag única “Plano Presença” no banco; o que define o plano é `restaurant_subscriptions.plan_id` e as features do plano. Para limitar Presença apenas a menu + link bio + cotação (sem delivery/mesas), é preciso garantir que o plano “Presença” tenha apenas as features correspondentes em `plan_features` e que rotas de delivery/mesas/reservas/caixa/buffet exijam features de planos superiores.
- **Bloqueio de checkout por plano:** O checkout hoje permite delivery e retirada se o restaurante tiver zonas/entregadores configurados. A validação de plano (ex.: Presença não pode receber pedidos de delivery) pode ser feita no backend (`place_order`) e/ou no frontend escondendo opção “Entrega” quando o restaurante não tiver plano Delivery (ou feature equivalente).
- **Limites por plano no código:** Não há hoje limites explícitos (ex.: número máximo de mesas, de entregadores, de usuários simultâneos) por plano; isso deve ser implementado conforme [Limites Técnicos Requeridos](#4-limites-técnicos-requeridos).

---

## 4. Limites Técnicos Requeridos

Com base no uso de **Supabase (Realtime, Auth, Database)** e na operação por plano, recomenda-se implementar travas lógicas no código e, quando possível, no backend (RLS ou RPCs) para respeitar regras comerciais e limites da infraestrutura.

### 4.1 Supabase — limites gerais (referência)

- **Realtime:** número de conexões simultâneas e mensagens/segundo conforme plano Supabase.
- **Auth:** MAU (Monthly Active Users) e sessões simultâneas.
- **Database:** tamanho, requisições e conexões.
- **Storage:** espaço e banda.

Consulte a documentação atual do Supabase para valores por plano e considere limites “por tenant” (por restaurante) para não esgotar a cota global com poucos clientes.

### 4.2 Sugestões de travas por plano

| Limite | Presença | Delivery | Gestão Total | Onde implementar |
|--------|----------|----------|--------------|-------------------|
| **Mesas** | 0 | 0 | Ilimitado ou alto | Mesas apenas no Gestão Total. RPC ou trigger ao inserir/atualizar `tables`; frontend pode esconder “Nova mesa” ao atingir limite. |
| **Zonas de entrega** | 0 | Ex.: 5–15 | Ilimitado ou alto | RPC ou validação em `delivery_zones`; frontend ao criar zona. |
| **Entregadores** | 0 | Ex.: 3–10 | Ilimitado ou alto | RPC ou validação em `couriers`. |
| **Usuários do restaurante** | Ex.: 1–2 | Ex.: 3–5 | Ilimitado ou alto | Ao criar vínculo em `restaurant_user_roles` (Edge Function ou RPC); Super Admin ao convidar. |
| **Conexões Realtime simultâneas** | Baixo (ex.: 2–3 por restaurante) | Médio (ex.: 5–10) | Alto | Não trivial no Supabase; pode-se limitar abas/dispositivos por restaurante (sessões ativas) ou aceitar que o limite seja global e monitorar. |
| **Pedidos ativos (não concluídos)** | Opcional | Opcional | Opcional | Limite por plano para evitar abuso; validação em `place_order` ou job de limpeza. |
| **Reservas simultâneas / fila** | 0 (sem feature) | 0 (sem feature) | Ex.: 50 / 20 | Validação nas RPCs de reserva e fila. |
| **Comandas digitais abertas** | 0 (sem feature) | 0 (sem feature) | Ex.: 100 | Validação em `open_virtual_comanda` ou contagem em RPC de abertura. |

### 4.3 Onde colocar as travas no código

1. **Backend (recomendado):**  
   - **RPCs:** em funções como `place_order`, `open_virtual_comanda`, `create_reservation_by_slug`, `add_to_waiting_queue_by_slug`, e em inserts em `tables`, `delivery_zones`, `couriers`, chamar uma função auxiliar que lê o plano do restaurante (via `restaurant_subscriptions`) e aplica o limite; em caso de violação, retornar erro claro (ex.: “Limite de mesas do seu plano atingido”).  
   - **Edge Function** de criação de usuário do restaurante: antes de inserir em `restaurant_user_roles`, verificar contagem atual e limite do plano.

2. **Frontend:**  
   - Esconder ou desabilitar “Adicionar mesa”, “Nova zona”, “Novo entregador”, “Convidar usuário” quando o plano atingir o limite (usar hook que retorna `canAddTable`, `canAddZone`, etc., baseado em contagem + plano).  
   - Exibir mensagem de upgrade quando o usuário tentar uma ação bloqueada e o backend retornar erro de limite.

3. **Super Admin:**  
   - Ao alterar plano do restaurante, validar se a configuração atual (número de mesas, zonas, entregadores, usuários) não excede o novo plano; em caso de downgrade, avisar ou bloquear até ajuste manual.

Este documento deve ser usado como referência para stakeholders e para guiar os próximos passos de desenvolvimento (mapeamento plano ↔ features, implementação de limites e ajuste de nomenclatura/preços no banco).
