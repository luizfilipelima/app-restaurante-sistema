# Evolution API — Instalação na VPS

Setup para rodar a Evolution API em **api.quiero.food** (VPS Hostinger) para automação de mensagens WhatsApp no fluxo Kanban.

---

## URL final

- **API:** `https://api.quiero.food`
- **Manager:** `https://api.quiero.food/manager`

---

## Requisitos

- VPS com Ubuntu 24.04 LTS (ou 22.04)
- Domínio `api.quiero.food` com registro A apontando para o IP da VPS (ex.: 187.77.239.154)

---

## Instalação

### 1. Copiar arquivos para a VPS

```bash
cd /caminho/do/App-Restaurante-Sistema
scp -r evolution-api-setup root@187.77.239.154:~/
```

### 2. Executar instalação base

```bash
ssh root@187.77.239.154
cd ~/evolution-api-setup
chmod +x install.sh
./install.sh
```

### 3. Configurar Nginx + SSL (subdomínio api.quiero.food)

Depois que `api.quiero.food` estiver apontando para o IP da VPS:

```bash
chmod +x setup-nginx-ssl.sh
./setup-nginx-ssl.sh
```

O script instala Nginx, obtém certificado Let's Encrypt e configura o proxy reverso com HTTPS.

### 4. Guardar a chave de API

A chave aparece ao final do `install.sh` e está em `~/.env`. Use-a na Etapa 2 (integração no painel).

---

## Estrutura dos arquivos

| Arquivo | Descrição |
|---------|-----------|
| `docker-compose.yml` | PostgreSQL, Redis e Evolution API (porta 8080 local) |
| `.env.example` | Modelo de variáveis |
| `install.sh` | Instalação base (Docker + containers) |
| `setup-nginx-ssl.sh` | Nginx + SSL para api.quiero.food |
| `nginx/api.quiero.food.conf` | Config Nginx com SSL |
| `nginx/api.quiero.food.conf.initial` | Config inicial (HTTP) para certbot |
| `PROXIMOS_PASSOS.md` | Conectar WhatsApp e dados para Etapa 2 |
| `README.md` | Este guia |

---

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `docker compose logs -f evolution_api` | Logs em tempo real |
| `docker compose down` | Parar containers |
| `docker compose up -d` | Iniciar novamente |
| `systemctl status nginx` | Status do Nginx |
| `cat .env` | Ver chave de API e variáveis |
