# 🔗 Guia de Conexão - GitHub + Supabase + Vercel

Siga este guia passo a passo para conectar seu projeto ao GitHub, Supabase e Vercel.

---

## ✅ Status Atual

- [x] Código completo criado
- [x] Git inicializado
- [x] Commit inicial feito
- [ ] Conectar ao GitHub
- [ ] Configurar Supabase
- [ ] Deploy na Vercel

---

## 📋 **PASSO 1: Criar Repositório no GitHub**

### 1.1 Criar Repositório

1. Acesse: https://github.com/new
2. Preencha:
   - **Repository name**: `app-restaurante-sistema` (ou outro nome)
   - **Description**: `Sistema SaaS Multi-tenant para gestão de restaurantes`
   - **Visibility**: Public ou Private (sua escolha)
   - ⚠️ **NÃO marque** "Add a README file"
   - ⚠️ **NÃO marque** "Add .gitignore"
   - ⚠️ **NÃO marque** "Choose a license"
3. Clique em **"Create repository"**

### 1.2 Conectar ao Repositório

Após criar, o GitHub mostrará comandos. **NÃO USE ELES!** Use os comandos abaixo:

```bash
# Substitua SEU-USUARIO pelo seu username do GitHub
git remote add origin https://github.com/SEU-USUARIO/app-restaurante-sistema.git

# Confirme que foi adicionado
git remote -v

# Faça o push
git push -u origin main
```

**Exemplo real:**
```bash
git remote add origin https://github.com/johndoe/app-restaurante-sistema.git
git push -u origin main
```

### 1.3 Verificar

Recarregue a página do GitHub. Você deverá ver todos os arquivos!

✅ **GitHub configurado!**

---

## 🗄️ **PASSO 2: Configurar Supabase**

### 2.1 Criar Conta e Projeto

1. Acesse: https://supabase.com
2. Clique em **"Start your project"** ou **"Sign In"**
3. Faça login (pode usar GitHub)
4. Clique em **"New Project"**
5. Preencha:
   - **Name**: `restaurante-sistema` (ou outro)
   - **Database Password**: Crie uma senha forte e **ANOTE!**
   - **Region**: `South America (São Paulo)` (mais próximo do Brasil)
   - **Pricing Plan**: Free (suficiente para começar)
6. Clique em **"Create new project"**
7. ⏳ Aguarde 2-3 minutos (criação do banco)

### 2.2 Executar o Schema SQL

1. No painel do Supabase, clique em **"SQL Editor"** (ícone 📝 no menu lateral)
2. Clique em **"New Query"**
3. Abra o arquivo `supabase/db/schema/initial.sql` do projeto
4. **Copie TODO o conteúdo** (Cmd+A → Cmd+C ou Ctrl+A → Ctrl+C)
5. **Cole** no SQL Editor do Supabase
6. Clique em **"Run"** (ou pressione Cmd+Enter / Ctrl+Enter)
7. ✅ Você verá "Success. No rows returned"

### 2.3 Habilitar Realtime

1. No menu lateral, clique em **"Database"**
2. Clique em **"Replication"**
3. Encontre a tabela **`orders`**
4. **Ative** o toggle (deve ficar verde/azul)
5. Pronto! Os pedidos serão atualizados em tempo real

### 2.4 Obter Credenciais

