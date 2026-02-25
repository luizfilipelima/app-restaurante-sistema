# Padrão de UI do Painel Admin

Este documento define o padrão visual e de componentes do **painel do restaurante** (admin). Todas as telas do painel devem seguir estes critões para manter identidade coesa, experiência consistente e manutenção simples.

---

## Passo 5 — Checklist por página (auditoria e refatoração)

**Objetivo:** Garantir que cada página do painel use os mesmos componentes e tokens de tema.

### O que foi feito (auditoria completa)

1. **Listagem das rotas do painel**
   - Dashboard, Central do Cardápio (Menu), Mesas, Caixa, Cupons, Ofertas, Fidelidade, Gestão de Delivery (Pedidos), Entregadores, Zonas de Entrega, Horários, Estoque, Buffet, Reservas, Configurações (e telas compartilhadas: Upgrade, Terminal do Garçom, Comanda QR Code).

2. **Por página, aplicado:**
   - **Título + descrição + ações** → uso de **`AdminPageHeader`** (com ou sem ícone, conforme a tela).
   - **Ícone** → mesmo ícone da sidebar quando fizer sentido (ex.: Dashboard = LayoutDashboard, Cardápio = UtensilsCrossed, Caixa = ScanBarcode).
   - **Cards e blocos de conteúdo** → uso de **`admin-card`** ou **`admin-metric-card`** (ou `Card` com classe **`admin-card-border`** quando for necessário manter a estrutura CardHeader/CardContent).
   - **Remoção** de classes locais de borda/raio que conflitam com o tema (ex.: `rounded-2xl border border-border` substituído por `admin-card-border`).
   - **Conteúdo** sempre dentro de **`AdminPageLayout`** (já aplicado no Passo 3).

3. **Resultado**
   - Todas as páginas listadas usam `AdminPageHeader` e `AdminPageLayout`, incluindo **QR Code da Comanda** (`/comanda-qr`) e **Planos & Assinatura** (`/upgrade`).
   - Cards e painéis usam o tema admin (variáveis CSS e classes `.admin-card`, `.admin-metric-card`, `.admin-card-border`).

---

## Passo 6 — Documentar e manter

**Objetivo:** Deixar registrado o padrão e incluir a verificação no fluxo de desenvolvimento.

### Regras obrigatórias para novas páginas do painel

1. **Layout da página**
   - Envolver o conteúdo da página em **`AdminPageLayout`** (ou passar `className` quando precisar de espaçamento extra, ex.: `className="pb-10"`).

2. **Cabeçalho da página**
   - Usar **`AdminPageHeader`** com:
     - `title` (obrigatório)
     - `description` (opcional)
     - `icon` (opcional, LucideIcon; preferir o mesmo ícone da sidebar)
     - `actions` (opcional: botões, filtros, etc.)

   Exemplo:
   ```tsx
   import { AdminPageHeader, AdminPageLayout } from '@/components/admin/_shared';
   import { UtensilsCrossed } from 'lucide-react';

   <AdminPageLayout>
     <AdminPageHeader
       title="Minha Página"
       description="Breve descrição ou subtítulo."
       icon={UtensilsCrossed}
       actions={<Button>Ação</Button>}
     />
     {/* resto do conteúdo */}
   </AdminPageLayout>
   ```

3. **Cards e blocos de conteúdo**
   - Para blocos de conteúdo (métricas, listas, formulários em painel):
     - Preferir **`<div className="admin-card p-5">`** (ou `p-6`) para containers.
     - Para KPIs/métricas: **`<div className="admin-metric-card">`**.
   - Se precisar da estrutura do shadcn (CardHeader, CardContent, CardFooter), usar **`<Card className="admin-card-border">`** e manter o restante do layout.

4. **Bordas e raios**
   - Não usar `rounded-2xl border border-border` em cards do painel.
   - Usar **`admin-card-border`** para borda e raio padrão do painel, ou as classes **`admin-card`** / **`admin-metric-card`** que já incluem borda e sombra.

5. **Tema (tokens)**
   - Cores e espaçamentos do painel estão em **`src/index.css`**:
     - Variáveis `--admin-page-title`, `--admin-page-description`, `--admin-card-border`, `--admin-card-radius`, etc.
     - Classes utilitárias: `.admin-page-title`, `.admin-page-description`, `.admin-card`, `.admin-metric-card`, `.admin-card-border`.

### Code review

- Em PRs que alteram ou criam páginas do painel, verificar: **“As telas seguem o padrão em `docs/ADMIN-UI.md`?”** (uso de `AdminPageLayout`, `AdminPageHeader` e classes de card/borda do tema admin).

---

## Referência rápida

| Elemento            | Uso |
|---------------------|-----|
| **AdminPageLayout** | Wrapper da página; `space-y-6` por padrão; aceita `className` (ex.: `pb-10`). |
| **AdminPageHeader** | Título + descrição + ícone opcional + ações. |
| **admin-card**      | Bloco de conteúdo com borda, sombra e hover. |
| **admin-metric-card** | Card de KPI/métrica (padding e borda padrão). |
| **admin-card-border** | Apenas borda e raio do tema (para Card ou qualquer container). |
| **Tema**            | Variáveis e classes em `src/index.css` (seção “Admin Panel”). |

---

## Histórico

- **Passos 1–4:** Tema do painel (tokens), AdminPageHeader, AdminPageLayout, padronização de bordas/raios.
- **Passo 5:** Auditoria e aplicação de AdminPageHeader e padrão de cards em todas as páginas do painel.
- **Passo 6:** Este guia e regra de code review.
