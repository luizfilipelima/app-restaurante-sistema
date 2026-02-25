# Relatório: Frontend do Painel do Restaurante

**Objetivo:** Verificar todas as telas do painel em busca de erros, features em conflito e problemas que afetem integração, solidez e consistência do sistema.

**Escopo:** Rotas admin (`adminRoutes`), layout, RBAC, features, Orders vs Caixa, tratamento de `restaurantId` e fluxos críticos.

---

## 1. Resumo executivo

- **Integração geral:** O painel está integrado de forma coerente: rotas, layout, RBAC e features estão alinhados na maior parte dos fluxos.
- **Problema principal:** A rota **Caixa** (e, em menor grau, **Comanda QR**) não aplica proteção por feature na rota, ao contrário de Buffet, Mesas, Reservas, Zonas e Entregadores. Isso permite acesso direto pela URL mesmo sem a feature, gerando inconsistência de UX e segurança.
- **Recomendações:** Proteger as rotas Caixa e Comanda QR com `requiredFeature="feature_virtual_comanda"` e, se houver uso de painel por super_admin em outros restaurantes, garantir que a checagem de feature use o restaurante “em uso” (da URL), não apenas `user.restaurant_id`.

---

## 2. Rotas do painel (App.tsx)

| Rota | Proteção de role | Proteção de feature na rota |
|------|-------------------|-----------------------------|
| dashboard | manager, owner, restaurant_admin, super_admin | — |
| orders | waiter, manager, owner, restaurant_admin, super_admin | — |
| menu | manager, owner, restaurant_admin, super_admin | — |
| offers | manager, owner, restaurant_admin, super_admin | — |
| coupons | manager, owner, restaurant_admin, super_admin | — |
| loyalty | manager, owner, restaurant_admin, super_admin | — |
| inventory | manager, owner, restaurant_admin, super_admin | — |
| buffet | manager, owner, restaurant_admin, super_admin | **feature_buffet_module** |
| products | manager, owner, restaurant_admin, super_admin | — |
| tables | manager, owner, restaurant_admin, super_admin | **feature_tables** |
| reservations | manager, owner, restaurant_admin, super_admin | **feature_reservations** |
| delivery-zones | manager, owner, restaurant_admin, super_admin | **feature_delivery_zones** |
| horarios | manager, owner, restaurant_admin, super_admin | — |
| couriers | manager, owner, restaurant_admin, super_admin | **feature_couriers** |
| settings | manager, owner, restaurant_admin, super_admin | — |
| **cashier** | cashier | **Nenhuma** (apenas FeatureGuard dentro da página) |
| comanda-qr | cashier | **Nenhuma** (apenas FeatureGuard dentro da página) |
| upgrade | owner, restaurant_admin, super_admin | — |

---

## 3. Inconsistência: Caixa e Comanda QR

- **Comportamento atual**
  - No **menu lateral**, o item “Caixa” usa `featureFlag: 'feature_virtual_comanda'`. Sem a feature, o item aparece bloqueado e leva para a página de upgrade.
  - Ao acessar **diretamente** `/cashier` (ou `/:slug/painel/cashier`), o usuário **entra na tela** e só então vê o `FeatureGuard` com o banner de upgrade.
- **Problema**
  - Em Buffet, Mesas, Reservas, Zonas e Entregadores, a **rota** já exige a feature (`ProtectedRoute requiredFeature="..."`). Quem não tem a feature é **redirecionado** antes de ver o conteúdo.
  - Em Caixa (e Comanda QR) a proteção é **apenas dentro da página**. Isso gera:
    - UX inconsistente (às vezes bloqueio no menu, às vezes entrada + banner).
    - Risco de vazamento de layout/funcionalidade antes do guard.

**Recomendação:** Envolver as rotas `cashier` e `comanda-qr` com `ProtectedRoute requiredFeature="feature_virtual_comanda"`, da mesma forma que as demais rotas por feature, para bloquear na rota e redirecionar para upgrade quando o restaurante não tiver a feature.

---

## 4. RBAC e features

- **Roles:** `useUserRole` / `useCanAccess` usam `restaurant_user_roles` com fallback em `users.role`. Hierarquia considerada: kitchen &lt; waiter &lt; cashier &lt; manager &lt; owner/restaurant_admin &lt; super_admin.
- **Features:** `useFeatureAccess` chama a RPC `restaurant_has_feature(restaurant_id, flag)`. Os labels no `FeatureGuard` e no menu batem com os planos (Standard/Enterprise) e com o seed das migrations (ex.: feature_reservations = enterprise; feature_tables, feature_couriers, feature_delivery_zones = standard; feature_virtual_comanda, feature_buffet_module = enterprise).
- **Settings – Gestão de usuários:** A aba de usuários usa `useCanAccess(ROLES_USERS_MANAGEMENT)` com `['owner', 'restaurant_admin', 'super_admin']`. Apenas esses cargos veem o painel de usuários; o restante da tela de configurações continua acessível conforme a rota. Sem conflito identificado.

---

## 5. Restaurante “em uso” e super_admin

