# Evolution API — Contexto Completo da Feature WhatsApp

Documento de handoff para Claude Code ou qualquer desenvolvedor continuar o trabalho.  
**Última atualização:** após reinstalação da VPS com CloudPanel (Hostinger).

---

## 1. O que a feature faz

- Restaurantes com a feature **habilitada** podem conectar o WhatsApp via QR Code nas **Configurações**.
- Quando o pedido muda para **"Em Preparo"** ou **"Saiu para Entrega"** no Kanban (Delivery/Retirada), o cliente recebe mensagem automática no WhatsApp.
- Funciona para delivery e retirada.
- Cada restaurante tem uma instância própria na Evolution API: `rest_{restaurantId}` (ex: `rest_5c95db8c_838e_448c_b2e2_97e81ac95919`).

---

## 2. Arquitetura

```
[Cliente/Admin] 
    → App (Vite/React) em Vercel
    → Supabase (Auth, DB, Edge Functions)
    → VPS (Evolution API em Docker)
    → WhatsApp
```

| Componente | Onde | Função |
|------------|------|--------|
| **Frontend** | Vercel | Tela Configurações → WhatsApp, Kanban de pedidos |
| **Supabase DB** | Supabase | `restaurants.whatsapp_evolution_enabled`, `evolution_instance_name`, `whatsapp_connected`, `whatsapp_templates` |
| **Edge Functions** | Supabase | `get-evolution-qrcode`, `evolution-disconnect`, `send-order-whatsapp-notification` |
| **API Routes** | Vercel | `api/webhooks/evolution` — recebe POST da Evolution API (CONNECTION_UPDATE) |
| **Evolution API** | VPS (Docker) | Gera QR Code, conecta WhatsApp, envia mensagens |

---

## 3. Fluxo completo

### 3.1 Habilitar (Super Admin)

1. Super Admin → Restaurantes → [Restaurante] → toggle "Notificações WhatsApp (Evolution API)" ON
2. Atualiza `restaurants.whatsapp_evolution_enabled = true`

### 3.2 Conectar WhatsApp (Admin do restaurante)

1. Admin acessa **Configurações → aba WhatsApp**
2. Clica em **"Gerar QR Code"**
3. Frontend chama Edge Function `get-evolution-qrcode` com `{ restaurantId }`
4. Edge Function:
   - Valida JWT
   - Verifica `whatsapp_evolution_enabled`
   - Tenta `GET /instance/connect/rest_{restaurantId}` na Evolution API
   - Se 404: `POST /instance/create` com webhook `{WEBHOOK_BASE_URL}/api/webhooks/evolution`
   - Obtém QR Code (base64 ou code) e retorna
5. Frontend exibe o QR; admin escaneia no celular
6. Evolution API envia `POST /api/webhooks/evolution` com `event: CONNECTION_UPDATE`, `state: open`
7. Webhook atualiza `restaurants.whatsapp_connected = true`

### 3.3 Notificações no Kanban

1. Admin move pedido para "Em Preparo" ou "Saiu para Entrega"
2. Frontend chama `notifyOrderStatusWhatsApp(orderId, 'preparing')` ou `'delivering'`
3. Dispara Edge Function `send-order-whatsapp-notification` com `{ orderId, newStatus }`
4. Edge Function busca pedido + restaurante, verifica `whatsapp_evolution_enabled` e `evolution_instance_name`
5. Chama Evolution API: `POST /message/sendText/{instanceName}` com `{ number, text }`
6. Cliente recebe mensagem no WhatsApp

---

## 4. Banco de dados (Supabase)

### Tabela `restaurants`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `whatsapp_evolution_enabled` | BOOLEAN | Habilitado pelo Super Admin |
| `evolution_instance_name` | TEXT | Nome da instância na Evolution API (ex: `rest_xxx`) |
| `whatsapp_connected` | BOOLEAN | Atualizado pelo webhook (state open/close) |
| `whatsapp_templates` | JSONB | Templates personalizados: `delivery_notification`, `preparing_notification` |

### Migrations

- `supabase/db/migrations/20260525_restaurants_whatsapp_evolution.sql`
- `supabase/db/migrations/20260526_restaurants_whatsapp_connected.sql`
- `supabase/db/migrations/20260261_whatsapp_templates.sql`

---

## 5. Arquivos principais

### Frontend

| Arquivo | Função |
|---------|--------|
| `src/components/admin/whatsapp/ConectarWhatsApp.tsx` | Botão "Gerar QR Code", exibe QR, desconectar |
| `src/pages/admin/_shared/Settings.tsx` | Aba WhatsApp nas Configurações |
| `src/lib/whatsapp/notifyOrderStatusWhatsApp.ts` | Invoca Edge Function de notificação |
| `src/pages/admin/delivery-logistics/Orders.tsx` | Dispara notificação ao mudar status |
| `src/pages/kitchen/KitchenDisplay.tsx` | Dispara ao marcar "Em Preparo" |
| `src/pages/kitchen/ExpoScreen.tsx` | Dispara ao marcar "Saiu para Entrega" |
| `src/hooks/orders/useReadyOrders.ts` | Dispara "Saiu para Entrega" |
| `src/pages/super-admin/restaurants/RestaurantDetails.tsx` | Toggle habilitar por restaurante |

### Supabase Edge Functions

| Função | Arquivo | Secrets necessários |
|--------|---------|---------------------|
| `get-evolution-qrcode` | `supabase/functions/get-evolution-qrcode/index.ts` | EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY, WEBHOOK_BASE_URL |
| `evolution-disconnect` | `supabase/functions/evolution-disconnect/index.ts` | EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY |
| `send-order-whatsapp-notification` | `supabase/functions/send-order-whatsapp-notification/index.ts` | EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY |

