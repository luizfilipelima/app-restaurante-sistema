# Publicar Edge Function para cadastro de usuários

O cadastro na aba **Usuários do restaurante** depende da Edge Function **`create-restaurant-user`**. Ela **não** é ativada por SQL; precisa ser publicada no Supabase.

## Opção 1: Publicar pelo Dashboard do Supabase

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e abra seu projeto.
2. No menu lateral: **Edge Functions** (ou **Functions**).
3. Clique em **Create a new function** / **New function**.
4. **Nome da função:** `create-restaurant-user`
5. **Código:** copie todo o conteúdo do arquivo  
   `supabase/functions/create-restaurant-user/index.ts`  
   e cole no editor da função.
6. Salve e faça o **Deploy** da função.

As variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` já são definidas automaticamente pelo Supabase; não é preciso configurá-las.

## Opção 2: Publicar pela CLI do Supabase

Se tiver o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e o projeto linkado:

```bash
supabase functions deploy create-restaurant-user
```

## Depois de publicar

1. Rode no **SQL Editor** do Supabase o script:  
   `supabase-ajuda-cadastro-usuarios.sql`  
   (isso prepara o banco e a policy de leitura para super_admin).
2. Na aplicação, entre como **super_admin**, vá em Usuários do restaurante e use **Cadastrar usuário**.

## Se não quiser usar Edge Function

Use o script Node na sua máquina (com a chave **service_role** apenas no ambiente local):

```bash
# Configure .env.script (veja scripts/.env.script.example)
node --env-file=.env.script scripts/criar-usuarios.js
```

Edite a lista `USUARIOS_CRIAR` em `scripts/criar-usuarios.js` (e-mail, senha, role, `restaurant_id`).