- **Layout:** `restaurantId` no `AdminLayout` vem de `managedRestaurantId || user?.restaurant_id || null`. Quando não há restaurante selecionado, é exibido “Nenhum restaurante selecionado.”.
- **ProtectedRoute:** A checagem de feature usa `restaurantId = user?.restaurant_id ?? null`. Em contexto **super_admin** (ex.: `/super-admin/restaurants/:id/...`), o restaurante “em uso” pode ser o da URL (`managedRestaurantId`), não o `user.restaurant_id` (que pode ser null).
- **Risco:** Para super_admin gerenciando outro restaurante, a verificação de feature pode estar usando o restaurante errado (ou null), podendo bloquear ou liberar rotas de forma incorreta.
- **Recomendação:** Garantir que, em rotas super-admin, o `ProtectedRoute` (e qualquer checagem de feature no painel) use o `restaurantId` do contexto atual (ex.: `managedRestaurantId` quando existir), e não apenas `user.restaurant_id`.

---

## 6. Orders vs Caixa

- **Orders (Kanban):** Usa `orderSourceFilter: 'delivery_pickup_only'`. O Kanban mostra apenas pedidos de delivery e retirada; pedidos de mesa/comanda/buffet não aparecem. Coerente com o propósito da tela.
- **Concluídos (Orders):** `useCompletedOrders` filtra por `status = completed`, exclui mesa/comanda (`table_id` e `virtual_comanda_id` nulos) e restringe a `order_source` delivery/pickup. Alinhado ao Kanban.
- **Caixa:** Focado em mesa/comanda/buffet; não há sobreposição conflituosa com Orders. Ao cancelar pedido de comanda, o código que chama `reset_virtual_comanda` está presente em Orders; com o filtro atual, pedidos de comanda não aparecem no Kanban, então esse fluxo não é atingido na prática hoje. Nenhum conflito ativo identificado.

---

## 7. Páginas e `restaurantId`

- Várias páginas (Dashboard, Menu, Caixa, Buffet, Orders, etc.) fazem `if (!restaurantId) return` ou desabilitam queries com `enabled: !!restaurantId`. O layout já trata a ausência de `restaurantId` com a mensagem “Nenhum restaurante selecionado.”, mantendo o comportamento consistente.

---

## 8. AdminLayoutWrapper e resolução do restaurante

- O wrapper resolve `identifier`/`slug` da URL para o UUID do restaurante (`useResolveRestaurantId`) e define o `basePath` (ex.: `/:slug/painel`, `/admin`, `/super-admin/restaurants/:identifier`). Enquanto a resolução está em andamento, é exibido “Carregando restaurante...”. Para a rota legada `/admin` (sem slug), o `resolveTarget` pode ser null e o `restaurantId` do layout vem de `user?.restaurant_id`. Comportamento esperado e sem erro aparente.

---

## 9. Tratamento de erros e feedback

- Em várias telas (ex.: Menu, Buffet) há uso de `toast` com `variant: 'destructive'` para erros de carregamento e salvamento. Não foi encontrada inconsistência que quebre a integração; em algumas páginas o tratamento de `isError` das queries poderia ser mais uniforme (melhoria de UX, não bloqueante).

---

## 10. Checklist de consistência

| Item | Status |
|------|--------|
| Rotas admin mapeadas e protegidas por role | OK |
| Buffet, Tables, Reservations, delivery-zones, Couriers com feature na rota | OK |
| Caixa e Comanda QR com feature na rota | **Faltando** |
| Menu lateral reflete features e roles | OK |
| RBAC (useUserRole / useCanAccess) alinhado às rotas | OK |
| Orders = delivery/retirada; Caixa = mesa/comanda/buffet | OK |
| Concluídos (Orders) alinhado ao filtro do Kanban | OK |
| Layout com “Nenhum restaurante selecionado” quando sem restaurantId | OK |
| FeatureGuard e planos (Standard/Enterprise) consistentes com DB | OK |
| Uso do restaurante “em uso” em contexto super_admin na checagem de feature | A revisar |

---

## 11. Ações recomendadas (aguardando sua confirmação)

1. **Prioritário:** Adicionar `ProtectedRoute requiredFeature="feature_virtual_comanda"` nas rotas `cashier` e `comanda-qr` em `App.tsx`, mantendo o `RoleProtectedRoute` interno, para alinhar o bloqueio ao restante das rotas por feature.
2. **Recomendado:** Garantir que a checagem de feature em `ProtectedRoute` (e onde mais for relevante) use o `restaurantId` do contexto atual quando o usuário for super_admin e estiver gerenciando outro restaurante (ex.: usar `managedRestaurantId` quando disponível).
3. **Opcional:** Padronizar o tratamento de erro de queries (`isError`) nas telas do painel para mensagens e estados de tela mais uniformes.

---

**Conclusão:** O painel está integrado e consistente na maior parte dos fluxos. A única inconsistência sólida identificada é a **falta de proteção por feature na rota** para Caixa e Comanda QR. As demais recomendações melhoram robustez (super_admin) e UX (erros).  

**Aguardando sua confirmação para implementar as alterações.**
