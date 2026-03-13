# Evolution API — Setup do Zero (VPS Hostinger + Ubuntu 22.04)

Guia para configurar tudo do zero após reset da VPS.

---

## Pré-requisitos

- [ ] **VPS** com Ubuntu 22.04 LTS (já reinstalada)
- [ ] **DNS** — Registro **A** de `api.quiero.food` apontando para **187.77.239.154**
- [ ] **Acesso SSH do Mac à VPS** — A chave que você adicionou na Hostinger deve ser a **chave pública do seu Mac**, não da VPS

---

## Etapa 0: Configurar SSH do Mac (se ainda não funcionar)

Para conectar do **seu Mac** à VPS, você precisa da chave pública do **Mac** na Hostinger:

```bash
# No Mac — gerar chave (se ainda não tiver)
ssh-keygen -t ed25519 -C "contato@luizfilipelima.com.br" -f ~/.ssh/id_ed25519 -N ""

# Ver a chave pública
cat ~/.ssh/id_ed25519.pub
```

Copie a saída inteira e adicione em: **Hostinger → VPS → Configurações → SSH Keys → Adicionar chave SSH**

Depois teste: `ssh root@187.77.239.154` (deve conectar sem senha).

---

## Etapa 1: Copiar arquivos para a VPS

No **seu Mac** (na pasta do projeto):

```bash
cd /Users/luizfilipe/Documents/My\ Files/App-Restaurante-Sistema
scp -r evolution-api-setup root@187.77.239.154:~/
```

**Alternativa** — Se não conseguir SSH do Mac, use o **Terminal web da Hostinger** (hPanel → VPS → Terminal), conecte e rode:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/SEU_USUARIO/App-Restaurante-Sistema.git /tmp/repo
cp -r /tmp/repo/evolution-api-setup ~/
rm -rf /tmp/repo
```

(Substitua a URL do repositório pela do seu projeto.)

---

## Etapa 2: Instalação base (Evolution API + Docker)

**Conecte na VPS** e execute:

```bash
ssh root@187.77.239.154
cd ~/evolution-api-setup
chmod +x install.sh
./install.sh
```

Aguarde o fim (≈2–3 min). No final, o script exibirá algo como:

```
🔑 SUA CHAVE DE API (guarde em local seguro):
   abc123def456...
```

**Copie essa chave** — será usada na Etapa 5.

---

## Etapa 3: Nginx + SSL (domínio api.quiero.food)

Ainda na VPS:

```bash
chmod +x setup-nginx-ssl.sh
./setup-nginx-ssl.sh
```

Confirme que o DNS de `api.quiero.food` está apontando para 187.77.239.154.

---

## Etapa 4: Verificar se está funcionando

No navegador:

- API: https://api.quiero.food  
- Manager: https://api.quiero.food/manager  

---

## Etapa 5: Secrets no Supabase

No **seu Mac**, na raiz do projeto:

```bash
cd /Users/luizfilipe/Documents/My\ Files/App-Restaurante-Sistema

npx supabase secrets set EVOLUTION_API_BASE_URL="https://api.quiero.food"
npx supabase secrets set EVOLUTION_API_KEY="COLE_AQUI_A_CHAVE_DA_ETAPA_2"
npx supabase secrets set WEBHOOK_BASE_URL="https://app.quiero.food"
```

---

## Etapa 6: Deploy das Edge Functions

```bash
npx supabase functions deploy get-evolution-qrcode
npx supabase functions deploy evolution-disconnect
npx supabase functions deploy send-order-whatsapp-notification
```

---

## Etapa 7: Habilitar WhatsApp no restaurante

1. Acesse **app.quiero.food** → login como Super Admin
2. **Super Admin** → **Restaurantes** → **Seu Delivery** (ou o restaurante desejado)
3. Em **Notificações WhatsApp (Evolution API)**, ative o toggle
4. Clique em **Salvar**

---

## Etapa 8: Conectar o WhatsApp

1. Faça login como admin do restaurante
2. **Configurações** → aba **WhatsApp**
3. Clique em **Gerar QR Code**
4. Escaneie com o WhatsApp do celular

---

## Checklist final

- [ ] `api.quiero.food` abre no navegador
- [ ] Manager em https://api.quiero.food/manager abre
- [ ] QR Code é gerado nas Configurações
- [ ] WhatsApp conecta após escanear
- [ ] Teste: mover pedido para "Em Preparo" e verificar se o cliente recebe mensagem

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `scp` ou `ssh` timeout | Libere portas 22, 80, 443 no firewall da Hostinger |
| Certbot falha | Verifique DNS: `dig api.quiero.food` deve retornar 187.77.239.154 |
| QR Code vazio (count: 0) | Execute na VPS: `cd ~/evolution-api-setup && ./fix-qr-connection.sh` |
| Erro 403 ao criar instância | Confirme que `EVOLUTION_API_KEY` = `AUTHENTICATION_API_KEY` do `.env` na VPS |
