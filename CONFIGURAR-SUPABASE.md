# Guia completo: configuração do Supabase

Este guia explica passo a passo como configurar o Supabase para o sistema de restaurantes funcionar **sem erros** ao adicionar zonas de entrega, produtos, cardápio, etc.

---

## Por que dava erro?

1. **Row Level Security (RLS)** exige políticas explícitas para cada operação (SELECT, INSERT, UPDATE, DELETE).
2. Para **INSERT**, o PostgreSQL exige a cláusula **WITH CHECK** (não basta só **USING**). Sem isso, criar novos registros falha.
3. As tabelas de **pizza** (tamanhos, sabores, massas, bordas) e **zonas de entrega** não tinham política de escrita para o admin do restaurante.

O script `supabase-rls-completo.sql` corrige tudo isso.

---

## Ordem recomendada

| # | O quê | Arquivo / Onde |
|---|--------|-----------------|
| 1 | Criar projeto e obter chaves | Dashboard Supabase |
| 2 | Criar tabelas e RLS básico | `supabase-schema.sql` |
| 3 | Usuário conseguir logar | política "Users can read own profile" (já está no schema) |
| 4 | Admin poder criar produtos, zonas, pizzas | `supabase-rls-completo.sql` |
| 5 | (Opcional) Criar super admin | `supabase-criar-super-admin.sql` |
| 6 | (Opcional) Super admin gerenciar qualquer restaurante | já incluso no `supabase-rls-completo.sql` |

---

## Passo 1: Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login.
2. **New project** → escolha organização, nome do projeto, senha do banco (guarde a senha).
3. Aguarde o projeto ficar pronto (alguns minutos).
4. No menu lateral: **Project Settings** (ícone de engrenagem) → **API**.
   - Anote:
     - **Project URL** (ex: `https://xxxxx.supabase.co`)
     - **anon public** (chave pública, começa com `eyJ...`).

No seu projeto (Vercel ou `.env` local), use:

- `VITE_SUPABASE_URL` = Project URL  
- `VITE_SUPABASE_ANON_KEY` = anon public  

---

## Passo 2: Rodar o schema (tabelas + RLS básico)

1. No Supabase: **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase-schema.sql`** do repositório.
3. Copie **todo** o conteúdo e cole na query.
4. Clique em **Run** (ou Ctrl+Enter).

Se aparecer erro de “policy already exists” ou “object already exists”, pode ser que você já tenha rodado parte do schema antes. Nesse caso:

- Ou rode só os trechos que faltam, **ou**
- Se preferir começar do zero: **Database** → **Migrations** (ou apague as tabelas manualmente) e rode o `supabase-schema.sql` de novo.

Ao final você deve ter:

- Tabelas: `restaurants`, `users`, `products`, `pizza_sizes`, `pizza_flavors`, `pizza_doughs`, `pizza_edges`, `delivery_zones`, `orders`, `order_items`
- RLS ativado em todas elas
- Política **“Users can read own profile”** na tabela `users` (necessária para o login)

---

## Passo 3: Políticas completas (produtos, zonas, pizzas, pedidos)

Este passo é o que **corrige** os erros ao adicionar zonas de entrega, produtos e cardápio.

1. No Supabase: **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase-rls-completo.sql`** do repositório.
3. Copie **todo** o conteúdo e cole na query.
4. Clique em **Run**.

O script:

- Ajusta políticas de **products** e **delivery_zones** com **USING** e **WITH CHECK** (incluindo INSERT).
- Cria políticas de **INSERT/UPDATE/DELETE** para:
  - `pizza_sizes`
  - `pizza_flavors`
  - `pizza_doughs`
  - `pizza_edges`
- Ajusta políticas de **orders** e **order_items** para staff e super_admin.
- Garante que **super_admin** possa ler todos os restaurantes.

Depois disso, **admin do restaurante** e **super_admin** devem conseguir:

- Criar, editar e excluir **produtos**.
- Criar, editar e excluir **zonas de entrega**.
- Criar, editar e excluir **tamanhos, sabores, massas e bordas** de pizza.

---

## Passo 4: Primeiro usuário (Auth) e super admin

### 4.1 Criar usuário no Auth

1. No Supabase: **Authentication** → **Users** → **Add user**.
2. Crie um usuário com **email** e **senha** (ex: o seu email e uma senha forte).
3. Após criar, clique no usuário e copie o **UUID** (ID).

### 4.2 Virar super_admin

