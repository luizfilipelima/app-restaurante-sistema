# Próximos passos — Evolution API

## URL base

- **API:** `https://api.quiero.food`
- **Manager:** `https://api.quiero.food/manager`

## Status atual

- Instância: `restaurante-principal`
- Chave: `fcb5c6bd6b0de852e1b63f32f79ea896`

---

## 1. Configurar Nginx + SSL na VPS (uma vez)

Para usar `https://api.quiero.food` em vez do IP:

1. Copie a pasta atualizada para a VPS (inclui `nginx/` e `setup-nginx-ssl.sh`)
2. SSH na VPS e execute:

```bash
cd ~/evolution-api-setup
chmod +x setup-nginx-ssl.sh
./setup-nginx-ssl.sh
```

O script instala Nginx, obtém certificado Let's Encrypt e configura o proxy reverso.

**Antes de rodar:** confirme que `api.quiero.food` já aponta para o IP da VPS (A record na Vercel).

---

## 2. Conectar o WhatsApp (QR Code)

Use o **Evolution Manager** no navegador:

1. Abra: **https://api.quiero.food/manager**
2. Configure:
   - **URL da API:** `https://api.quiero.food`
   - **Chave (apikey):** `fcb5c6bd6b0de852e1b63f32f79ea896`
3. Localize a instância **restaurante-principal**
4. Clique em **Conectar** e escaneie o QR Code com o WhatsApp do restaurante

---

## 3. Testar envio de mensagem

```bash
curl -X POST "https://api.quiero.food/message/sendText/restaurante-principal" \
  -H "apikey: fcb5c6bd6b0de852e1b63f32f79ea896" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "textMessage": {
      "text": "Teste - seu pedido está em preparo!"
    }
  }'
```

---

## 4. Dados para a Etapa 2 (integração no sistema)

| Campo | Valor |
|-------|-------|
| **URL da API** | `https://api.quiero.food` |
| **Chave (apikey)** | `fcb5c6bd6b0de852e1b63f32f79ea896` |
| **Nome da instância** | `restaurante-principal` |
