# Evolution API — Setup com CloudPanel (Hostinger VPS)

Guia completo para configurar a Evolution API numa VPS Hostinger que tem **CloudPanel** instalado.

> **Diferença do setup antigo:** O CloudPanel gerencia o Nginx internamente. Por isso:
> - Use `setup-cloudpanel.sh` (não `setup-completo-remoto.sh` nem `setup-nginx-ssl.sh`)
> - O proxy reverso e o SSL são criados pelo painel do CloudPanel, não por script

---

## Checklist de pré-requisitos

- [ ] VPS Hostinger rodando com CloudPanel instalado
- [ ] Acesso SSH configurado (chave pública do seu Mac adicionada na Hostinger)
- [ ] DNS: registro **A** de `api.quiero.food` apontando para `187.77.239.154`
- [ ] DNS propagado — confirme: `dig api.quiero.food +short` → deve retornar `187.77.239.154`

---

## Etapa 0: Configurar SSH do Mac (se necessário)

```bash
# No Mac — verificar se já tem chave
cat ~/.ssh/id_ed25519.pub

# Se não tiver, gerar
ssh-keygen -t ed25519 -C "contato@luizfilipelima.com.br" -f ~/.ssh/id_ed25519 -N ""

# Copiar a chave pública
cat ~/.ssh/id_ed25519.pub
```

Cole a saída em: **Hostinger hPanel → VPS → Configurações → SSH Keys → Add SSH Key**

Teste: `ssh root@187.77.239.154` (deve abrir sem pedir senha).

---

## Etapa 1: Copiar arquivos para a VPS

No **seu Mac**, na raiz do projeto:

```bash
cd "/Users/luizfilipe/Documents/My Files/App-Restaurante-Sistema"
scp -r evolution-api-setup root@187.77.239.154:~/
```

Se o `scp` falhar (timeout ou conexão recusada), use o **Terminal Web da Hostinger**:
- hPanel → VPS → Terminal
- Execute na VPS:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/SEU_USUARIO/App-Restaurante-Sistema.git /tmp/repo
cp -r /tmp/repo/evolution-api-setup ~/
rm -rf /tmp/repo
```

---

## Etapa 2: Instalar Docker + Evolution API

Na VPS:

```bash
ssh root@187.77.239.154
cd ~/evolution-api-setup
chmod +x setup-cloudpanel.sh
./setup-cloudpanel.sh
```

O script vai:
1. Atualizar pacotes do sistema
2. Instalar Docker (se necessário)
3. Gerar `.env` com chave de API e senha do Postgres
4. Subir os containers (Postgres, Redis, Evolution API)

**Ao final, copie a chave exibida:**
```
🔑 CHAVE DE API (copie agora):
   abc123def456abc123def456abc123def4
```

Essa chave vai para o Supabase na Etapa 5.

Você pode ver a chave depois com:
```bash
grep AUTHENTICATION_API_KEY ~/evolution-api-setup/.env
```

---

## Etapa 3: Configurar proxy reverso no CloudPanel

A Evolution API está escutando em `http://127.0.0.1:8080`. Agora o CloudPanel precisa criar um site que faça proxy para essa porta.

### 3.1 — Acessar o CloudPanel

O painel fica em `https://187.77.239.154:8443` (ou na porta que você configurou).

### 3.2 — Criar o site com Reverse Proxy

1. **Sites** → **+ Add Site**
2. Selecione o tipo: **Reverse Proxy** (ou "Node.js" se não houver Reverse Proxy)
3. Preencha:
   - **Domain Name:** `api.quiero.food`
   - **Reverse Proxy URL:** `http://127.0.0.1:8080`
4. Clique em **Add** / **Save**

> O CloudPanel cria automaticamente o vhost Nginx para o domínio.

### 3.3 — Ativar SSL (Let's Encrypt)

1. **Sites** → clique em `api.quiero.food`
2. Aba **SSL/TLS**
3. Clique em **Actions** → **New Let's Encrypt Certificate**
4. Confirme o domínio `api.quiero.food` e clique em **Issue**

O CloudPanel obtém e instala o certificado automaticamente.

### 3.4 — Verificar

Abra no navegador:
- `https://api.quiero.food` → deve retornar JSON da Evolution API
- `https://api.quiero.food/manager` → Manager da Evolution API

---

## Etapa 4: Verificar containers na VPS

```bash
# Status dos containers
docker compose -f ~/evolution-api-setup/docker-compose.yml ps

# Logs em tempo real
docker compose -f ~/evolution-api-setup/docker-compose.yml logs -f evolution-api

# Testar API localmente (sem SSL)
curl -s http://127.0.0.1:8080 | head -c 200
```

---

## Etapa 5: Configurar Secrets no Supabase

No **seu Mac**, na raiz do projeto (substitua `SUA_CHAVE` pela chave copiada na Etapa 2):