### Backend (Vercel API Routes)

| Arquivo | Função |
|---------|--------|
| `api/webhooks/evolution.ts` | Recebe CONNECTION_UPDATE, atualiza `whatsapp_connected` |

### VPS (evolution-api-setup)

| Arquivo | Função |
|---------|--------|
| `docker-compose.yml` | PostgreSQL, Redis, Evolution API (porta 8080) |
| `install.sh` | Instala Docker, gera .env, sobe containers |
| `setup-nginx-ssl.sh` | Nginx + Certbot para api.quiero.food |
| `fix-qr-connection.sh` | Corrige QR vazio (CONFIG_SESSION_PHONE_VERSION, WEBSOCKET_ENABLED, SERVER_URL) |
| `nginx/api.quiero.food.conf` | Proxy reverso HTTPS → 127.0.0.1:8080 |
| `.env.example` | Modelo de variáveis |

---

## 6. Configuração

### Vercel (app.quiero.food)

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Chave anon |
| `VITE_EVOLUTION_API_URL` | Opcional, fallback: https://api.quiero.food |
| `SUPABASE_URL` | Webhook usa |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook usa |

### Supabase Secrets (Edge Functions)

```bash
npx supabase secrets set EVOLUTION_API_BASE_URL="https://api.quiero.food"
npx supabase secrets set EVOLUTION_API_KEY="CHAVE_IDENTICA_A_AUTHENTICATION_API_KEY_NA_VPS"
npx supabase secrets set WEBHOOK_BASE_URL="https://app.quiero.food"
```

### Evolution API na VPS (.env)

Variáveis geradas por `install.sh`:

- `AUTHENTICATION_API_KEY` — deve ser igual a `EVOLUTION_API_KEY` no Supabase
- `POSTGRES_PASSWORD`
- `SERVER_URL=https://api.quiero.food`
- `WEBSOCKET_ENABLED=true`
- `CONFIG_SESSION_PHONE_VERSION=2.3000.1023923395` (ajustar se QR vazio)

---

## 7. VPS com CloudPanel (Hostinger)

**Importante:** A VPS foi reinstalada com **CloudPanel**. Os scripts originais (`install.sh`, `setup-nginx-ssl.sh`) foram feitos para **Ubuntu puro** com Nginx manual e Certbot.

Com CloudPanel:

- **Nginx** é gerenciado pelo CloudPanel.
- **SSL** pode ser via CloudPanel (Let's Encrypt integrado).
- **Docker** continua disponível; o `docker-compose.yml` deve funcionar.
- A configuração de proxy para `api.quiero.food` deve ser feita pelo CloudPanel (criar site, proxy para `http://127.0.0.1:8080`) ou integrada aos vhosts do CloudPanel.

**Passos sugeridos com CloudPanel:**

1. Instalar Docker na VPS (se não vier instalado).
2. Copiar `evolution-api-setup` para a VPS (ex: `/root/evolution-api-setup` ou outro diretório).
3. Executar `install.sh` — cria `.env` e sobe containers.
4. No CloudPanel: criar site `api.quiero.food` com proxy reverso para `http://127.0.0.1:8080`.
5. Ativar SSL para `api.quiero.food` pelo painel do CloudPanel.
6. Rodar `fix-qr-connection.sh` após o primeiro deploy para garantir `SERVER_URL`, `WEBSOCKET_ENABLED`, `CONFIG_SESSION_PHONE_VERSION`.

**DNS:** registro A de `api.quiero.food` → IP da VPS.

---

## 8. URLs e IPs

- **App:** https://app.quiero.food
- **Evolution API:** https://api.quiero.food
- **Evolution Manager:** https://api.quiero.food/manager
- **Webhook:** https://app.quiero.food/api/webhooks/evolution
- **VPS IP (referência):** 187.77.239.154

---

## 9. Troubleshooting

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| QR Code vazio (count: 0) | CONFIG_SESSION_PHONE_VERSION, WEBSOCKET, SERVER_URL | Rodar `fix-qr-connection.sh` na VPS |
| Erro 403 ao criar instância | EVOLUTION_API_KEY ≠ AUTHENTICATION_API_KEY | Conferir secrets e .env na VPS |
| Erro 401 no frontend | JWT/sessão inválida | Redeploy das Edge Functions, login novamente |
| Webhook não atualiza `whatsapp_connected` | URL do webhook inacessível | Verificar se Evolution consegue fazer POST em app.quiero.food/api/webhooks/evolution |
| SSH timeout | Firewall ou chave errada | Liberar porta 22, conferir chave pública no painel Hostinger |

---

## 10. Comandos úteis

```bash
# Deploy Edge Functions
npx supabase functions deploy get-evolution-qrcode
npx supabase functions deploy evolution-disconnect
npx supabase functions deploy send-order-whatsapp-notification

# Na VPS
docker compose ps
docker compose logs -f evolution_api
cd ~/evolution-api-setup && ./fix-qr-connection.sh
```

---

## 11. Observações

- A aba **WhatsApp** em Configurações só aparece se `whatsapp_evolution_enabled = true`.
- O nome da instância é gerado automaticamente: `rest_` + `restaurantId` com `-` trocados por `_`.
- As notificações usam templates em `whatsapp_templates` ou padrões em PT/ES.
- O `supabase/config.toml` define `verify_jwt = false` nas funções Evolution; a validação do JWT é feita dentro do código.
