# WhatsApp Evolution API — Checklist de Deploy

Guia para configurar o fluxo de conexão via Evolution API e webhook.

## 1. Variáveis de ambiente na Vercel

O endpoint `/api/webhooks/evolution` precisa acessar o Supabase com permissão de service role para atualizar `restaurants.whatsapp_connected`.

Configure no painel da Vercel ou via CLI:

```bash
vercel env add SUPABASE_URL
# Cole a URL do projeto Supabase (ex: https://xxx.supabase.co)

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Cole a chave Service Role (Project Settings → API → service_role)
```

> A `VITE_SUPABASE_URL` já existe para o frontend. O webhook roda no backend e precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (a Vercel pode usar `VITE_SUPABASE_URL` se `SUPABASE_URL` não existir; o código lê ambas).

**Importante:** `SUPABASE_SERVICE_ROLE_KEY` é obrigatória para o webhook funcionar.

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

Se aparecer **"Edge Function returned a non-2xx"** ou **401 Unauthorized** ao gerar o QR Code:

1. **Sessão expirada** — Faça logout e login novamente no painel.
2. **Projeto diferente** — Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend são do **mesmo projeto** onde as Edge Functions estão deployed.
3. **Confira os logs** — Em Supabase → Edge Functions → `get-evolution-qrcode` → Logs, veja a mensagem de erro retornada.

## 6. Resumo rápido

| Item | Onde | Status |
|------|------|--------|
| `EVOLUTION_API_BASE_URL` | Supabase secrets | ✅ |
| `EVOLUTION_API_KEY` | Supabase secrets | ✅ |
| `WEBHOOK_BASE_URL` | Supabase secrets | ✅ |
| `SUPABASE_URL` | Vercel env | Configurar se não existir |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | **Obrigatório** |
| Toggle `whatsapp_evolution_enabled` | Super Admin | Ligar por restaurante |
