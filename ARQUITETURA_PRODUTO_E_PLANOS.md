# ARQUITETURA DO PRODUTO E PLANOS DE ASSINATURA
### Fonte da Verdade — Controle de Acesso (RBAC) e Feature Flags SaaS

> **Gerado em:** 19/02/2026  
> **Escopo:** Análise completa do diretório `src/`  
> **Propósito:** Guia técnico para implementação de RBAC granular e pacotes de assinatura (Planos SaaS)

---

## ÍNDICE

1. [Mapeamento de Telas e Fluxos](#1-mapeamento-de-telas-e-fluxos)
2. [Matriz de Permissões por Cargo (RBAC)](#2-matriz-de-permissões-por-cargo-rbac)
3. [Granularidade para Feature Flags — Planos de Assinatura](#3-granularidade-para-feature-flags--planos-de-assinatura)
4. [Estrutura Técnica de Bloqueio](#4-estrutura-técnica-de-bloqueio)

---

## 1. MAPEAMENTO DE TELAS E FLUXOS

### Arquitetura Multi-Tenant de Rotas

O sistema utiliza roteamento baseado em **subdomínio** detectado via `src/lib/subdomain.ts`:

| Contexto | Subdomínio | Exemplo |
|---|---|---|
| Landing Page pública | raiz / sem subdomínio | `quiero.food` |
| Painel Administrativo | `app` ou `admin` | `app.quiero.food` |
| Cardápio do Cliente | `{slug}` do restaurante | `pizzaria.quiero.food` |

---

### 1.1 TELAS PÚBLICAS (Cliente Final)

#### TELA: Cardápio Interativo (Menu)
- **Rota:** `/{restaurantSlug}` ou `{slug}.quiero.food/`
- **Arquivo:** `src/pages/public/Menu.tsx`

| Sub-função | Descrição |
|---|---|
| Exibir produtos por categoria | Listagem categorizada com imagens e preços |
| Buscar produto | Campo de pesquisa por nome |
| Filtrar por categoria | Abas/botões de categorias no topo |
| Adicionar produto ao carrinho | Botão "+", incrementa quantidade |
| Abrir modal de Pizza | Selecionar tamanho, sabores, massa, borda |
| Abrir modal de Marmita | Selecionar tamanho, proteínas, acompanhamentos |
| Abrir carrinho (drawer) | Ver itens, subtotal, atualizar quantidades |
| Chamar garçom | Botão disponível no modo mesa (`table mode`) |
| Ir para Checkout | Botão no carrinho, redireciona para `/checkout` |
| Verificar horário de funcionamento | Exibe aviso se restaurante fechado |
| Trocar idioma | pt / es (via i18n) |

#### TELA: Cardápio Somente Leitura (View Only)
- **Rota:** `/{restaurantSlug}/menu`
- **Arquivo:** `src/pages/public/MenuViewOnly.tsx`

| Sub-função | Descrição |
|---|---|
| Exibir produtos por categoria | Listagem sem opção de compra |
| Buscar produto | Campo de pesquisa |
| Filtrar por categoria | Abas de categorias |

#### TELA: Cardápio de Mesa (Table Mode)
- **Rota:** `/{restaurantSlug}/cardapio/:tableNumber`
- **Arquivo:** `src/pages/public/MenuTable.tsx`

| Sub-função | Descrição |
|---|---|
| Validar número da mesa | Valida existência da mesa no sistema |
| Chamar garçom | Registra `WaiterCall` no Supabase |
| Todas as sub-funções do Cardápio Interativo | (componente `PublicMenu` em modo mesa) |

#### TELA: Checkout
- **Rota:** `/{restaurantSlug}/checkout`
- **Arquivo:** `src/pages/public/Checkout.tsx`

| Sub-função | Descrição |
|---|---|
| Selecionar tipo de entrega | Delivery / Retirada no local |
| Selecionar zona de entrega | Dropdown com taxas por bairro/região |
| Informar endereço de entrega | Campo livre de texto |
| Selecionar forma de pagamento | PIX / Cartão / Dinheiro |
| Informar troco para | Campo numérico (pagamento em dinheiro) |
| Adicionar observações | Textarea livre |
| Enviar pedido via WhatsApp | Gera link e redireciona (não-mesa) |
| Registrar pedido de mesa | Salva direto no banco (modo mesa) |
| Selecionar país do telefone | BR (+55) / PY (+595) |

---

### 1.2 TELAS DO PAINEL ADMINISTRATIVO (Restaurante)

#### TELA: Dashboard / Analytics
- **Rota:** `/admin` (index)
- **Arquivo:** `src/pages/admin/Dashboard.tsx`

| Sub-função | Descrição |
|---|---|
| KPIs principais | Total de pedidos, faturamento, ticket médio |
| Filtro por período | 30 dias / 365 dias / Total (max) |
| Filtro por canal | Todos / Delivery / Mesa / Retirada / Buffet |
| Gráfico de faturamento diário | Tendência de receita ao longo do tempo |
| Gráfico de métodos de pagamento | Distribuição por forma de pagamento |
| Gráfico de retenção de clientes | Clientes recorrentes vs. novos |
| Métricas de buffet | Faturamento e comandas do buffet (quando habilitado) |
| Lista de risco de churn | Clientes com risco de abandono + link WhatsApp |
| Matriz BCG de produtos | Estrelas, Vacas, Pontos de Interrogação, Abacaxis |
| Exportar dados (CSV) | Download de relatório em .csv |
| Exportar dados (XLSX) | Download de relatório em .xlsx |
| Resetar todos os dados | Limpar dados do restaurante (com confirmação por senha) |

#### TELA: Pedidos (Orders)
- **Rota:** `/admin/orders`
- **Arquivo:** `src/pages/admin/Orders.tsx`

| Sub-função | Descrição |
|---|---|
| Kanban de pedidos ativos | Colunas: Pendentes / Em Preparo / Prontos / Em Entrega |
| Atualizar status do pedido | Avançar ou retroceder status |
| Atribuir entregador | Vincular um `Courier` ao pedido de delivery |
| Imprimir cupom do pedido | Imprimir cupom térmico (58mm / 80mm) |
| Cancelar pedido | Com diálogo de confirmação |
| Enviar notificação WhatsApp | Link de atualização de status para cliente (delivery) |
| Visualizar pedidos concluídos | Aba/toggle de histórico de pedidos |
| Filtrar pedidos concluídos | Por data: hoje / 7 dias / 30 dias |
| Exportar pedidos concluídos (CSV) | Download do histórico |
| Impressão automática | Auto-imprimir novo pedido (configurável em Settings) |

#### TELA: Cardápio (Menu)
- **Rota:** `/admin/menu`
- **Arquivo:** `src/pages/admin/Menu.tsx`

| Sub-função | Descrição |
|---|---|
| Listar produtos | Tabela com todos os produtos ativos/inativos |
| Buscar produto | Campo de busca por nome |
| Criar produto | Formulário completo (nome, descrição, preço, imagem, categoria) |
| Editar produto | Modal de edição completa |
| Duplicar produto | Cria cópia do produto |
| Excluir produto | Remove permanentemente |
| Ativar/Desativar produto | Toggle de disponibilidade no cardápio público |
| Reordenar produtos (drag & drop) | Arrastar e soltar para reordenar |
| Gerenciar categorias | CRUD de categorias + subcategorias |
| Reordenar categorias (drag & drop) | Arrastar e soltar para reordenar |
| Configurar Pizza (Tamanhos) | CRUD de tamanhos (P/M/G, multiplicadores) |
| Configurar Pizza (Massas) | CRUD de tipos de massa |
| Configurar Pizza (Bordas) | CRUD de bordas recheadas e preços |
| Configurar Marmita (Tamanhos) | CRUD de tamanhos com peso e preço base |
| Configurar Marmita (Proteínas) | CRUD de proteínas disponíveis |
| Configurar Marmita (Acompanhamentos) | CRUD de acompanhamentos |
| Gerenciar slug do cardápio | Configurar URL personalizada |
| Copiar links do cardápio | Copiar link interativo / somente leitura |
| Gerar QR Codes | QR para cardápio geral + cada mesa |

#### TELA: Buffet / Comandas
- **Rota:** `/admin/buffet`
- **Arquivo:** `src/pages/admin/Buffet.tsx`

| Sub-função | Descrição |
|---|---|
| Criar nova comanda | Tecla F2 ou botão, abre nova comanda |
| Escanear produto (SKU) | Leitura via leitor de código de barras |
| Escanear número da comanda | Associar produto a comanda existente |
| Adicionar produto por peso | Input de peso em gramas com cálculo automático |
| Remover item da comanda | Exclusão de item |
| Fechar comanda | Tecla F8 ou botão, calcula total e finaliza |
| Visualizar grade de comandas | Grid com todas as comandas abertas |
| Sincronização offline | Funciona sem internet, sincroniza ao reconectar |
| Indicador de status de sync | Ícone de online/offline/sincronizando |
| Atalhos de teclado | F2 (nova comanda), F8 (fechar), ESC (limpar seleção) |

#### TELA: Mesas (Tables)
- **Rota:** `/admin/tables`
- **Arquivo:** `src/pages/admin/Tables.tsx`

| Sub-função | Descrição |
|---|---|
| Criar mesa | Adicionar nova mesa com número |
| Excluir mesa | Remover mesa do sistema |
| Ver QR Code da mesa | Modal com QR gerado para a mesa |
| Baixar QR Code | Download do QR em imagem |
| Copiar link da mesa | Link direto para o cardápio da mesa |
| Abrir cardápio da mesa | Abre link do cardápio da mesa |
| Marcar chamada de garçom como atendida | Confirmar chamado do cliente |
| Ver chamadas de garçom pendentes | Lista de mesas que chamaram atendimento |

#### TELA: Inventário de Produtos
- **Rota:** `/admin/products`
- **Arquivo:** `src/pages/admin/ProductsInventory.tsx`

| Sub-função | Descrição |
|---|---|
| Listar produtos com custo | Visualização de preço de custo, venda e margem |
| Criar produto (inventário) | Formulário com SKU, preço de custo, preço de venda |
| Editar produto (inventário) | Edição de todos os campos de custo |
| Excluir produto | Remoção permanente |
| Ativar/Desativar produto | Toggle de status ativo |
| Importar produtos (CSV) | Upload de planilha CSV com produtos |
| Exportar produtos (CSV) | Download da lista de produtos |

#### TELA: Zonas de Entrega
- **Rota:** `/admin/delivery-zones`
- **Arquivo:** `src/pages/admin/DeliveryZones.tsx`

| Sub-função | Descrição |
|---|---|
| Listar zonas | Visualizar todas as zonas com taxa de entrega |
| Criar zona de entrega | Definir bairro/região + taxa |
| Editar zona de entrega | Atualizar nome ou taxa |
| Excluir zona de entrega | Remover permanentemente |
| Ativar/Desativar zona | Toggle de disponibilidade |

#### TELA: Entregadores (Couriers)
- **Rota:** `/admin/couriers`
- **Arquivo:** `src/pages/admin/Couriers.tsx`

| Sub-função | Descrição |
|---|---|
| Listar entregadores | Ver todos os entregadores cadastrados |
| Criar entregador | Nome, telefone, placa do veículo |
| Editar entregador | Atualizar dados cadastrais |
| Excluir entregador | Remover permanentemente |
| Alterar status do entregador | Disponível / Ocupado / Offline |

#### TELA: Configurações do Restaurante
- **Rota:** `/admin/settings`
- **Arquivo:** `src/pages/admin/Settings.tsx`

| Sub-função | Descrição |
|---|---|
| Editar informações básicas | Nome, telefone, WhatsApp, Instagram |
| Fazer upload do logotipo | Subir imagem da logo (converte para WebP) |
| Configurar horários de funcionamento | Por dia da semana, horário aberto/fechado |
| Fechar manualmente o restaurante | Toggle para fechar fora do horário |
| Marcar como aberto 24h | Ignora configuração de horários |
| Configurar moeda | BRL (Real) ou PYG (Guaraní) |
| Configurar idioma do cardápio | Português ou Espanhol |
| Configurar país do telefone | Brasil (+55) ou Paraguai (+595) |
| Configurar impressão automática | Ativar/desativar auto-print ao receber pedido |
| Configurar largura do papel | 58mm ou 80mm |
| Personalizar cores | Cor primária e secundária do cardápio público |

---

### 1.3 TELAS DE COZINHA

#### TELA: Display de Cozinha (KDS)
- **Rota:** `/kitchen`
- **Arquivo:** `src/pages/kitchen/KitchenDisplay.tsx`

| Sub-função | Descrição |
|---|---|
| Visualizar pedidos pendentes | Cards com itens, tempo decorrido |
| Visualizar pedidos em preparo | Cards com timer colorido por urgência |
| Avançar status: Pendente → Em Preparo | Botão de ação no card |
| Avançar status: Em Preparo → Pronto | Botão de ação no card |
| Atualização em tempo real | Supabase Realtime subscriptions |
| Tema escuro | Interface otimizada para telas de cozinha |

---

### 1.4 TELAS DO SUPER ADMIN (SaaS)

#### TELA: Dashboard Super Admin
- **Rota:** `/super-admin`
- **Arquivo:** `src/pages/super-admin/Dashboard.tsx`

| Sub-função | Descrição |
|---|---|
| Ver todos os restaurantes cadastrados | Lista global de todos os tenants |
| Métricas globais | Total de restaurantes, faturamento total, pedidos totais, ticket médio |
| Criar novo restaurante | Formulário completo (dados básicos, contato, horários, configurações) |
| Ativar/Desativar restaurante | Toggle de status global |
| Acessar painel de um restaurante | Navegar como admin do restaurante |
| Abrir cozinha de um restaurante | Link direto para KDS |
| Ver cardápio de um restaurante | Link para cardápio público |
| Sair da conta | Logout |

---

### 1.5 TELAS DE AUTENTICAÇÃO

#### TELA: Login
- **Rota:** `/login`
- **Arquivo:** `src/pages/auth/LoginPage.tsx`

| Sub-função | Descrição |
|---|---|
| Login com email | Campo de email + senha |
| Login com nome de usuário | Campo de login (username) + senha |
| Redirecionamento pós-login | Por role: super_admin → /super-admin, restaurant_admin → /admin, kitchen → /kitchen |

---

## 2. MATRIZ DE PERMISSÕES POR CARGO (RBAC)

### Roles Existentes no Sistema

O sistema atualmente implementa 3 roles no enum `UserRole` (`src/types/index.ts`):

| Role | Valor no Banco | Descrição Atual |
|---|---|---|
| `SUPER_ADMIN` | `super_admin` | Acesso total ao SaaS, gerencia todos os restaurantes |
| `RESTAURANT_ADMIN` | `restaurant_admin` | Dono/admin de um restaurante específico |
| `KITCHEN` | `kitchen` | Acesso apenas ao display de cozinha |

### Roles Sugeridos para RBAC Granular

Para uma implementação completa de controle de acesso, sugere-se expandir para:

| Role | Nível | Descrição |
|---|---|---|
| `super_admin` | 0 — SaaS | Controla toda a plataforma |
| `restaurant_admin` | 1 — Restaurante | Dono ou gerente geral (acesso total ao restaurante) |
| `manager` | 2 — Restaurante | Gerente operacional (sem acesso a financeiro sensível/reset) |
| `waiter` | 3 — Restaurante | Garçom (acesso a pedidos e mesas, sem editar cardápio) |
| `kitchen` | 4 — Restaurante | Cozinheiro (somente KDS) |
| `cashier` | 5 — Restaurante | Operador de caixa/buffet |

---

### Matriz de Permissões por Tela e Ação

**Legenda:** ✅ Acesso total | 🔒 Somente leitura | ❌ Sem acesso | ⚠️ Acesso parcial

#### DASHBOARD & ANALYTICS

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver KPIs principais | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver gráfico de faturamento | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver métodos de pagamento | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver análise de retenção | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Ver métricas de buffet | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver lista de risco de churn | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver Matriz BCG | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exportar CSV/XLSX | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| **Resetar todos os dados** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### PEDIDOS (ORDERS)

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver kanban de pedidos ativos | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Atualizar status do pedido | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Atribuir entregador | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Imprimir cupom | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Cancelar pedido** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Enviar notificação WhatsApp | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver pedidos concluídos | ✅ | ✅ | ✅ | 🔒 | ❌ | ❌ |
| Exportar pedidos (CSV) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

#### CARDÁPIO (MENU)

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver lista de produtos | ✅ | ✅ | ✅ | 🔒 | ❌ | ❌ |
| Criar/Editar/Excluir produto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ativar/Desativar produto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reordenar produtos (drag & drop) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gerenciar categorias | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configurar Pizza/Marmita | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gerenciar slug / links | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gerar QR Codes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

#### BUFFET / COMANDAS

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Criar nova comanda | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Escanear produto/comanda | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Adicionar produto por peso | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Fechar comanda (cobrar) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Ver grade de comandas | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

#### MESAS (TABLES)

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Criar/Excluir mesa | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver QR Code das mesas | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver chamadas de garçom | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Marcar chamada como atendida | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

#### INVENTÁRIO DE PRODUTOS

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver preços de custo e margem | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Criar/Editar produto com custo | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Importar/Exportar CSV | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |

#### ENTREGADORES (COURIERS)

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Criar/Editar/Excluir entregador | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Alterar status do entregador | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

#### ZONAS DE ENTREGA

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Criar/Editar/Excluir zona | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ativar/Desativar zona | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

#### CONFIGURAÇÕES

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Editar dados básicos do restaurante | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload de logotipo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configurar horários | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Configurar impressão | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Configurar moeda/idioma | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Personalizar cores | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### COZINHA (KDS)

| Função | super_admin | restaurant_admin | manager | waiter | kitchen | cashier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Acessar display de cozinha | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Avançar status: Pendente → Preparo | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Avançar status: Preparo → Pronto | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

---

## 3. GRANULARIDADE PARA FEATURE FLAGS — PLANOS DE ASSINATURA

### Definição dos Planos

| Plano | Tier | Público-alvo | Posicionamento |
|---|---|---|---|
| **Core** | Básico | Restaurante pequeno, primeiro contato | Gratuito ou baixo custo de entrada |
| **Standard** | Intermediário | Restaurante em crescimento | Plano mais popular |
| **Enterprise** | Avançado | Rede de restaurantes ou alto volume | Alto valor, contrato anual |

---

### 3.1 TABELA MESTRE DE FEATURE FLAGS

#### MÓDULO: CARDÁPIO PÚBLICO

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Cardápio interativo básico | Exibir produtos, adicionar ao carrinho | **Core** | `feature_public_menu` |
| Cardápio somente leitura | Versão sem compra (vitrine) | **Core** | `feature_menu_view_only` |
| Cardápio por mesa | QR por mesa com chamada de garçom | **Standard** | `feature_table_menu` |
| Personalização de cores | Cor primária/secundária no cardápio público | **Standard** | `feature_brand_colors` |
| Múltiplos idiomas (pt/es) | Interface do cardápio em espanhol | **Standard** | `feature_multilanguage` |
| Múltiplas moedas (BRL/PYG) | Exibir preços em Guaraní | **Standard** | `feature_multicurrency` |
| Compartilhamento via QR Code | Geração de QR para cardápio e mesas | **Standard** | `feature_qr_codes` |
| Upload de logo personalizado | Logo própria no cardápio | **Standard** | `feature_custom_logo` |

#### MÓDULO: PEDIDOS

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Receber pedidos (kanban básico) | Pedidos Pendente / Em Preparo / Pronto | **Core** | `feature_orders_kanban` |
| Atualizar status de pedidos | Avançar/retroceder status | **Core** | `feature_order_status_update` |
| Cancelar pedidos | Cancelamento manual de pedidos | **Core** | `feature_order_cancel` |
| Pedidos de mesa (table orders) | Pedidos registrados sem WhatsApp | **Standard** | `feature_table_orders` |
| Delivery (modo entrega) | Canal de pedidos para entrega | **Standard** | `feature_delivery_orders` |
| Atribuição de entregadores | Vincular `Courier` ao pedido | **Standard** | `feature_courier_assignment` |
| Notificação WhatsApp (cliente) | Enviar update de status ao cliente | **Standard** | `feature_whatsapp_notifications` |
| Impressão térmica automática | Auto-imprimir ao receber pedido | **Standard** | `feature_thermal_print` |
| Exportação de pedidos (CSV) | Download de histórico de pedidos | **Standard** | `feature_orders_export` |

#### MÓDULO: CARDÁPIO ADMINISTRATIVO (MENU)

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| CRUD básico de produtos | Criar, editar, excluir produtos | **Core** | `feature_product_management` |
| Ativar/Desativar produto | Disponibilidade em tempo real | **Core** | `feature_product_toggle` |
| Gerenciamento de categorias | CRUD de categorias | **Core** | `feature_categories` |
| Subcategorias | Agrupamento dentro de categorias | **Standard** | `feature_subcategories` |
| Drag & drop de produtos/categorias | Reordenamento visual | **Standard** | `feature_drag_drop_reorder` |
| Duplicar produto | Copiar produto existente | **Standard** | `feature_product_duplicate` |
| Configuração de Pizza | Tamanhos, massas, bordas | **Standard** | `feature_pizza_config` |
| Configuração de Marmita | Tamanhos, proteínas, acompanhamentos | **Standard** | `feature_marmita_config` |
| Upload de imagem de produto | Foto do produto (converte WebP) | **Standard** | `feature_product_images` |

#### MÓDULO: BUFFET / COMANDAS

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Módulo de Buffet completo | Comandas, scanner, peso, fechamento | **Enterprise** | `feature_buffet_module` |
| Operação offline (IndexedDB) | Funciona sem internet | **Enterprise** | `feature_offline_sync` |
| Scanner de código de barras | Leitura de SKU de produtos | **Enterprise** | `feature_barcode_scanner` |
| Produtos por peso | Venda com cálculo automático por grama | **Enterprise** | `feature_weight_products` |

#### MÓDULO: MESAS

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Gerenciamento de mesas | CRUD de mesas | **Standard** | `feature_tables` |
| QR Code por mesa | QR individual por mesa | **Standard** | `feature_table_qr` |
| Chamada de garçom | Cliente chama atendimento pelo celular | **Standard** | `feature_waiter_call` |
| Histórico de chamadas | Log de chamadas de garçom | **Standard** | `feature_waiter_call_history` |

#### MÓDULO: ENTREGADORES (COURIERS)

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Gestão de entregadores | CRUD de couriers | **Standard** | `feature_couriers` |
| Status do entregador | Disponível / Ocupado / Offline | **Standard** | `feature_courier_status` |
| Atribuição de entregador ao pedido | Vinculação no kanban | **Standard** | `feature_courier_assignment` |

#### MÓDULO: ZONAS DE ENTREGA

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Zonas de entrega com taxa | CRUD de regiões e taxas | **Standard** | `feature_delivery_zones` |
| Seleção de zona no checkout | Cliente escolhe bairro no checkout | **Standard** | `feature_delivery_zone_select` |

#### MÓDULO: INVENTÁRIO E FINANCEIRO

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Inventário de produtos com custo | Preço de custo, CMV, margens | **Enterprise** | `feature_inventory_cost` |
| Importação de produtos (CSV) | Upload em massa via planilha | **Enterprise** | `feature_products_csv_import` |
| Exportação de produtos (CSV) | Download da base de produtos | **Enterprise** | `feature_products_csv_export` |

#### MÓDULO: BI E ANALYTICS (DASHBOARD)

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| KPIs básicos | Total pedidos, faturamento, ticket médio | **Core** | `feature_kpis_basic` |
| Gráfico de faturamento diário | Tendência de receita | **Standard** | `feature_revenue_chart` |
| Análise por canal | Delivery / Mesa / Retirada / Buffet | **Standard** | `feature_channel_analytics` |
| Métodos de pagamento | Distribuição por forma de pagamento | **Standard** | `feature_payment_analytics` |
| Exportação de relatórios (CSV/XLSX) | Download dos dados do dashboard | **Standard** | `feature_dashboard_export` |
| **Análise de Retenção** | Clientes recorrentes vs. novos | **Enterprise** | `feature_retention_analytics` |
| **Lista de Risco de Churn** | Clientes com risco de abandono + WhatsApp | **Enterprise** | `feature_churn_recovery` |
| **Matriz BCG de Produtos** | Classificação estratégica do cardápio | **Enterprise** | `feature_bcg_matrix` |
| **Métricas de Buffet no Dashboard** | KPIs específicos do módulo buffet | **Enterprise** | `feature_buffet_analytics` |
| **Filtros de período avançados** | 365 dias / histórico total | **Enterprise** | `feature_advanced_date_filter` |

#### MÓDULO: COZINHA (KDS)

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Display de cozinha (KDS) | Tela de preparação em tempo real | **Core** | `feature_kitchen_display` |
| Atualização em tempo real | Supabase Realtime | **Core** | `feature_realtime_orders` |

#### MÓDULO: CONFIGURAÇÕES

| Feature | Descrição | Plano | Flag Sugerida |
|---|---|---|---|
| Configurações básicas | Nome, telefone, horários | **Core** | `feature_settings_basic` |
| Impressão térmica (settings) | Configurar papel 58mm/80mm | **Standard** | `feature_print_settings` |
| Personalização de marca | Logo, cores primárias e secundárias | **Standard** | `feature_brand_customization` |
| Múltiplas moedas/idiomas | BRL/PYG, pt/es | **Standard** | `feature_locale_settings` |

---

### 3.2 RESUMO DOS PACOTES DE VENDA

| Feature | Core | Standard | Enterprise |
|---|:---:|:---:|:---:|
| Cardápio interativo público | ✅ | ✅ | ✅ |
| Receber pedidos (kanban) | ✅ | ✅ | ✅ |
| Display de cozinha (KDS) | ✅ | ✅ | ✅ |
| KPIs básicos de dashboard | ✅ | ✅ | ✅ |
| CRUD básico de produtos | ✅ | ✅ | ✅ |
| Gerenciamento de categorias | ✅ | ✅ | ✅ |
| Configurações básicas | ✅ | ✅ | ✅ |
| — | — | — | — |
| Pedidos de mesa / QR por mesa | ❌ | ✅ | ✅ |
| Chamada de garçom | ❌ | ✅ | ✅ |
| Delivery com zonas de entrega | ❌ | ✅ | ✅ |
| Gestão de entregadores | ❌ | ✅ | ✅ |
| Notificação WhatsApp | ❌ | ✅ | ✅ |
| Impressão térmica automática | ❌ | ✅ | ✅ |
| Configuração de Pizza / Marmita | ❌ | ✅ | ✅ |
| Exportação de pedidos (CSV) | ❌ | ✅ | ✅ |
| Gráficos de faturamento e analytics | ❌ | ✅ | ✅ |
| Personalização de marca | ❌ | ✅ | ✅ |
| Múltiplos idiomas / moedas | ❌ | ✅ | ✅ |
| — | — | — | — |
| **BI: Análise de Retenção** | ❌ | ❌ | ✅ |
| **BI: Risco de Churn + WhatsApp** | ❌ | ❌ | ✅ |
| **BI: Matriz BCG de Produtos** | ❌ | ❌ | ✅ |
| **Módulo Buffet completo** | ❌ | ❌ | ✅ |
| **Inventário com preços de custo/CMV** | ❌ | ❌ | ✅ |
| **Importação/Exportação de produtos** | ❌ | ❌ | ✅ |
| **Filtros avançados de período** | ❌ | ❌ | ✅ |
| **Offline-first (buffet sem internet)** | ❌ | ❌ | ✅ |
| **Usuários adicionais (RBAC)** | ❌ | ❌ | ✅ |

---

## 4. ESTRUTURA TÉCNICA DE BLOQUEIO

### 4.1 Como o Sistema Identifica o Restaurante Atual

O sistema usa dois mecanismos complementares para identificar o tenant/restaurante ativo:

#### Mecanismo 1 — Usuário Autenticado (painel admin)
```
supabase.auth.getSession()
  → users.id → users.restaurant_id (coluna na tabela users)
    → AdminRestaurantContext.restaurantId
```

- **Arquivo-chave:** `src/store/authStore.ts` (linha 31–43)
- O `user.restaurant_id` é carregado do banco na inicialização do app
- O `AdminRestaurantContext` (`src/contexts/AdminRestaurantContext.tsx`) distribui o `restaurantId` para toda a árvore de componentes admin
- O hook `useAdminRestaurantId()` é o ponto de acesso padrão nas queries

#### Mecanismo 2 — Subdomínio da Loja (cardápio público)
```
window.location.hostname
  → getSubdomain() → tenantSlug
    → StoreLayout (tenantSlug prop)
      → consulta Supabase para buscar o restaurante pelo slug
```

- **Arquivo-chave:** `src/lib/subdomain.ts` + `src/layouts/StoreLayout.tsx`

---

### 4.2 Modelo de Dados Proposto para Feature Flags no Supabase

```sql
-- Tabela de planos disponíveis
CREATE TABLE subscription_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,         -- 'core', 'standard', 'enterprise'
  label      TEXT NOT NULL,         -- 'Básico', 'Standard', 'Enterprise'
  price_brl  NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Features disponíveis na plataforma
CREATE TABLE features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag        TEXT UNIQUE NOT NULL, -- ex: 'feature_bcg_matrix'
  label       TEXT NOT NULL,        -- ex: 'Matriz BCG de Produtos'
  description TEXT,
  min_plan    TEXT NOT NULL,        -- 'core' | 'standard' | 'enterprise'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Assinatura do restaurante (qual plano contratado)
CREATE TABLE restaurant_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES subscription_plans(id),
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'cancelled'
  started_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Feature flags extras contratadas individualmente (add-ons)
CREATE TABLE restaurant_feature_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  feature_flag  TEXT NOT NULL,     -- ex: 'feature_bcg_matrix'
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

---

### 4.3 Onde Inserir a Verificação de Features no Frontend

#### Ponto 1 — Hook Centralizado (recomendado)

Criar `src/hooks/useFeatureFlag.ts`:

```typescript
// Exemplo de implementação do hook de feature flags
import { useAdminRestaurant } from '@/contexts/AdminRestaurantContext';

// O hook consultaria o plano contratado via query no Supabase
// e retornaria se a feature está habilitada para o restaurante atual
export function useFeatureFlag(flag: string): boolean {
  const { restaurantId } = useAdminRestaurant();
  // Buscar de restaurant_subscriptions + restaurant_feature_overrides
  // com cache via TanStack Query
  // ...
}
```

**Uso nos componentes:**
```tsx
// Exemplo de uso em componente React
const hasBCG = useFeatureFlag('feature_bcg_matrix');
const hasBuffet = useFeatureFlag('feature_buffet_module');

{hasBCG && <MenuMatrixBCG ... />}
{hasBuffet && <BuffetNavItem />}
```

#### Ponto 2 — Bloqueio de Rotas (ProtectedRoute)

Estender `src/components/ProtectedRoute.tsx` com prop `requiredFeature`:

```tsx
// Exemplo de extensão do ProtectedRoute
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredFeature?: string; // Flag da feature necessária
}

// Internamente verificaria useFeatureFlag(requiredFeature)
// e redirecionaria para página de upgrade se não habilitada
```

#### Ponto 3 — Sidebar de Navegação (AdminLayout)

O arquivo `src/components/admin/AdminLayout.tsx` é o ponto central onde os itens de menu são renderizados. Aplicar `useFeatureFlag` aqui oculta o item do menu automaticamente.

```
AdminLayout.tsx
  ├── item "Buffet"        → useFeatureFlag('feature_buffet_module')
  ├── item "Entregadores"  → useFeatureFlag('feature_couriers')
  └── item "Inventário"    → useFeatureFlag('feature_inventory_cost')
```

#### Ponto 4 — Dentro dos Componentes do Dashboard

O `src/pages/admin/Dashboard.tsx` já renderiza condicionalmente alguns módulos. Os componentes de BI avançado são os candidatos mais óbvios:

| Componente | Feature Flag |
|---|---|
| `<MenuMatrixBCG />` | `feature_bcg_matrix` |
| `<ChurnRecoveryList />` | `feature_churn_recovery` |
| Seção de métricas de Buffet | `feature_buffet_analytics` |
| Botões de exportação CSV/XLSX | `feature_dashboard_export` |
| Filtros de período (365d / max) | `feature_advanced_date_filter` |

---

### 4.4 Fluxo de Verificação Recomendado

```
1. App inicializa → useAuthStore.initialize()
   └── Carrega user.restaurant_id do Supabase

2. AdminRestaurantContext recebe restaurantId

3. useFeatureFlag(flag) é chamado por qualquer componente
   └── TanStack Query: busca restaurant_subscriptions + feature_overrides
   └── Compara min_plan da feature com plano contratado
   └── Verifica se há override individual
   └── Retorna boolean (com cache)

4. Componente renderiza/oculta baseado no boolean
   OU ProtectedRoute redireciona para /upgrade
```

---

### 4.5 Estratégia de Cache e Performance

- Utilizar **TanStack Query** (já presente no projeto) para cachear o plano e as features com `staleTime: Infinity` — os dados mudam raramente.
- Invalidar o cache apenas quando o Super Admin alterar o plano de um restaurante.
- Para o painel Super Admin, a verificação de features é **bypassed** (ele tem acesso total).
- Considerar buscar as features contratadas junto com os dados do restaurante na inicialização da sessão (single query).

---

*Documento gerado com base na análise estática completa de `src/`. Última atualização: 19/02/2026.*
