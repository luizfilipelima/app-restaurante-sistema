# Diagnóstico e Otimizações de Performance

## Problemas identificados e correções aplicadas

### 1. **Bundle inicial gigante no StoreLayout (subdomínios)** ✅ CORRIGIDO

**Problema:** O `StoreLayout` (usado em `meatburger.quiero.food`) importava todas as páginas públicas de forma estática. Ao visitar o cardápio, o usuário carregava:
- PublicMenu, PublicCheckout (com Leaflet), MenuViewOnly, MenuTable, VirtualComanda, OrderTracking, OrderConfirmation, LinkBio

**Impacto:** Bundle inicial de ~605 KB (166 KB gzip) para qualquer visita.

**Solução:** Rotas convertidas para `lazyWithRetry()`. Cada página carrega apenas quando o usuário navega para ela.

**Resultado:** Bundle inicial reduzido para ~200 KB (61 KB gzip). Cardápio carrega apenas o chunk do Menu (~117 KB).

---

### 2. **Leaflet CSS carregado globalmente** ✅ CORRIGIDO

**Problema:** `main.tsx` importava `leaflet/dist/leaflet.css` para todos os usuários. Leaflet só é usado no Checkout (MapAddressPicker).

**Impacto:** ~15 KB de CSS desnecessário para quem visita cardápio ou bio.

**Solução:** Removido de `main.tsx`. Import adicionado em `MapAddressPicker.tsx` — carrega apenas quando o usuário vai ao Checkout e o mapa é exibido.

---

### 3. **Query do cardápio — muitas requisições paralelas** ✅ CORRIGIDO

**Problema:** O `useRestaurantMenuData` executava 11+ queries Supabase em paralelo (restaurante, categorias, subcategorias, produtos, pizza sizes/flavors/doughs/edges, marmita sizes/proteins/sides, combos, adicionais).

**Solução:** RPC `get_restaurant_menu(p_slug text)` criada em `supabase/db/migrations/20260287_get_restaurant_menu_rpc.sql`. Retorna todos os dados em uma única chamada: restaurante, produtos, categorias, subcategorias, pizza, marmita, combos e adicionais.

**Resultado:** Uma única requisição HTTP em vez de 11+. O hook usa a RPC e faz fallback para o método antigo em caso de erro.

---

### 4. **Imagens de produtos** ✅ CORRIGIDO

**Problema:** Imagens sem `loading="lazy"` e sem `width`/`height` causavam layout shift (CLS).

**Solução aplicada:**
- `ProductCard.tsx`, `ProductCardViewOnly.tsx`: `loading="lazy"` + `width`/`height` em imagens de produtos
- `ProductAddonModal.tsx`, `CartDrawer.tsx`: idem
- `Menu.tsx`, `MenuViewOnly.tsx`: logos do restaurante com `width`/`height`; logo Quiero.food no rodapé com `loading="lazy"` + `width`/`height`
- `Checkout.tsx`: logo do restaurante com `width`/`height`

---

### 5. **Recharts e XLSX no bundle admin** ✅ VERIFICADO

- `vendor-recharts` (412 KB) e `vendor-xlsx` (282 KB) estão em chunks separados no `vite.config.ts`
- Páginas admin (Dashboard, Inventory, SaasMetrics, etc.) usam `lazyWithRetry()` — Recharts e XLSX só carregam quando o usuário navega para essas rotas
- Usuários do cardápio público não carregam esses chunks

---

### 6. **Ícones Lucide** ✅ VERIFICADO

- `lucide-react` em manualChunk (`vendor-lucide`)
- Imports são nomeados (`import { X, Y } from 'lucide-react'`) — tree-shaking preservado
- Nenhum `import * as Icons from 'lucide-react'` encontrado

---

---

### 7. **N+1 queries na RPC `get_restaurant_menu`** ✅ CORRIGIDO

**Problema:** A versão anterior da função usava correlated subqueries em 3 lugares críticos:
- **Ordenação de produtos**: `ORDER BY (SELECT order_index FROM categories WHERE name = p.category ...)` — executado 1 vez por produto
- **Array de categorias**: CTE + correlated subquery por categoria para buscar `order_index`
- **Mapa de adicionais**: scalar correlated subquery por `addon_group` para buscar seus items

**Solução** (`20260288_fix_get_restaurant_menu_n1_queries.sql`):
- Produtos: `LEFT JOIN categories` na própria query — 1 JOIN ao invés de N subqueries
- Categorias: `GROUP BY p.category + LEFT JOIN categories` direto na tabela `products`
- Adicionais: `LEFT JOIN LATERAL` — 1 scan ao invés de N correlated subqueries

---

### 8. **`framer-motion` no bundle inicial do cardápio** ✅ CORRIGIDO

**Problema:** `CartDrawer`, `PizzaModal`, `MarmitaModal` e `ProductAddonModal` eram importados de forma estática em `Menu.tsx`, forçando o carregamento do `framer-motion` (~400 KB) mesmo antes do usuário interagir.

**Solução:** Todos convertidos para `lazy()` + `<Suspense>` — o chunk do framer-motion só carrega quando o carrinho ou modal é aberto pela primeira vez.

---

### 9. **`useActiveOffers` fazia 2 requests HTTP** ✅ CORRIGIDO

**Problema:** `fetchActiveOffersBySlug` buscava o restaurante pelo slug (1 request) e depois buscava as ofertas (2º request). No `Menu.tsx`, o `restaurant.id` já estava disponível via `menuData`.

**Solução:** Criado `useActiveOffersByRestaurantId(restaurantId)` que usa o ID direto. `Menu.tsx` atualizado para usar este hook com `menuData?.restaurant?.id`, eliminando 1 round-trip HTTP.

---

### 10. **`ProductCard` sem `React.memo`** ✅ CORRIGIDO

**Problema:** Toda vez que o contador do carrinho mudava, o componente pai (`Menu.tsx`) re-renderizava, recriando todos os `ProductCard`s mesmo sem mudança nos dados dos produtos.

**Solução:** `ProductCard` envolvido com `memo()` — só re-renderiza quando suas props mudam.

---

### 11. **`filteredProducts` sem `useMemo` + busca desconectada** ✅ CORRIGIDO

**Problema:** O cálculo de `filteredProducts` recalculava em todo render. Além disso, o campo de busca existia na UI mas não filtrava os produtos.

**Solução:** `filteredProducts` agora usa `useMemo([products, selectedCategory, searchQuery])`. O input de busca foi conectado ao estado `searchQuery` e filtra por nome e descrição.

---

### 12. **Sem `preconnect` para o Supabase** ✅ CORRIGIDO

**Problema:** O browser iniciava a conexão TCP+TLS com o Supabase apenas quando o JS chamava o primeiro request, adicionando ~100-300 ms de latência em conexões lentas.

**Solução:** Adicionado `<link rel="preconnect" href="%VITE_SUPABASE_URL%" crossorigin />` e `<link rel="dns-prefetch" href="%VITE_SUPABASE_URL%" />` no `index.html`. O Vite substitui a variável em build time.

---

## Como medir

```bash
npm run build
# Ver tamanhos em dist/assets/
# Focar em index-*.js (bundle inicial) e chunks de rotas públicas
```

Ferramentas úteis:
- Lighthouse (Chrome DevTools)
- WebPageTest
- Bundle Analyzer: `vite-bundle-visualizer` ou `rollup-plugin-visualizer`
