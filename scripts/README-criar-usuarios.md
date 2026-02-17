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
- **role**: `super_admin` | `restaurant_admin`  
- **restaurant_id**: para **restaurant_admin** use o UUID do restaurante; para **super_admin** use `null` ou omita. O admin do restaurante pode alternar entre modo recepcionista (painel) e modo cozinha no app.

### Adicionar um novo super_admin

1. Edite **`scripts/criar-usuarios.js`**.
2. No array **`USUARIOS_CRIAR`**, adicione um objeto como:

```javascript
{
  email: 'novo-admin@sistema.com',
  password: 'SenhaForte123!',
  role: 'super_admin',
  restaurant_id: null,   // super_admin não precisa; pode omitir
}
```

3. Salve e execute: `node --env-file=.env.script scripts/criar-usuarios.js`  
4. A pessoa já pode fazer login no app com esse e-mail e senha.

Exemplo (admin do restaurante):

```javascript
const USUARIOS_CRIAR = [
  {
    email: 'admin@pizzaria.com',
    password: 'SenhaSegura123!',
    role: 'restaurant_admin',
    restaurant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // ID real do restaurante
  },
];
```

O admin do restaurante acessa o painel (recepcionista) e pode alternar para o modo cozinha no próprio app. Você pode adicionar quantos usuários quiser (sempre com `role` e `restaurant_id` corretos).

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

Você pode criar **super_admin** de duas formas:

**Opção 1 – Pelo script (recomendado)**  
Use o passo [Adicionar um novo super_admin](#adicionar-um-novo-super_admin) acima: adicione um item com `role: 'super_admin'` e `restaurant_id: null` em `USUARIOS_CRIAR` e rode o script.

**Opção 2 – Manual**  
1. **Authentication** → **Users** → **Add user** (e-mail e senha, marcar **Auto Confirm**).  
2. **SQL Editor** → rodar o conteúdo de **`supabase-criar-super-admin.sql`** (com o e-mail e o User UID desse usuário).