1. **SQL Editor** → **New query**.
2. Cole o conteúdo de **`supabase-criar-super-admin.sql`** (ou use a função que já está no schema).
3. Ajuste a linha de exemplo para o **seu** email e o **UUID** do usuário que você copiou:

```sql
SELECT create_super_admin('seu-email@exemplo.com', 'uuid-copiado-do-usuario');
```

4. Execute a query.

Agora esse usuário tem role **super_admin** e pode logar no sistema e gerenciar qualquer restaurante.

---

## Passo 5: Restaurante e admin do restaurante (opcional)

Para testar um **restaurante** com um **admin** só daquele estabelecimento:

### 5.1 Criar restaurante (como super_admin ou direto no SQL)

No **SQL Editor**:

```sql
INSERT INTO restaurants (name, slug, phone, whatsapp, is_active)
VALUES ('Minha Pizzaria', 'minha-pizzaria', '11999999999', '11999999999', true)
RETURNING id, name, slug;
```

Anote o **id** (UUID) do restaurante retornado.

### 5.2 Criar usuário “admin do restaurante”

1. **Authentication** → **Users** → **Add user** (outro email/senha, ex: `admin@pizzaria.com`).
2. Copie o **UUID** desse usuário.

### 5.3 Vincular usuário ao restaurante

No **SQL Editor** (troque os UUIDs pelos seus):

```sql
INSERT INTO public.users (id, email, role, restaurant_id)
VALUES (
  'UUID-DO-USUARIO-CRIADO-NO-AUTH',
  'admin@pizzaria.com',
  'restaurant_admin',
  'UUID-DO-RESTAURANTE'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'restaurant_admin',
  restaurant_id = 'UUID-DO-RESTAURANTE';
```

Ou use o script **`scripts/criar-usuarios.js`** (veja `scripts/README-criar-usuarios.md`), que usa a API com **service_role** para criar usuários e linhas em `public.users`.

Depois disso, ao logar com esse email, o painel deve carregar **só** esse restaurante e as ações de **adicionar zonas de entrega** e **produtos no cardápio** devem funcionar (desde que o Passo 3 tenha sido feito).

---

## Resumo: o que cada arquivo SQL faz

| Arquivo | O que faz |
|--------|------------|
| **supabase-schema.sql** | Cria tabelas, índices, triggers e RLS básico (incluindo “Users can read own profile”). |
| **supabase-rls-completo.sql** | Corrige e completa as políticas para produtos, zonas, pizzas e pedidos (INSERT com WITH CHECK, admin e super_admin). **Execute depois do schema.** |
| **supabase-criar-super-admin.sql** | Exemplo para chamar `create_super_admin(email, user_id)` e virar super_admin. |
| **supabase-fix-login.sql** | Apenas a política “Users can read own profile” se você já tiver o resto e só o login estiver falhando. |
| **supabase-super-admin-policies.sql** | Versão antiga de políticas do super_admin; o **supabase-rls-completo.sql** já cobre e amplia isso. |

---

## Checklist rápido

- [ ] Projeto Supabase criado e URL + anon key no app (`.env` / Vercel).
- [ ] `supabase-schema.sql` executado (tabelas e RLS básico).
- [ ] `supabase-rls-completo.sql` executado (corrige zonas, produtos e cardápio).
- [ ] Pelo menos um usuário criado em **Authentication**.
- [ ] Super admin criado com `create_super_admin(email, user_id)`.
- [ ] (Opcional) Um restaurante criado e um usuário `restaurant_admin` vinculado a ele.

Se todos os itens estiverem feitos e as variáveis de ambiente corretas, **adicionar zonas de entrega e produtos no cardápio** deve funcionar sem erro de permissão.

---

## Erros comuns

- **“new row violates row-level security policy”**  
  Falta política com **WITH CHECK** para INSERT. Solução: rodar **`supabase-rls-completo.sql`**.

- **“permission denied for table products” (ou delivery_zones, etc.)**  
  RLS está ativo mas não existe política que permita ao seu usuário (admin/super_admin) acessar. Solução: mesmo script acima.

- **Login “funciona” mas o app não carrega dados**  
  Verifique se existe a política **“Users can read own profile”** em `users` (já está no `supabase-schema.sql` e em `supabase-fix-login.sql`).

- **Super admin não vê outros restaurantes**  
  Rodar **`supabase-rls-completo.sql`** (ele inclui a política para super_admin ler todos os restaurantes).

Se depois disso ainda aparecer algum erro, envie a **mensagem exata** do Supabase (ou do console do navegador) para ajustar a política específica.
