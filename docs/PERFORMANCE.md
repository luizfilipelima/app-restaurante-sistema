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

## Otimizações recomendadas (não implementadas)

### 3. **Query do cardápio — muitas requisições paralelas**

O `useRestaurantMenuData` executa 11 queries Supabase em paralelo. Considerar:
- Criar uma RPC `get_restaurant_menu(slug)` que retorna todos os dados em uma única chamada.
- Ou manter o padrão atual se a latência estiver aceitável (queries paralelas podem ser mais rápidas que uma RPC pesada).

### 4. **Imagens de produtos**

- Usar `loading="lazy"` em todas as `<img>` de produtos.
- Considerar CDN com resize (ex: Supabase Storage com transform) para servir thumbs menores na listagem.
- Adicionar `width` e `height` para evitar layout shift (CLS).

### 5. **Recharts e XLSX no bundle admin**

- `vendor-recharts` (412 KB) e `xlsx` (282 KB) são carregados em rotas admin.
- Garantir que essas bibliotecas estejam em chunks separados e só carreguem nas rotas que as usam (Dashboard, exportações).

### 6. **Ícones Lucide**

- `lucide-react` (63 KB no chunk) — já está em manualChunks.
- Verificar se não há imports do tipo `import * as Icons from 'lucide-react'` que impedem tree-shaking.

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
