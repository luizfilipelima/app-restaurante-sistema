# Deploy das Edge Functions

## Pré-requisitos

- **Supabase CLI** (via npx não precisa instalar globalmente)
- **Login** no Supabase: `npx supabase login` (abre o browser)
- **Project ref**: em Supabase → Project Settings → General → Reference ID

## create-restaurant-user

Cria usuário no Auth e em `public.users`. Só pode ser chamada por **super_admin**.

### Deploy

```bash
# 1. Na raiz do projeto
cd "/caminho/do/App-Restaurante-Sistema"

# 2. Login (uma vez)
npx supabase login

# 3. Vincular projeto (uma vez; use o seu project ref)
npx supabase link --project-ref SEU_PROJECT_REF

# 4. Deploy da função
npx supabase functions deploy create-restaurant-user --project-ref SEU_PROJECT_REF
```

### Secrets obrigatórios

No Supabase: **Project Settings** → **Edge Functions** → **Secrets** (ou na função: Settings):

| Nome | Onde copiar |
|------|-------------|
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role (secret) |

Sem esses três, a função devolve erro ao criar usuário.

---

## send-order-whatsapp-notification

Envia notificação WhatsApp ao cliente quando o pedido vai para "Em Preparo" ou "Saiu para Entrega", via Evolution API.

### Deploy

```bash
npx supabase functions deploy send-order-whatsapp-notification --project-ref SEU_PROJECT_REF
```

### Secrets adicionais

| Nome | Descrição |
|------|-----------|
| `EVOLUTION_API_BASE_URL` | URL base da Evolution API (ex: `https://api.quiero.food`) |
| `EVOLUTION_API_KEY` | Chave de API da Evolution API |

---

## get-evolution-qrcode

Retorna o QR Code da instância para conectar o WhatsApp (proxy para não expor a API key no frontend).

### Deploy

```bash
npx supabase functions deploy get-evolution-qrcode --project-ref SEU_PROJECT_REF
```

### Secrets

Usa os mesmos `EVOLUTION_API_BASE_URL` e `EVOLUTION_API_KEY` da função `send-order-whatsapp-notification`.

### Erros comuns

| Erro / Comportamento | Causa | Solução |
|----------------------|--------|---------|
| "Edge Function returned a non-2xx" | Função não publicada ou secrets faltando | Fazer deploy e configurar os 3 secrets |
| "Apenas super admin pode criar..." | Usuário logado não é super_admin | Entrar com conta que tem `role = 'super_admin'` em `public.users` |
| "Usuário criado no Auth, mas falha ao salvar perfil" | RLS ou coluna inexistente | Ver política INSERT em `public.users`; conferir se a tabela tem `id`, `email`, `role`, `restaurant_id` |
