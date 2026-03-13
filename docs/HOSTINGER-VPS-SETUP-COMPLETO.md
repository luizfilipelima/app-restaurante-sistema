# VPS Hostinger — Setup Completo (Evolution API + WhatsApp)

Guia para configurar **100%** o VPS na Hostinger para a feature de WhatsApp via Evolution API.

---

## Resumo do que será configurado

| Componente | Função |
|------------|--------|
| **Docker** | PostgreSQL, Redis, Evolution API |
| **Evolution API** | Conexão WhatsApp (QR Code, webhooks) |
| **Nginx** | Proxy reverso + HTTPS |
| **Let's Encrypt** | Certificado SSL para api.quiero.food |

**URLs finais:** `https://api.quiero.food` e `https://api.quiero.food/manager`

---

## Pré-requisitos

1. **VPS Hostinger** com Ubuntu 22.04 ou 24.04
2. **Domínio** `api.quiero.food` com registro **A** apontando para o IP da VPS
3. **Acesso SSH** (root ou usuário com sudo)

---

## Opção A: Via Hostinger MCP (Cursor)

Se o MCP da Hostinger estiver autenticado:

1. **Listar VPS:** `VPS_getVirtualMachinesV1` → obter `virtualMachineId` e IP
2. **Copiar evolution-api-setup** para a VPS (via SCP, usando o IP)
3. **Executar scripts** via SSH (conectar com o IP do passo 1)

**Nota:** O deploy via `VPS_createNewProjectV1` funciona para projetos Docker Compose simples, mas o Evolution API exige um `.env` gerado com chaves únicas e a configuração de Nginx/SSL, que é feita pelos scripts `install.sh` e `setup-nginx-ssl.sh` via SSH.

---

## Opção B: Setup Manual via SSH (recomendado)

### 1. Obter IP da VPS

No painel Hostinger → VPS → seu servidor → veja o **IP público**.

### 2. Copiar arquivos para a VPS

Na sua máquina:

```bash
cd /caminho/do/App-Restaurante-Sistema
scp -r evolution-api-setup root@SEU_IP_VPS:~/
```

### 3. Conectar e executar instalação base

```bash
ssh root@SEU_IP_VPS
cd ~/evolution-api-setup
chmod +x install.sh
./install.sh
```

O script vai:
- Atualizar o sistema
- Instalar Docker
- Gerar `AUTHENTICATION_API_KEY` e `POSTGRES_PASSWORD`
- Criar `.env`
- Subir PostgreSQL, Redis e Evolution API (porta 8080 local)

**Guarde a chave exibida ao final** — será usada nos secrets do Supabase.

### 4. Configurar Nginx + SSL (domínio api.quiero.food)

Confirme que `api.quiero.food` está com DNS A apontando para o IP da VPS. Depois:

```bash
chmod +x setup-nginx-ssl.sh
./setup-nginx-ssl.sh
```

O script vai:
- Instalar Nginx e Certbot
- Obter certificado Let's Encrypt
- Configurar proxy reverso HTTPS → localhost:8080

### 5. Configurar secrets no Supabase

Na raiz do projeto:

```bash
npx supabase secrets set EVOLUTION_API_BASE_URL="https://api.quiero.food"
npx supabase secrets set EVOLUTION_API_KEY="CHAVE_DO_.env"   # = AUTHENTICATION_API_KEY
npx supabase secrets set WEBHOOK_BASE_URL="https://app.quiero.food"

npx supabase functions deploy get-evolution-qrcode
npx supabase functions deploy evolution-disconnect
```

Use o valor de `AUTHENTICATION_API_KEY` do `.env` na VPS (apareceu no final do `install.sh`).

### 6. Habilitar WhatsApp para um restaurante

1. Super Admin → Restaurantes → [Restaurante]
2. Em "Notificações WhatsApp (Evolution API)", ative o toggle
3. O restaurante verá a aba WhatsApp em Configurações

---

## Opção C: Script único remoto (tudo em um comando)

Se preferir rodar tudo de uma vez na VPS:

```bash
ssh root@SEU_IP_VPS 'bash -s' < evolution-api-setup/setup-completo-remoto.sh
```

**Atenção:** O domínio `api.quiero.food` precisa estar propagado antes, senão o Certbot falhará no SSL.

---

## Comandos úteis na VPS

| Comando | Descrição |
|---------|-----------|
| `docker compose logs -f evolution_api` | Logs da Evolution API |
| `docker compose ps` | Status dos containers |
| `cat .env` | Ver chave de API e variáveis |
| `./fix-qr-connection.sh` | Corrige QR vazio / versão WhatsApp |
| `systemctl status nginx` | Status do Nginx |

---

## Troubleshooting

### MCP Hostinger retorna "Unauthenticated"

- Verifique a API key em [hpanel.hostinger.com/profile/api](https://hpanel.hostinger.com/profile/api)
- Gere uma nova chave se necessário
- Atualize `~/.cursor/mcp.json` com a nova `API_TOKEN`
- Reinicie o Cursor

### QR Code não aparece

Execute na VPS: `./fix-qr-connection.sh`

### Erro 403 na criação de instância

- Confirme que `EVOLUTION_API_KEY` (Supabase) = `AUTHENTICATION_API_KEY` (VPS `.env`)
- Redeploy: `npx supabase functions deploy get-evolution-qrcode`

### SSL / Certbot falha

- Confirme DNS: `dig api.quiero.food` deve retornar o IP da VPS
- Portas 80 e 443 liberadas no firewall da Hostinger

---

## Checklist final

- [ ] VPS com Docker rodando (PostgreSQL, Redis, Evolution API)
- [ ] Nginx + SSL ativo em https://api.quiero.food
- [ ] Secrets do Supabase configurados
- [ ] Edge Functions deployed
- [ ] Restaurante habilitado no Super Admin
- [ ] Teste: gerar QR Code na tela de Configurações → WhatsApp
