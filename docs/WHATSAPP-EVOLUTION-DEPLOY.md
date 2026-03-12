# WhatsApp Evolution API — Checklist de Deploy

Guia para configurar o fluxo de conexão via Evolution API e webhook.

## 1. Variáveis de ambiente na Vercel

Configure no painel da Vercel (Settings → Environment Variables) ou via CLI.

### Frontend (Vite — prefixo `VITE_`)

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Sim |
| `VITE_SUPABASE_ANON_KEY` | chave anon do Supabase | Sim |
| `VITE_EVOLUTION_API_URL` | `https://api.quiero.food` | Não (fallback hardcoded) |

### Backend (API Routes / Node)

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Sim (webhook) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role do Supabase | Sim (webhook) |

O endpoint `/api/webhooks/evolution` usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Se `SUPABASE_URL` não existir, o código tenta `VITE_SUPABASE_URL` como fallback.

## 2. Secrets do Supabase (Edge Functions)

Já configurados via `npx supabase secrets set`:

- `EVOLUTION_API_BASE_URL`
- `EVOLUTION_API_KEY`
- `WEBHOOK_BASE_URL` (URL pública da app, ex: `https://app.quiero.food`)

## 3. Super Admin — Habilitar por restaurante

O WhatsApp só aparece em **Configurações** se `whatsapp_evolution_enabled = true`.

1. Acesse **Super Admin** → **Restaurantes** → detalhes do restaurante
2. Na seção **Notificações WhatsApp (Evolution API)**, ligue o toggle **Habilitar para este restaurante**
3. O restaurante passará a ver a aba **WhatsApp** em Configurações

## 4. Acessibilidade da URL do webhook

A Evolution API (VPS) precisa conseguir fazer POST em:

```
https://<sua-app>/api/webhooks/evolution
```

Verifique:

- [ ] Domínio público (não localhost)
- [ ] HTTPS ativo
- [ ] Sem bloqueio de firewall na VPS
- [ ] URL configurada em `WEBHOOK_BASE_URL` (usada ao criar a instância)

## 5. Troubleshooting — Erro 401

Se aparecer **401 Unauthorized** ou **"Sessão expirada ou inválida"**:

1. **Redeploy das funções** — O `supabase/config.toml` define `verify_jwt = false` (validação do JWT é feita dentro da função). Deploy:
   ```bash
   npx supabase functions deploy get-evolution-qrcode
   npx supabase functions deploy evolution-disconnect
   ```
   Se o 401 persistir, tente: `npx supabase functions deploy get-evolution-qrcode --no-verify-jwt`
2. **Sessão expirada** — O app redireciona para o login. Faça login novamente e tente de novo.
3. **Projeto Supabase** — Confirme que `VITE_SUPABASE_URL` (Vercel) é do **mesmo projeto** onde as funções estão deployed.
4. **Logs** — Supabase → Edge Functions → `get-evolution-qrcode` → Logs.

### QR Code vazio (count: 0)

Se a mensagem for "A instância não retornou QR Code":

1. **Na VPS** — Execute `evolution-api-setup/fix-qr-connection.sh` para atualizar `CONFIG_SESSION_PHONE_VERSION`, `WEBSOCKET_ENABLED` e `SERVER_URL`.
2. **Tente novamente** — O componente faz retry automático; clique em "Atualizar" após alguns segundos.
3. **Evolution Manager** — Acesse `https://api.quiero.food/manager`, abra a instância e verifique se o QR aparece lá.

## 6. Resumo rápido

| Item | Onde | Status |
|------|------|--------|
| `EVOLUTION_API_BASE_URL` | Supabase secrets | ✅ |
| `EVOLUTION_API_KEY` | Supabase secrets | ✅ |
| `WEBHOOK_BASE_URL` | Supabase secrets | ✅ |
| `SUPABASE_URL` | Vercel env | **Obrigatório** para webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | **Obrigatório** |
| `VITE_SUPABASE_URL` | Vercel env | **Obrigatório** (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Vercel env | **Obrigatório** (frontend) |
| `VITE_EVOLUTION_API_URL` | Vercel env | Opcional (fallback: api.quiero.food) |
| Toggle `whatsapp_evolution_enabled` | Super Admin | Ligar por restaurante |

### Erro WebSocket `ws://localhost:8081` no console

O app não usa WebSocket para localhost. Esse erro costuma vir de:
- **HMR do Vite** quando em dev local (porta 5173)
- **Evolution API Manager** aberto em outra aba (usa WebSocket próprio na VPS)
- Extensões do navegador

Em produção (Vercel), o build é estático e não injeta HMR. Se ainda aparecer, verifique se está acessando o domínio de produção (ex: https://app.quiero.food) e não localhost.
