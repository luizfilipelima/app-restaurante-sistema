# 🚀 Instruções Rápidas: Corrigir Erro RLS Orders

## ⚡ Execute este script primeiro:

**Arquivo:** `supabase-migration-orders-insert-public-SOLUCAO-COMPLETA.sql`

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor** → **New query**
3. Copie TODO o conteúdo do arquivo `supabase-migration-orders-insert-public-SOLUCAO-COMPLETA.sql`
4. Cole no SQL Editor
5. Clique em **Run** (ou pressione Ctrl+Enter)
6. Verifique se apareceu a mensagem: `✅ Migration completa!`
7. **Teste criar um pedido no frontend**

## 📋 Se ainda não funcionar:

### 1. Compartilhe o resultado do diagnóstico

Execute o arquivo `supabase-diagnostico-rls-orders.sql` e me envie o resultado completo (todas as políticas listadas).

### 2. Teste manual no SQL Editor

Execute este comando substituindo `RESTAURANT_ID_AQUI` por um ID válido:

```sql
INSERT INTO orders (restaurant_id, customer_name, customer_phone, total_price, status)
VALUES (
  'RESTAURANT_ID_AQUI'::uuid,
  'Teste Manual',
  '11999999999',
  50.00,
  'pending'
);
```

**Se este INSERT funcionar**, o problema pode estar no frontend (dados sendo enviados incorretamente).

**Se este INSERT NÃO funcionar**, o problema é definitivamente RLS e precisamos ver o resultado do diagnóstico.

### 3. Verifique variáveis de ambiente

Certifique-se de que o arquivo `.env` (ou `.env.local`) contém:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

⚠️ **IMPORTANTE**: Use a **chave ANON** (não a service_role key) no frontend.

### 4. Verifique no Dashboard

No Supabase Dashboard:
1. Vá em **Authentication** → **Policies**
2. Selecione a tabela `orders`
3. Verifique se existe a política **"Anyone can create orders"**
4. Clique nela e confirme que `WITH CHECK` está como `true`

## 🔍 Possíveis problemas:

1. **Política FOR ALL bloqueando**: Se houver uma política `FOR ALL` sem `WITH CHECK (true)`, ela pode bloquear INSERTs
2. **Ordem das políticas**: Às vezes a ordem importa (mas raro)
3. **Trigger ou constraint**: Pode haver um trigger que está bloqueando

## ✅ O que o script faz:

- Remove TODAS as políticas de `orders` e `order_items`
- Cria política pública de INSERT (`WITH CHECK (true)`)
- Recria políticas de SELECT/UPDATE para staff
- Mostra um resumo das políticas criadas
