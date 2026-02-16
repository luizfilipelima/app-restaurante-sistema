# Criar usuários no Supabase (automático)

Este script cria usuários no **Supabase Auth** e na tabela **`public.users`** de uma vez, sem precisar usar o SQL Editor para cada pessoa.

## Pré-requisitos

1. **ID do restaurante**  
   No Supabase: **SQL Editor** → rode:
   ```sql
   SELECT id, name FROM restaurants;
   ```
   Copie o `id` do restaurante que você quer vincular aos usuários (admin e cozinha).

2. **Chave service_role**  
   No Supabase: **Settings** → **API** → em "Project API keys" copie a chave **`service_role`** (secret).  
   Não use essa chave no frontend; só em scripts como este.

## Passo a passo

### 1. Configurar variáveis de ambiente

Crie um arquivo na **raiz do projeto** (não será commitado):

**`.env.script`** (ou use variáveis no terminal):

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **SUPABASE_URL**: em **Settings** → **API** → **Project URL**
- **SUPABASE_SERVICE_ROLE_KEY**: a chave **service_role** (secret)

### 2. Editar a lista de usuários

Abra **`scripts/criar-usuarios.js`** e edite o array **`USUARIOS_CRIAR`**:

- **email**: e-mail do usuário  
- **password**: senha (troque depois no app se quiser)  
- **role**: `restaurant_admin` ou `kitchen`  
- **restaurant_id**: UUID do restaurante (o `id` que você copiou do `SELECT id, name FROM restaurants;`)

Exemplo:

```javascript
const USUARIOS_CRIAR = [
  {
    email: 'admin@pizzaria.com',
    password: 'SenhaSegura123!',
    role: 'restaurant_admin',
    restaurant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // ID real do restaurante
  },
  {
    email: 'cozinha@pizzaria.com',
    password: 'SenhaSegura123!',
    role: 'kitchen',
    restaurant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  },
];
```

Você pode adicionar quantos usuários quiser (sempre com `role` e `restaurant_id` corretos).

### 3. Rodar o script

Na raiz do projeto, no terminal:

**Opção A – Node 20+ (recomendado)**  
O Node carrega o arquivo `.env.script` automaticamente:

```bash
node --env-file=.env.script scripts/criar-usuarios.js
```

**Opção B – Variáveis no comando**

```bash
SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/criar-usuarios.js
```

**Opção C – Linux/Mac: exportar do arquivo**

```bash
export $(cat .env.script | xargs) && node scripts/criar-usuarios.js
```

### 4. Conferir

- No Supabase: **Authentication** → **Users** (devem aparecer os e-mails).  
- No **SQL Editor**: `SELECT * FROM users;` (devem aparecer com `role` e `restaurant_id` corretos).

Depois disso, os usuários já podem fazer login no app com o e-mail e a senha que você definiu no script.

## Segurança

- **Nunca** commite o arquivo `.env.script` nem a chave **service_role** no Git.  
- O `.gitignore` do projeto já ignora `.env` e `.env.*`; use um desses nomes para o arquivo de variáveis.

## Super Admin

O **super admin** você continua criando como antes:

1. **Authentication** → **Users** → **Add user** (e-mail e senha, marcar **Auto Confirm**).
2. **SQL Editor** → rodar o conteúdo de **`supabase-criar-super-admin.sql`** (com o e-mail e o User UID desse usuário).

O script **`criar-usuarios.js`** é pensado para **restaurant_admin** e **kitchen**; o super admin é único e costuma ser configurado uma vez à mão.