1. No menu lateral, clique em **"Settings"** (ícone ⚙️)
2. Clique em **"API"**
3. **Copie e anote** estes valores:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...
```

⚠️ **IMPORTANTE**: Guarde essas credenciais! Vamos usar no próximo passo.

### 2.5 Criar Primeiro Usuário (Super Admin)

1. No menu lateral, clique em **"Authentication"**
2. Clique em **"Users"**
3. Clique em **"Add user"** → **"Create new user"**
4. Preencha:
   - **Email**: seu email (ex: `admin@exemplo.com`)
   - **Password**: senha forte
   - ✅ **Marque**: "Auto Confirm User"
5. Clique em **"Create user"**
6. **Copie o User UID** (ex: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 2.6 Tornar Usuário Super Admin

1. Volte para **"SQL Editor"**
2. Clique em **"New Query"**
3. Cole este comando (substitua os valores):

```sql
SELECT create_super_admin('seu@email.com', 'cole-o-user-uid-aqui');
```

**Exemplo:**
```sql
SELECT create_super_admin('admin@exemplo.com', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
```

4. Clique em **"Run"**
5. ✅ Deve retornar sucesso

### 2.7 Verificar

Execute esta query para confirmar:

```sql
SELECT * FROM users;
```

Você deve ver seu usuário com `role = 'super_admin'` ✅

✅ **Supabase configurado!**

---

## 🚀 **PASSO 3: Deploy na Vercel**

### 3.1 Criar Conta

1. Acesse: https://vercel.com
2. Clique em **"Sign Up"**
3. Escolha **"Continue with GitHub"**
4. Autorize o Vercel a acessar seus repositórios

### 3.2 Importar Projeto

1. No dashboard da Vercel, clique em **"Add New..."** → **"Project"**
2. Você verá seus repositórios do GitHub
3. Encontre **`app-restaurante-sistema`**
4. Clique em **"Import"**

### 3.3 Configurar Projeto

Na tela de configuração:

1. **Project Name**: (deixe o padrão ou mude)
2. **Framework Preset**: Vite (deve detectar automaticamente)
3. **Root Directory**: `./` (deixe como está)
4. **Build Command**: `npm run build` (já vem assim)
5. **Output Directory**: `dist` (já vem assim)

### 3.4 Configurar Variáveis de Ambiente

⚠️ **ESTE É O PASSO MAIS IMPORTANTE!**

1. Expanda a seção **"Environment Variables"**
2. Adicione 2 variáveis:

**Variável 1:**
```
Name:  VITE_SUPABASE_URL
Value: [Cole o Project URL do Supabase aqui]
```

**Variável 2:**
```
Name:  VITE_SUPABASE_ANON_KEY
Value: [Cole o anon public do Supabase aqui]
```

**Exemplo:**
```
VITE_SUPABASE_URL = https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Clique em **"Add"** após cada variável
4. ✅ Certifique-se de que ambas estão adicionadas

### 3.5 Deploy!

1. Clique em **"Deploy"**
2. ⏳ Aguarde 1-2 minutos
3. 🎉 Você verá: **"Congratulations! Your project has been deployed"**

### 3.6 Obter URL

1. Após o deploy, você verá uma URL como:
   - `https://app-restaurante-sistema.vercel.app`
   - ou `https://app-restaurante-sistema-abc123.vercel.app`
2. **Clique na URL** para abrir seu sistema!

✅ **Vercel configurado!**

---

## 🎉 **PASSO 4: Testar Tudo**

### 4.1 Testar Login

1. Acesse a URL do seu projeto na Vercel
2. Você será redirecionado para `/login`
3. Faça login com:
   - Email: o que você criou no Supabase
   - Senha: a senha que você definiu
4. ✅ Você deve ser redirecionado para `/super-admin`

### 4.2 Criar Primeiro Restaurante

1. No painel Super Admin, clique em **"Novo Restaurante"**
2. Preencha:
   - **Nome**: `Pizzaria Teste`
   - **Telefone**: `(11) 99999-9999`
   - **WhatsApp**: `11999999999`
3. Clique em **"Criar Restaurante"**
4. ✅ Restaurante criado!

### 4.3 Copiar Link do Cardápio

1. No card do restaurante, você verá:
   - `https://seu-app.vercel.app/pizzaria-teste`
2. **Copie este link**
3. Abra em uma **aba anônima** (Cmd+Shift+N ou Ctrl+Shift+N)
4. ✅ O cardápio deve aparecer!

---

## ✅ **Checklist Final**

- [ ] Repositório criado no GitHub
- [ ] Código enviado para o GitHub (`git push`)
- [ ] Projeto criado no Supabase
- [ ] Schema SQL executado
- [ ] Realtime habilitado para `orders`
- [ ] Super admin criado
- [ ] Projeto importado na Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy bem-sucedido
- [ ] Login funcionando
- [ ] Primeiro restaurante criado
- [ ] Cardápio digital funcionando

---

## 🎯 **Próximos Passos**

Agora que está tudo funcionando:

### 1. Configurar Domínio Próprio (Opcional)

Na Vercel:
1. Vá em **"Settings"** → **"Domains"**
2. Adicione seu domínio
3. Configure o DNS conforme instruções

### 2. Adicionar Produtos ao Cardápio

No SQL Editor do Supabase, você pode adicionar produtos de exemplo:

```sql
-- Obter ID do restaurante
SELECT id, name FROM restaurants;

-- Adicionar tamanhos de pizza (substitua RESTAURANT_ID)
INSERT INTO pizza_sizes (restaurant_id, name, max_flavors, price_multiplier, order_index)
VALUES 
  ('RESTAURANT_ID', 'Pequena', 1, 1.0, 1),
  ('RESTAURANT_ID', 'Média', 2, 1.5, 2),
  ('RESTAURANT_ID', 'Grande', 3, 2.0, 3);

-- Adicionar sabores
INSERT INTO pizza_flavors (restaurant_id, name, price, is_active)
VALUES 
  ('RESTAURANT_ID', 'Margherita', 35.00, true),
  ('RESTAURANT_ID', 'Calabresa', 38.00, true),
  ('RESTAURANT_ID', 'Portuguesa', 42.00, true);

-- Adicionar massas
INSERT INTO pizza_doughs (restaurant_id, name, extra_price, is_active)
VALUES 
  ('RESTAURANT_ID', 'Tradicional', 0, true),
  ('RESTAURANT_ID', 'Integral', 5.00, true);

-- Adicionar bordas
INSERT INTO pizza_edges (restaurant_id, name, price, is_active)
VALUES 
  ('RESTAURANT_ID', 'Catupiry', 8.00, true),
  ('RESTAURANT_ID', 'Cheddar', 8.00, true);

-- Adicionar zonas de entrega
INSERT INTO delivery_zones (restaurant_id, location_name, fee, is_active)
VALUES 
  ('RESTAURANT_ID', 'Centro', 0, true),
  ('RESTAURANT_ID', 'Bairro Norte', 5.00, true);
```

### 3. Criar Usuários do Restaurante

No Supabase Auth, crie usuários para:
- Admin do restaurante (`restaurant_admin`)
- Cozinha (`kitchen`)

Depois, no SQL Editor:

```sql
-- Admin do restaurante
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-from-auth',
  'admin@restaurante.com',
  'restaurant_admin',
  'restaurant-id'
);

-- Cozinha
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-from-auth',
  'cozinha@restaurante.com',
  'kitchen',
  'restaurant-id'
);
```

---

## 🆘 **Solução de Problemas**

### Deploy falhou na Vercel

**Erro: Build failed**
- Verifique se as variáveis de ambiente estão corretas
- Certifique-se de que começam com `VITE_`
- Faça um novo deploy: **"Deployments"** → **"..."** → **"Redeploy"**

### Não consigo fazer login

1. Verifique se o usuário está em **Authentication** → **Users**
2. Verifique se está na tabela `users`: `SELECT * FROM users;`
3. Certifique-se de marcar **"Auto Confirm User"** ao criar

### Erro de conexão com Supabase

1. Verifique as credenciais nas variáveis de ambiente da Vercel
2. Teste as credenciais copiando do Supabase novamente
3. Faça um novo deploy após corrigir

### Cardápio não aparece

1. Verifique se o restaurante está `is_active = true`
2. Verifique se há produtos cadastrados
3. Teste a URL do slug: `/nome-do-restaurante`

---

## 📱 **URLs Importantes**

Salve estes links:

- **Seu App**: https://app-restaurante-sistema.vercel.app
- **GitHub**: https://github.com/SEU-USUARIO/app-restaurante-sistema
- **Supabase**: https://app.supabase.com/project/SEU-PROJECT
- **Vercel**: https://vercel.com/seu-usuario/app-restaurante-sistema

---

## 🎊 **Parabéns!**

Seu sistema está no ar! 🚀

Agora você tem:
✅ Sistema completo rodando na nuvem  
✅ Banco de dados configurado  
✅ Deploy automático (push → deploy)  
✅ URL pública funcionando  

**Compartilhe o link do cardápio com seus clientes!** 🍕

---

## 💡 **Dica Pro**

Sempre que fizer mudanças no código:

```bash
git add .
git commit -m "Descrição da mudança"
git push
```

A Vercel fará deploy automaticamente! 🎉
