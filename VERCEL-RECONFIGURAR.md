# 🚀 Reconfigurar Projeto no Vercel

Guia passo a passo para conectar novamente seu repositório ao Vercel.

---

## 1. Importar o projeto

1. Acesse: **https://vercel.com**
2. Faça login (de preferência com **GitHub**).
3. No dashboard, clique em **"Add New..."** → **"Project"**.
4. Na lista de repositórios, procure **`app-restaurante-sistema`** (ou `luizfilipelima/app-restaurante-sistema`).
5. Clique em **"Import"** ao lado do repositório.

---

## 2. Configurar o projeto (tela "Configure Project")

### Nome e framework

- **Project Name:** pode deixar `app-restaurante-sistema` ou alterar se quiser.
- **Framework Preset:** deve aparecer **Vite**. Se não aparecer, escolha **Vite** manualmente.

### Build

Deixe como está (geralmente já vem certo):

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Root Directory:** `./` (vazio ou um ponto)

### Variáveis de ambiente (obrigatório)

1. Abra a seção **"Environment Variables"**.
2. Adicione **duas** variáveis:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | A **Project URL** do Supabase (ex: `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | A chave **anon public** do Supabase |

**Como preencher:**

- **Name:** `VITE_SUPABASE_URL`  
  **Value:** cole a URL do projeto no Supabase (Settings → API → Project URL).

- Clique em **"Add"** (ou "Add another").

- **Name:** `VITE_SUPABASE_ANON_KEY`  
  **Value:** cole a chave **anon public** (Settings → API → anon public).

- Marque para **Production** (e, se quiser, Preview e Development).

3. Confira se as duas variáveis aparecem na lista antes de fazer o deploy.

---

## 3. Fazer o deploy

1. Clique em **"Deploy"**.
2. Aguarde o build (1–2 minutos).
3. Quando aparecer **"Congratulations!"**, o deploy foi concluído.

---

## 4. Onde pegar as credenciais do Supabase

1. Acesse **https://supabase.com** e abra seu projeto.
2. Menu lateral: **Settings** (⚙️) → **API**.
3. Copie:
   - **Project URL** → use em `VITE_SUPABASE_URL`
   - **anon public** (em "Project API keys") → use em `VITE_SUPABASE_ANON_KEY`

---

## 5. Depois do deploy

- A URL do app será algo como:  
  `https://app-restaurante-sistema-xxx.vercel.app`
- Para fazer login, use o usuário que você criou no Supabase e que está na tabela `users` com role `super_admin`.

---

## ✅ Checklist rápido

- [ ] Login no Vercel (com GitHub)
- [ ] Add New → Project
- [ ] Importar `app-restaurante-sistema`
- [ ] Framework: **Vite**
- [ ] Adicionar `VITE_SUPABASE_URL`
- [ ] Adicionar `VITE_SUPABASE_ANON_KEY`
- [ ] Clicar em **Deploy**
- [ ] Aguardar e testar a URL

---

## 🆘 Se o build falhar

- Confira se as variáveis estão escritas exatamente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (com `VITE_` no início).
- Em **Deployments**, abra o deploy que falhou e veja os **logs** para o erro exato.
- O repositório já está com a correção do `lucide-react`; o Vercel vai usar o código atual do GitHub.

Pronto. Seguindo isso, sua reconfiguração no Vercel fica completa.
