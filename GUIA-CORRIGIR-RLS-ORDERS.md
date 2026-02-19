# 🔧 Guia: Corrigir Erro RLS em Orders

## Erro Atual
```
new row violates row-level security policy for table "orders"
```

## ⚡ SOLUÇÃO RÁPIDA (Execute esta primeiro)

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o arquivo: **`supabase/db/scripts/fixes/migration_orders-insert-public-DEFINITIVO.sql`**
3. Este script:
   - Remove TODAS as políticas de INSERT conflitantes
   - Cria políticas públicas com `WITH CHECK (true)` 
   - Verifica se há políticas FOR ALL bloqueando
4. Teste criar um pedido no frontend

## Passo 1: Diagnóstico (Execute primeiro)

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o arquivo: `supabase-diagnostico-rls-orders.sql`
3. Isso mostrará **todas as políticas** ativas em `orders` e `order_items`
4. **Anote** quais políticas existem, especialmente políticas `FOR ALL`

## Passo 2: Tentar Solução Normal

1. Execute o arquivo: `supabase/db/scripts/fixes/migration_orders-insert-public-FINAL.sql`
2. Este script remove **apenas** políticas de INSERT e cria uma nova pública
3. Teste criar um pedido no frontend

## Passo 3: Se ainda não funcionar - Solução FORCE

⚠️ **ATENÇÃO**: Esta solução remove TODAS as políticas e recria apenas as essenciais.

1. Execute o arquivo: `supabase/db/scripts/fixes/migration_orders-insert-public-FORCE.sql`
2. Este script:
   - Remove TODAS as políticas de `orders` e `order_items`
   - Cria política pública de INSERT (qualquer um pode criar pedidos)
   - Recria políticas de SELECT/UPDATE para staff
3. Teste criar um pedido no frontend

## Passo 4: Verificar Variáveis de Ambiente

Certifique-se de que o arquivo `.env` (ou `.env.local`) contém:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**IMPORTANTE**: Use a **chave ANON** (não a service_role key) no frontend.

## Passo 5: Verificar no Supabase Dashboard

1. Vá em **Authentication** → **Policies**
2. Selecione a tabela `orders`
3. Verifique se existe uma política chamada **"Anyone can create orders"**
4. Clique nela e verifique se `WITH CHECK` está como `true`

## Passo 6: Teste Manual no SQL Editor

Execute este teste para verificar se funciona:

```sql
-- Simular criação de pedido (sem autenticação)
INSERT INTO orders (restaurant_id, customer_name, customer_phone, total_price, status)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid, -- substitua por um restaurant_id válido
  'Teste',
  '11999999999',
  50.00,
  'pending'
);
```

Se este INSERT funcionar, o problema pode estar no frontend (dados sendo enviados incorretamente).

## Possíveis Causas Adicionais

1. **Política FOR ALL**: Se houver uma política `FOR ALL` em `orders` que não inclua `WITH CHECK (true)`, ela pode bloquear INSERTs mesmo com política específica de INSERT.

2. **Trigger ou Constraint**: Verifique se há triggers ou constraints que possam estar bloqueando.

3. **Dados Inválidos**: O erro pode ser mascarado. Verifique se todos os campos obrigatórios estão sendo enviados corretamente.

## Se NADA funcionar

Execute este comando para desabilitar RLS temporariamente (apenas para teste):

```sql
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
```

⚠️ **NÃO deixe RLS desabilitado em produção!** Isso é apenas para confirmar que o problema é RLS.
