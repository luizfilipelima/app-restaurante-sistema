# 🚀 Guia de Deploy - Sistema de Restaurantes

Este guia explica como fazer o deploy completo do sistema usando Vercel e Supabase.

## 📋 Pré-requisitos

1. Conta no [GitHub](https://github.com)
2. Conta no [Vercel](https://vercel.com)
3. Conta no [Supabase](https://supabase.com)

## 🗄️ Passo 1: Configurar o Banco de Dados (Supabase)

### 1.1 Criar Projeto no Supabase

1. Acesse [Supabase](https://supabase.com) e faça login
2. Clique em "New Project"
3. Escolha:
   - **Nome do projeto**: `restaurant-system` (ou outro nome)
   - **Database Password**: Anote esta senha (você precisará depois)
   - **Região**: Escolha a mais próxima do seu público
4. Aguarde a criação do projeto (leva alguns minutos)

### 1.2 Executar o Schema SQL

1. No painel do Supabase, vá em **SQL Editor** (menu lateral)
2. Clique em **New Query**
3. Copie todo o conteúdo do arquivo `supabase/db/schema/initial.sql`
4. Cole no editor e clique em **Run**
5. Aguarde a execução (deve retornar "Success")

### 1.3 Criar Primeiro Usuário (Super Admin)

1. Vá em **Authentication** > **Users**
2. Clique em **Add user** > **Create new user**
3. Preencha:
   - **Email**: seu email
   - **Password**: senha segura
   - **Auto Confirm User**: ✅ Marque esta opção
4. Clique em **Create user**
5. Copie o **User UID** (você precisará dele)

### 1.4 Tornar o Usuário Super Admin

1. Volte para **SQL Editor**
2. Execute o seguinte comando (substitua os valores):

```sql
SELECT create_super_admin('seu-email@exemplo.com', 'cole-o-user-uid-aqui');
```

3. Verifique se funcionou executando:

```sql
SELECT * FROM users;
```

### 1.5 Obter Credenciais do Supabase

1. Vá em **Settings** > **API**
2. Copie:
   - **Project URL** (exemplo: `https://xxxxx.supabase.co`)
   - **anon public** key (chave pública, é seguro expor)

## 📦 Passo 2: Preparar o Código

### 2.1 Criar Repositório no GitHub

1. Crie um novo repositório no GitHub
2. No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git push -u origin main
```

## 🌐 Passo 3: Deploy na Vercel

### 3.1 Importar Projeto

1. Acesse [Vercel](https://vercel.com) e faça login
2. Clique em **Add New** > **Project**
3. Importe seu repositório do GitHub
4. Clique em **Import**

### 3.2 Configurar Variáveis de Ambiente

1. Na tela de configuração do projeto, expanda **Environment Variables**
2. Adicione as seguintes variáveis:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

3. Clique em **Deploy**

### 3.3 Aguardar o Deploy

- O Vercel irá fazer o build e deploy automaticamente
- Isso leva cerca de 1-2 minutos
- Quando terminar, você receberá uma URL (exemplo: `https://seu-projeto.vercel.app`)

## ✅ Passo 4: Verificar se Está Funcionando

### 4.1 Testar Login

1. Acesse a URL do seu projeto
2. Você será redirecionado para `/login`
3. Faça login com o email e senha do super admin criado
4. Você deve ser redirecionado para `/super-admin`

### 4.2 Criar Primeiro Restaurante

1. No painel super admin, clique em **Novo Restaurante**
2. Preencha os dados:
   - Nome: `Pizzaria Teste`
   - Telefone: `(11) 99999-9999`
   - WhatsApp: `11999999999` (apenas números)
3. Clique em **Criar Restaurante**

### 4.3 Configurar Restaurante

1. **Criar usuário admin do restaurante:**
   - Vá no Supabase: **Authentication** > **Users**
   - Crie um novo usuário para o restaurante
   - No SQL Editor, execute:

```sql
-- Obtenha o restaurant_id primeiro
SELECT id, name FROM restaurants;

-- Depois insira o usuário (substitua os valores)
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-do-auth',
  'admin@restaurante.com',
  'restaurant_admin',
  'restaurant-id-aqui'
);
```

2. **Adicionar produtos, zonas de entrega, etc:**
   - Faça login com o usuário admin do restaurante
   - Use as páginas de gerenciamento para adicionar:
     - Produtos no cardápio
     - Zonas de entrega
     - Configurações do restaurante

### 4.4 Testar Cardápio Digital

1. Copie o link do cardápio (mostrado nas configurações)
2. Exemplo: `https://seu-projeto.vercel.app/pizzaria-teste`
3. Abra em uma aba anônima ou no celular
4. Teste fazer um pedido completo

## 🔧 Configurações Adicionais

### Domínio Personalizado (Opcional)

1. Na Vercel, vá em **Settings** > **Domains**
2. Adicione seu domínio personalizado
3. Configure o DNS conforme instruções da Vercel

### Configurar Usuário de Cozinha (KDS)

```sql
-- Criar usuário para cozinha
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-do-auth',
  'cozinha@restaurante.com',
  'kitchen',
  'restaurant-id-aqui'
);
```

## 🐛 Solução de Problemas

### Erro: "Missing Supabase environment variables"

- Verifique se as variáveis de ambiente estão configuradas corretamente na Vercel
- Certifique-se de que começam com `VITE_`
- Após alterar variáveis, faça um novo deploy

### Erro ao fazer login

- Verifique se o usuário foi criado no Supabase Auth
- Verifique se o usuário está na tabela `users`
- Certifique-se de que marcou "Auto Confirm User" ao criar

### Pedidos não aparecem na cozinha

- Verifique se o pedido foi aprovado (mudado para status "preparing")
- Verifique as políticas RLS do Supabase
- Verifique se o usuário da cozinha tem `restaurant_id` correto

### Realtime não funciona

- Verifique se habilitou Realtime no Supabase:
  - Vá em **Database** > **Replication**
  - Habilite para a tabela `orders`

## 📝 Notas Importantes

1. **Segurança**: As políticas RLS do Supabase protegem os dados
2. **Backups**: O Supabase faz backups automáticos diários
3. **Escalabilidade**: Tanto Vercel quanto Supabase escalam automaticamente
4. **Custos**: 
   - Vercel: Grátis para projetos pessoais
   - Supabase: Grátis até 500MB de banco + 2GB de armazenamento

## 🎉 Pronto!

Seu sistema está no ar! Agora você pode:

1. Criar múltiplos restaurantes
2. Cada restaurante terá seu próprio link
3. Gerenciar tudo pelo painel admin
4. Receber pedidos em tempo real

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs na Vercel (tab **Deployments**)
2. Verifique os logs no Supabase (tab **Logs**)
3. Abra uma issue no repositório
