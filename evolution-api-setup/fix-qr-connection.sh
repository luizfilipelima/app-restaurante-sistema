#!/bin/bash
# =============================================================================
# Evolution API - Correção: QR Code vazio / WhatsApp desconectado
# Executar na VPS: ./fix-qr-connection.sh
#
# Causas comuns:
#   1. CONFIG_SESSION_PHONE_VERSION desatualizada (WhatsApp muda versão)
#   2. WEBSOCKET_ENABLED=false (Manager precisa de WebSocket para o QR)
#   3. SERVER_URL ausente (API precisa da URL pública)
# =============================================================================

set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$INSTALL_DIR"

if [ ! -f ".env" ]; then
  echo "❌ Arquivo .env não encontrado. Execute install.sh primeiro."
  exit 1
fi

echo "=============================================="
echo "  Evolution API - Correção QR Code"
echo "=============================================="
echo ""

# Backup
cp .env .env.bak.$(date +%Y%m%d%H%M%S)
echo "✅ Backup do .env criado."
echo ""

# Verifica e adiciona/atualiza variáveis
append_or_replace() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
    echo "   Atualizado: ${key}"
  else
    echo "${key}=${value}" >> .env
    echo "   Adicionado: ${key}"
  fi
}

echo "Adicionando/atualizando variáveis..."
append_or_replace "CONFIG_SESSION_PHONE_VERSION" "2.3000.1023923395"
append_or_replace "WEBSOCKET_ENABLED" "true"
append_or_replace "SERVER_URL" "https://api.quiero.food"
echo ""

echo "Reiniciando Evolution API..."
if docker compose version &> /dev/null; then
  docker compose down
  docker compose up -d
else
  docker-compose down
  docker-compose up -d
fi

echo ""
echo "⏳ Aguardando containers (15s)..."
sleep 15

echo ""
echo "=============================================="
echo "  ✅ Correção aplicada!"
echo "=============================================="
echo ""
echo "Próximos passos:"
echo "  1. Acesse: https://api.quiero.food/manager"
echo "  2. Abra a instância restaurante-principal"
echo "  3. Clique em 'Connect' ou 'Get QR Code'"
echo "  4. O QR code deve aparecer — escaneie com WhatsApp"
echo ""
echo "Se ainda não aparecer, tente:"
echo "  - Deletar a instância e criar novamente no Manager"
echo "  - Verificar versão WhatsApp Web: Ajuda → Versão"
echo "  - Atualizar CONFIG_SESSION_PHONE_VERSION com esse número"
echo ""
