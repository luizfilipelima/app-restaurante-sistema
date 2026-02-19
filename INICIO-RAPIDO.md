# 🚀 Início Rápido

Este guia ajuda você a colocar o sistema no ar em **menos de 15 minutos**.

## ⚡ Passos Rápidos

### 1️⃣ Instalar Dependências (2 min)

```bash
npm install
```

### 2️⃣ Configurar Supabase (5 min)

1. Crie conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute o arquivo `supabase/db/schema/initial.sql`
4. Vá em **Settings** > **API** e copie:
   - Project URL
   - anon public key

### 3️⃣ Configurar Variáveis de Ambiente (1 min)

```bash
cp .env.example .env
```

Edite o `.env` e adicione suas credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
```

### 4️⃣ Criar Super Admin (2 min)

1. No Supabase, vá em **Authentication** > **Users**
2. Clique em **Add user** > **Create new user**
3. Preencha email e senha, marque **Auto Confirm User**
4. Copie o User UID
5. No **SQL Editor**, execute:

```sql
SELECT create_super_admin('seu@email.com', 'cole-o-uid-aqui');
```

### 5️⃣ Iniciar o Sistema (1 min)

```bash
npm run dev
```

Acesse: `http://localhost:5173`

### 6️⃣ Fazer Login e Criar Restaurante (3 min)

1. Faça login com o super admin
2. Crie um restaurante
3. Configure produtos e zonas de entrega

### 7️⃣ Testar o Cardápio (1 min)

Acesse: `http://localhost:5173/seu-restaurante-slug`

---

## 🎯 Próximos Passos

Agora que o sistema está rodando:

### Criar Usuário Admin do Restaurante

```sql
-- 1. Criar usuário no Supabase Auth
-- 2. Depois executar:
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-do-auth',
  'admin@restaurante.com',
  'restaurant_admin',
  'restaurant-id'
);
```

### Criar Usuário da Cozinha

```sql
INSERT INTO users (id, email, role, restaurant_id)
VALUES (
  'user-uid-do-auth',
  'cozinha@restaurante.com',
  'kitchen',
  'restaurant-id'
);
```

### Adicionar Dados de Exemplo

Execute estas queries no SQL Editor:

```sql
-- Obter ID do restaurante
SELECT id, name FROM restaurants;

-- Usar o ID nas queries abaixo (substitua 'RESTAURANT_ID')

-- Tamanhos de pizza
INSERT INTO pizza_sizes (restaurant_id, name, max_flavors, price_multiplier, order_index)
VALUES 
  ('RESTAURANT_ID', 'Pequena', 1, 1.0, 1),
  ('RESTAURANT_ID', 'Média', 2, 1.5, 2),
  ('RESTAURANT_ID', 'Grande', 3, 2.0, 3);

-- Sabores
INSERT INTO pizza_flavors (restaurant_id, name, price, is_active)
VALUES 
  ('RESTAURANT_ID', 'Margherita', 35.00, true),
  ('RESTAURANT_ID', 'Calabresa', 38.00, true),
  ('RESTAURANT_ID', 'Portuguesa', 42.00, true),
  ('RESTAURANT_ID', 'Frango Catupiry', 40.00, true);

-- Massas
INSERT INTO pizza_doughs (restaurant_id, name, extra_price, is_active)
VALUES 
  ('RESTAURANT_ID', 'Tradicional', 0, true),
  ('RESTAURANT_ID', 'Integral', 5.00, true);

-- Bordas
INSERT INTO pizza_edges (restaurant_id, name, price, is_active)
VALUES 
  ('RESTAURANT_ID', 'Catupiry', 8.00, true),
  ('RESTAURANT_ID', 'Cheddar', 8.00, true);

-- Zonas de entrega
INSERT INTO delivery_zones (restaurant_id, location_name, fee, is_active)
VALUES 
  ('RESTAURANT_ID', 'Centro', 0, true),
  ('RESTAURANT_ID', 'Bairro Norte', 5.00, true),
  ('RESTAURANT_ID', 'Bairro Sul', 7.00, true);

-- Produtos simples (não-pizza)
INSERT INTO products (restaurant_id, category, name, description, price, is_pizza, is_active)
VALUES 
  ('RESTAURANT_ID', 'Bebidas', 'Coca-Cola 2L', 'Refrigerante', 8.00, false, true),
  ('RESTAURANT_ID', 'Bebidas', 'Guaraná 2L', 'Refrigerante', 7.50, false, true),
  ('RESTAURANT_ID', 'Sobremesas', 'Petit Gateau', 'Chocolate quente com sorvete', 15.00, false, true);
```

---

## 📚 Acessos Rápidos

### Logins:

- **Super Admin**: `http://localhost:5173/login` → `/super-admin`
- **Admin Restaurante**: `http://localhost:5173/login` → `/admin`
- **Cozinha**: `http://localhost:5173/login` → `/kitchen`

### Públicas:

- **Cardápio**: `http://localhost:5173/slug-do-restaurante`
- **Checkout**: `http://localhost:5173/slug-do-restaurante/checkout`

---

## 🆘 Problemas Comuns

### "Missing Supabase environment variables"
→ Verifique se o arquivo `.env` existe e está correto

### Não consigo fazer login
→ Verifique se o usuário está nas tabelas `auth.users` E `public.users`

### Pedidos não aparecem na cozinha
→ Certifique-se de:
1. Pedido está com status "preparing"
2. Usuário da cozinha tem `restaurant_id` correto
3. Realtime está habilitado no Supabase

### Realtime não funciona
→ Vá em Supabase: **Database** > **Replication** e habilite para `orders`

---

## 🎉 Pronto!

Seu sistema está funcionando! Explore as funcionalidades:

✅ Faça pedidos pelo cardápio  
✅ Gerencie pelo painel admin  
✅ Visualize na cozinha  
✅ Acompanhe métricas no dashboard  

## 📖 Documentação Completa

- [README.md](./README.md) - Documentação principal
- [DEPLOY.md](./DEPLOY.md) - Guia de deploy (Vercel)
- [ESTRUTURA.md](./ESTRUTURA.md) - Arquitetura do projeto

## 💡 Dicas

1. Use o **Inspetor** do navegador para ver console.log
2. Veja os logs do Supabase em **Logs** > **Postgres Logs**
3. Use **SQL Editor** para queries ad-hoc
4. Habilite **Realtime** para tabelas que precisam atualizar automaticamente

---

**Dúvidas?** Abra uma issue no GitHub! 🚀
