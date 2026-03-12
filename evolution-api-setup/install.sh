#!/bin/bash
# =============================================================================
# Evolution API - Instalação completa (Etapas 1-4)
# Executar no VPS: ./install.sh
# =============================================================================

set -e

echo "=============================================="
echo "  Evolution API - Instalação automática"
echo "=============================================="
echo ""

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute como root: sudo ./install.sh"
  exit 1
fi

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$INSTALL_DIR"

# Verifica se os arquivos existem
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ Arquivo docker-compose.yml não encontrado. Execute o script na pasta evolution-api-setup."
  exit 1
fi

# -----------------------------------------------------------------------------
# Etapa 1: Atualizar sistema
# -----------------------------------------------------------------------------
echo ""
echo "[1/4] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq
echo "✅ Sistema atualizado."
echo ""

# -----------------------------------------------------------------------------
# Etapa 2: Instalar Docker
# -----------------------------------------------------------------------------
echo "[2/4] Instalando Docker..."
if command -v docker &> /dev/null; then
  echo "✅ Docker já instalado: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  echo "✅ Docker instalado: $(docker --version)"
fi
echo ""

# -----------------------------------------------------------------------------
# Etapa 3: Configurar .env e subir containers
# -----------------------------------------------------------------------------
echo "[3/4] Configurando Evolution API..."

# Gera chaves aleatórias
API_KEY=$(openssl rand -hex 16)
POSTGRES_PASS=$(openssl rand -hex 12)

# Cria arquivo .env
cat > .env << EOF
# Gerado automaticamente em $(date -Iseconds)

AUTHENTICATION_API_KEY=${API_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASS}

DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:${POSTGRES_PASS}@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_LOCAL_ENABLED=false

# QR Code e WebSocket (Manager remoto)
SERVER_URL=https://api.quiero.food
WEBSOCKET_ENABLED=true
CONFIG_SESSION_PHONE_VERSION=2.3000.1023923395
EOF

# Ajusta senha do postgres no docker-compose (substitui variável)
export POSTGRES_PASSWORD="${POSTGRES_PASS}"

echo "✅ Arquivo .env criado."
echo ""

# -----------------------------------------------------------------------------
# Etapa 4: Liberar porta 8080 no firewall e subir containers
# -----------------------------------------------------------------------------
if command -v ufw &> /dev/null; then
  echo "[4/4] Liberando portas no firewall..."
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
  ufw allow 8080/tcp 2>/dev/null || true
  ufw --force enable 2>/dev/null || true
fi

echo "[4/4] Iniciando Evolution API..."
if docker compose version &> /dev/null; then
  docker compose up -d
else
  docker-compose up -d
fi

echo ""
echo "⏳ Aguardando containers iniciarem (30s)..."
sleep 30

# Verifica se está rodando
if docker ps | grep -q evolution_api; then
  echo ""
  echo "=============================================="
  echo "  ✅ Evolution API instalada com sucesso!"
  echo "=============================================="
  echo ""
  echo "📍 URL da API: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):8080"
  echo ""
  echo "🔑 SUA CHAVE DE API (guarde em local seguro):"
  echo "   ${API_KEY}"
  echo ""
  echo "📋 Próximos passos:"
  echo "   1. Crie uma instância:"
  echo "      curl -X POST \"http://localhost:8080/instance/create\" \\"
  echo "        -H \"apikey: ${API_KEY}\" \\"
  echo "        -H \"Content-Type: application/json\" \\"
  echo "        -d '{\"instanceName\": \"restaurante-principal\", \"integration\": \"WHATSAPP-BAILEYS\", \"qrcode\": true}'"
  echo ""
  echo "   2. Obtenha o QR Code para conectar o WhatsApp:"
  echo "      curl -X GET \"http://localhost:8080/instance/connect/restaurante-principal\" \\"
  echo "        -H \"apikey: ${API_KEY}\""
  echo ""
  echo "   A chave também está salva em: ${INSTALL_DIR}/.env"
  echo ""
else
  echo ""
  echo "⚠️  Os containers podem estar iniciando. Verifique com:"
  echo "   docker ps"
  echo "   docker logs evolution_api"
  echo ""
fi