```bash
cd "/Users/luizfilipe/Documents/My Files/App-Restaurante-Sistema"

npx supabase secrets set EVOLUTION_API_BASE_URL="https://api.quiero.food"
npx supabase secrets set EVOLUTION_API_KEY="SUA_CHAVE"
npx supabase secrets set WEBHOOK_BASE_URL="https://app.quiero.food"
```

Confirme os secrets:
```bash
npx supabase secrets list
```

---

## Etapa 6: Deploy das Edge Functions

```bash
cd "/Users/luizfilipe/Documents/My Files/App-Restaurante-Sistema"

npx supabase functions deploy get-evolution-qrcode
npx supabase functions deploy evolution-disconnect
npx supabase functions deploy send-order-whatsapp-notification
```

---

## Etapa 7: Variáveis de ambiente na Vercel

No painel da Vercel (app.quiero.food), confirme que existem:

| Variável | Valor |
|----------|-------|
| `SUPABASE_URL` | URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase |
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key do Supabase |

Essas variáveis são usadas pelo webhook `api/webhooks/evolution` (atualiza `whatsapp_connected` no banco).

---

## Etapa 8: Habilitar WhatsApp no restaurante

1. Acesse `https://app.quiero.food` → login como **Super Admin**
2. **Super Admin** → **Restaurantes** → clique no restaurante desejado
3. Em **Notificações WhatsApp (Evolution API)**, ative o toggle
4. Clique em **Salvar**

---

## Etapa 9: Conectar o WhatsApp

1. Login como **admin do restaurante**
2. **Configurações** → aba **WhatsApp**
3. Clique em **Gerar QR Code**
4. Escaneie com o WhatsApp do celular:
   - Menu (⋮) → Aparelhos conectados → Conectar aparelho

Após escanear, o status muda para **"WhatsApp Conectado"** automaticamente (via webhook).

---

## Checklist final

- [ ] `https://api.quiero.food` responde com JSON
- [ ] `https://api.quiero.food/manager` abre o Manager
- [ ] Secrets do Supabase configurados (`EVOLUTION_API_KEY`, `EVOLUTION_API_BASE_URL`, `WEBHOOK_BASE_URL`)
- [ ] Edge Functions deployadas
- [ ] WhatsApp habilitado para o restaurante no Super Admin
- [ ] QR Code é gerado nas Configurações
- [ ] WhatsApp conecta após escanear
- [ ] Mover pedido para "Em Preparo" envia mensagem ao cliente

---

## Troubleshooting

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| `scp`/`ssh` timeout | Porta 22 bloqueada | Hostinger hPanel → VPS → Firewall → Liberar porta 22 |
| CloudPanel sem opção "Reverse Proxy" | Versão antiga ou tipo de conta | Usar "Node.js" ou criar vhost manualmente via SSH |
| SSL Let's Encrypt falha | DNS não propagado | Aguardar propagação; confirmar: `dig api.quiero.food +short` |
| `https://api.quiero.food` não abre | Proxy mal configurado ou container parado | `docker ps` na VPS; verificar URL de proxy no CloudPanel |
| QR Code vazio (count: 0) | `CONFIG_SESSION_PHONE_VERSION` desatualizada | `cd ~/evolution-api-setup && ./fix-qr-connection.sh` |
| Erro 403 ao criar instância | `EVOLUTION_API_KEY` ≠ `AUTHENTICATION_API_KEY` | Comparar `npx supabase secrets list` com `grep AUTHENTICATION_API_KEY ~/.env` |
| Webhook não atualiza `whatsapp_connected` | URL inacessível pela Evolution API | Testar: `curl -X POST https://app.quiero.food/api/webhooks/evolution -H "Content-Type: application/json" -d '{}'` |
| CloudPanel porta 8443 não abre | Firewall bloqueia | Hostinger hPanel → VPS → Firewall → Liberar porta 8443 |

---

## Comandos úteis na VPS

```bash
# Ver status dos containers
docker compose -f ~/evolution-api-setup/docker-compose.yml ps

# Logs da Evolution API (Ctrl+C para sair)
docker compose -f ~/evolution-api-setup/docker-compose.yml logs -f evolution-api

# Reiniciar containers
cd ~/evolution-api-setup && docker compose down && docker compose up -d

# Corrigir QR Code vazio
cd ~/evolution-api-setup && ./fix-qr-connection.sh

# Ver chave de API
grep AUTHENTICATION_API_KEY ~/evolution-api-setup/.env
```

---

## Referências

- **App:** https://app.quiero.food
- **Evolution API:** https://api.quiero.food
- **Evolution Manager:** https://api.quiero.food/manager
- **Webhook:** https://app.quiero.food/api/webhooks/evolution
- **VPS IP:** 187.77.239.154
- **CloudPanel:** https://187.77.239.154:8443
