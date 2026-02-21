# Planos e Features — Quiero.Food

> **Referência:** `ARCHITECTURE.md` · `ARQUITETURA_PRODUTO_E_PLANOS.md` · Migrations `20260219`, `20260296`, `20260297`

---

## Os Três Planos

| Plano | Público-Alvo | Preço (BRL) | Preço (PYG) |
|-------|--------------|-------------|-------------|
| **Core** | Restaurante pequeno, primeiro contato | R$ 0,00 | Gratuito |
| **Standard** | Restaurante em crescimento | R$ 149,90/mês | ₲ 390.000/mês |
| **Enterprise** | Redes de restaurantes, alto volume | R$ 349,90/mês | ₲ 900.000/mês |

---

## Core — Básico

Cardápio digital, recebimento de pedidos, KDS e KPIs essenciais.

### Cardápio Público
- Cardápio interativo público (produtos, carrinho)
- Cardápio somente leitura (vitrine)

### Pedidos
- Kanban de pedidos (Pendente, Preparo, Pronto, Entrega)
- Atualizar status de pedido
- Cancelar pedido

### Cardápio Admin
- CRUD básico de produtos
- Ativar/desativar produto
- Gerenciamento de categorias

### Cozinha (KDS)
- Display de cozinha em tempo real
- Atualização em tempo real (Supabase Realtime)

### Dashboard
- KPIs básicos (pedidos, faturamento, ticket médio)

### Configurações
- Configurações básicas (nome, telefone, horários)

---

## Standard — Intermediário

Tudo do Core + mesas com QR, delivery, entregadores, WhatsApp, analytics e impressão térmica.

### Cardápio Público
- Tudo do Core
- Cardápio por mesa (QR individual)
- Personalização de cores (primária e secundária)
- Múltiplos idiomas (pt/es)
- Múltiplas moedas (BRL/PYG)
- Geração de QR Codes (cardápio e mesas)
- Logo personalizado (upload)

### Pedidos
- Tudo do Core
- Pedidos de mesa (sem WhatsApp)
- Canal delivery (entrega em domicílio)
- Atribuição de entregador ao pedido
- Notificação WhatsApp ao cliente
- Impressão térmica automática (58mm/80mm)
- Exportar pedidos (CSV)

### Cardápio Admin
- Tudo do Core
- Subcategorias
- Reordenamento drag & drop (produtos e categorias)
- Duplicar produto
- Configuração de Pizza (tamanhos, massas, bordas)
- Configuração de Marmita (tamanhos, proteínas, acompanhamentos)
- Upload de imagem de produto (WebP)

### Mesas
- Gerenciamento de mesas
- QR Code por mesa
- Chamada de garçom (cliente chama pelo celular)
- Histórico de chamadas

### Entregadores
- Gestão de entregadores (CRUD)
- Status do entregador (Disponível / Ocupado / Offline)

### Zonas de Entrega
- Zonas de entrega com taxa (por bairro/região)
- Seleção de zona no checkout

### Dashboard
- Tudo do Core
- Gráfico de faturamento diário
- Análise por canal (Delivery, Mesa, Retirada, Buffet)
- Análise de métodos de pagamento
- Exportar relatórios (CSV/XLSX)

### Configurações
- Tudo do Core
- Configuração de impressão (papel, auto-print)
- Personalização de marca (logo, cores)
- Configurações de localidade (moeda, idioma)

---

## Enterprise — Avançado

Tudo do Standard + BI avançado, Buffet offline, inventário com CMV e RBAC completo.

### Buffet / Comandas
- Módulo Buffet completo (comandas, scanner, fechamento)
- Operação offline (IndexedDB, sincroniza ao reconectar)
- Scanner de código de barras
- Produtos por peso (venda por grama)

### Inventário
- Inventário com preço de custo (CMV, margens)
- Importar produtos via CSV
- Exportar produtos via CSV

### Dashboard / BI
- Tudo do Standard
- Análise de retenção de clientes
- Risco de Churn + recuperação via WhatsApp
- Matriz BCG de Produtos
- Métricas de Buffet no dashboard
- Filtros avançados de período (365 dias / histórico total)

### RBAC
- Múltiplos usuários com cargos (owner, manager, waiter, kitchen, cashier)
- Controle granular de permissões por tela

---

## Resumo Visual

| Feature | Core | Standard | Enterprise |
|---------|:----:|:--------:|:----------:|
| Cardápio interativo público | ✅ | ✅ | ✅ |
| Receber pedidos (Kanban) | ✅ | ✅ | ✅ |
| Display de Cozinha (KDS) | ✅ | ✅ | ✅ |
| KPIs básicos de dashboard | ✅ | ✅ | ✅ |
| CRUD de produtos e categorias | ✅ | ✅ | ✅ |
| Configurações básicas | ✅ | ✅ | ✅ |
| Pedidos de mesa + QR por mesa | ❌ | ✅ | ✅ |
| Chamada de garçom digital | ❌ | ✅ | ✅ |
| Delivery com zonas de entrega | ❌ | ✅ | ✅ |
| Gestão de entregadores | ❌ | ✅ | ✅ |
| Notificação WhatsApp | ❌ | ✅ | ✅ |
| Impressão térmica automática | ❌ | ✅ | ✅ |
| Configuração de Pizza / Marmita | ❌ | ✅ | ✅ |
| Exportação de pedidos (CSV) | ❌ | ✅ | ✅ |
| Gráficos e analytics | ❌ | ✅ | ✅ |
| Personalização de marca | ❌ | ✅ | ✅ |
| Multi-idioma / Multi-moeda | ❌ | ✅ | ✅ |
| BI: Análise de Retenção | ❌ | ❌ | ✅ |
| BI: Risco de Churn + WhatsApp | ❌ | ❌ | ✅ |
| BI: Matriz BCG de Produtos | ❌ | ❌ | ✅ |
| Módulo Buffet completo (offline) | ❌ | ❌ | ✅ |
| Inventário com CMV e margens | ❌ | ❌ | ✅ |
| Importação/Exportação de produtos | ❌ | ❌ | ✅ |
| Filtros avançados de período | ❌ | ❌ | ✅ |
| RBAC granular (múltiplos usuários) | ❌ | ❌ | ✅ |

---

*Documento gerado com base no banco de dados e documentação do projeto.*
