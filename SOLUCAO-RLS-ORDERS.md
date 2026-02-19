# 🔧 Solução Definitiva: Erro RLS em Orders

## 🐛 Problema Identificado

O arquivo `supabase/db/scripts/rls/supabase-rls-completo.sql` **não incluía políticas de INSERT** para `orders` e `order_items`. Quando esse script era executado, ele removia as políticas públicas de INSERT que estavam no `supabase/db/schema/initial.sql`, causando o erro:

```
new row violates row-level security policy for table "orders"
```

## ✅ Solução Aplicada

### 1. Script de Correção Imediata

**Arquivo:** `supabase-fix-orders-public-insert-FINAL.sql`

Este script:
- Remove **TODAS** as políticas de `orders` e `order_items`
- Cria política pública de INSERT (`WITH CHECK (true)`) para ambos
- Recria políticas de SELECT/UPDATE para staff
- Mostra um resumo das políticas criadas

**Execute este script PRIMEIRO** no Supabase SQL Editor.

### 2. Correção Permanente

**Arquivo:** `supabase/db/scripts/rls/supabase-rls-completo.sql` (ATUALIZADO)

Atualizei este arquivo para incluir as políticas de INSERT público, garantindo que:
- Qualquer pessoa pode criar pedidos (sem autenticação)
- Qualquer pessoa pode criar itens de pedido (sem autenticação)
- Staff pode ler e atualizar pedidos do próprio restaurante

**Execute este script DEPOIS** para garantir que a correção seja permanente.

## 📋 Passos para Resolver

### Passo 1: Execute o Fix Imediato

1. Abra o **Supabase Dashboard** → **SQL Editor**
2. Execute o arquivo: `supabase-fix-orders-public-insert-FINAL.sql`
3. Verifique se apareceu: `✅ Migration aplicada!`
4. **Teste criar um pedido no frontend**

### Passo 2: Execute o RLS Completo Atualizado

1. Execute o arquivo: `supabase/db/scripts/rls/supabase-rls-completo.sql` (versão atualizada)
2. Isso garante que todas as políticas estejam corretas

### Passo 3: Teste Manual (Opcional)

Execute o arquivo: `supabase-test-orders-insert.sql` para verificar se está funcionando.

## 🔍 Verificação

No Supabase Dashboard:
1. Vá em **Authentication** → **Policies**
2. Selecione a tabela `orders`
3. Verifique se existe a política **"Anyone can create orders"**
4. Confirme que `WITH CHECK` está como `true`

## ⚠️ Importante

- **Nunca** execute `supabase/db/scripts/rls/supabase-rls-completo.sql` sem a versão atualizada (que inclui INSERT público)
- Se executar scripts antigos, execute `supabase-fix-orders-public-insert-FINAL.sql` novamente
- Sempre teste após executar migrations SQL

## 🎯 Resultado Esperado

Após executar os scripts:
- ✅ Qualquer pessoa pode acessar o cardápio público
- ✅ Qualquer pessoa pode criar pedidos (sem login)
- ✅ Staff pode ver e gerenciar pedidos do próprio restaurante
- ✅ Super admin pode ver e gerenciar todos os pedidos
