# Login não funciona – alternativas

Quando aparece **"Login aceito, mas seu perfil não foi encontrado"**, o Auth do Supabase está ok, mas não existe linha na tabela **`public.users`** para o seu usuário (ou a leitura está bloqueada por RLS).

Siga **uma** das alternativas abaixo (a 1 costuma resolver sem mexer no banco).

---

## Contexto: correção do bug de login (RLS)

**Diagnóstico:** A tabela `public.users` tinha RLS ativado **sem políticas** que permitissem ao usuário autenticado fazer `SELECT` na própria linha. O Supabase devolvia vazio e o app interpretava como “perfil não encontrado”.

**Solução temporária aplicada:** Foi executado `ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;` para desbloquear o desenvolvimento.

**Ação futura:** Quando quiser proteger de novo os dados, execute **`supabase-rls-users-reativar.sql`**: ele cria as políticas corretas (ex.: `auth.uid() = id` para ler o próprio perfil) e reativa o RLS na tabela.

---

## 1. Edge Function que cria o perfil no primeiro login (recomendado)

O app já tenta chamar a Edge Function **`get-or-create-my-profile`**: se o perfil não existir, ela cria com `super_admin` e você entra.

**O que fazer:** publicar a função no **mesmo projeto** do app.

1. No Supabase: **Edge Functions** → **Create a new function**.
2. Nome: **`get-or-create-my-profile`**.
3. Cole o código do arquivo:  
   `supabase/functions/get-or-create-my-profile/index.ts`
4. **Deploy**.

Depois tente fazer login de novo (e-mail e senha). Na primeira vez que o perfil não existir, a função cria e você entra.

---

## 2. Script SQL no Supabase (perfil manual)

Use se não quiser publicar Edge Function ou se a função der erro.

1. Abra o **SQL Editor** do **mesmo projeto** que o app usa (veja a URL nas variáveis do Vercel).
2. Copie todo o conteúdo de **`supabase-fix-perfil-flxlima.sql`**.
3. Se o seu e-mail ou UID for outro, edite no script: `id` e `email`.
4. Execute (Run).
5. Confira: **Table Editor** → **users** → deve existir uma linha com seu `id`.

Para **ver todos os perfis** e conferir se o seu está lá:

```sql
SELECT id, email, role, restaurant_id FROM public.users ORDER BY created_at DESC;
```

Para **ver quem tem Auth e quem tem perfil**:

```sql
SELECT au.id, au.email, u.role,
  CASE WHEN u.id IS NOT NULL THEN 'Sim' ELSE 'Não' END AS tem_perfil
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id;
```

---

## 3. Inserir perfil pela interface do Supabase

1. Supabase → **Table Editor** → **users**.
2. **Insert row**.
3. Preencha:
   - **id:** cole o **UID** do seu usuário (o que aparece na mensagem de erro do login).
   - **email:** seu e-mail (ex.: flxlima9@gmail.com).
   - **role:** `super_admin`.
   - **restaurant_id:** deixe vazio (NULL).
4. Salve.

---

## 4. Garantir políticas RLS na tabela `users`

Se o perfil **já existe** na tabela mas o login ainda falha, pode ser RLS bloqueando a leitura.

Execute no **SQL Editor** o conteúdo de **`supabase-fix-login.sql`** (cria/recria as políticas para ler o próprio perfil e para super_admin ler todos).

---

## 5. Conferir projeto e variáveis

- O app na **Vercel** usa as variáveis **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY**.
- A **URL** deve ser do **mesmo projeto** em que você rodou o SQL ou publicou a Edge Function.
- No Supabase: **Project Settings** → **API** → confira **Project URL**. Ela deve bater com a variável do app (sem barra no final).

Se o app apontar para outro projeto, o perfil que você criou “no Supabase” não será o mesmo que o app usa no login.

---

## Resumo

| Situação                         | O que fazer |
|----------------------------------|-------------|
| Quer resolver sem SQL            | Publicar Edge Function **get-or-create-my-profile** (item 1). |
| Prefere SQL                      | Rodar **supabase-fix-perfil-flxlima.sql** no projeto certo (item 2). |
| Quer ver quem tem perfil         | Rodar os `SELECT` do item 2. |
| Perfil existe mas não entra      | Rodar **supabase-fix-login.sql** (item 4). |
| RLS estava desligado; reativar   | Rodar **supabase-rls-users-reativar.sql** (políticas + ENABLE RLS). |
| Cadastro de usuários não funciona (RLS ativo) | Rodar **supabase-rls-users-insert-update.sql** (INSERT/UPDATE para super_admin). Confirme também que a Edge Function **create-restaurant-user** está publicada e com as variáveis (ex.: `SUPABASE_SERVICE_ROLE_KEY`) configuradas. |
| Dúvida se é o projeto certo     | Conferir URL do projeto e variáveis do app (item 5). |
