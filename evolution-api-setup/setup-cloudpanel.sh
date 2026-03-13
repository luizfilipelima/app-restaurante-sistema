#!/bin/bash
# =============================================================================
# Evolution API — Setup para VPS com CloudPanel (Hostinger)
#
# Este script cuida apenas de Docker + containers.
# Nginx e SSL são gerenciados pelo CloudPanel — NÃO execute setup-nginx-ssl.sh.
#
# Como usar:
#   No seu Mac, copie os arquivos para a VPS:
#     scp -r evolution-api-setup root@187.77.239.154:~/
#   Conecte na VPS:
#     ssh root@187.77.239.154
#   Execute:
#     cd ~/evolution-api-setup
#     chmod +x setup-cloudpanel.sh
#     ./setup-cloudpanel.sh
#
# Pré-requisito: api.quiero.food deve apontar para o IP desta VPS (DNS propagado)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  Evolution API — Setup (CloudPanel / Docker)"
echo "=============================================="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute como root: sudo ./setup-cloudpanel.sh"
  exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml não encontrado."
  echo "   Execute dentro da pasta evolution-api-setup."
  exit 1
fi

# -----------------------------------------------------------------------------
# 1. Atualizar pacotes do sistema
# -----------------------------------------------------------------------------
echo "[1/3] Atualizando pacotes..."
apt-get update -qq && apt-get upgrade -y -qq
echo "✅ Sistema atualizado."
echo ""

# -----------------------------------------------------------------------------
# 2. Instalar Docker (se não estiver instalado)
# -----------------------------------------------------------------------------
echo "[2/3] Verificando Docker..."
if command -v docker &> /dev/null; then
  echo "✅ Docker já instalado: $(docker --version)"
else
  echo "   Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  echo "✅ Docker instalado: $(docker --version)"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Gerar .env e subir containers
# -----------------------------------------------------------------------------
echo "[3/3] Configurando Evolution API..."

if [ -f ".env" ] && grep -q "AUTHENTICATION_API_KEY" .env; then
  echo "   Arquivo .env já existe. Usando configuração existente."
  API_KEY=$(grep "^AUTHENTICATION_API_KEY=" .env | cut -d'=' -f2)
  POSTGRES_PASS=$(grep "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2)
else
  API_KEY=$(openssl rand -hex 16)
  POSTGRES_PASS=$(openssl rand -hex 12)

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

# URL pública (CloudPanel configurará o proxy para 127.0.0.1:8080)
SERVER_URL=https://api.quiero.food
WEBSOCKET_ENABLED=true
CONFIG_SESSION_PHONE_VERSION=2.3000.1023923395
EOF
  echo "✅ Arquivo .env criado."
fi

# Subir containers
echo ""
echo "   Subindo containers Docker..."
if docker compose version &> /dev/null 2>&1; then
  docker compose up -d
else
  docker-compose up -d
fi

echo ""
echo "⏳ Aguardando containers iniciarem (30s)..."
sleep 30

# Verificar se está rodando
if docker ps | grep -q evolution_api; then
  echo ""
  echo "=============================================="
  echo "  ✅ Evolution API rodando com sucesso!"
  echo "=============================================="
  echo ""
  echo "  Escutando em: http://127.0.0.1:8080"
  echo ""
  echo "  🔑 CHAVE DE API (copie agora):"
  echo "     ${API_KEY}"
  echo ""
  echo "  Chave também salva em: ${SCRIPT_DIR}/.env"
  echo ""
  echo "----------------------------------------------"
  echo "  PRÓXIMOS PASSOS (faça no CloudPanel)"
  echo "----------------------------------------------"
  echo ""
  echo "  1. Criar site no CloudPanel:"
  echo "     CloudPanel → Sites → + Add Site → Node.js ou Reverse Proxy"
  echo "     Domínio: api.quiero.food"
  echo "     Tipo: Reverse Proxy"
  echo "     URL destino: http://127.0.0.1:8080"
  echo ""
  echo "  2. Ativar SSL no CloudPanel:"
  echo "     Sites → api.quiero.food → SSL/TLS → Let's Encrypt → Issue"
  echo ""
  echo "  3. Testar (após SSL ativo):"
  echo "     https://api.quiero.food"
  echo "     https://api.quiero.food/manager"
  echo ""
  echo "  4. No seu Mac, configure os secrets do Supabase:"
  echo "     npx supabase secrets set EVOLUTION_API_BASE_URL=\"https://api.quiero.food\""
  echo "     npx supabase secrets set EVOLUTION_API_KEY=\"${API_KEY}\""
  echo "     npx supabase secrets set WEBHOOK_BASE_URL=\"https://app.quiero.food\""
  echo ""
  echo "  5. Deploy das Edge Functions:"
  echo "     npx supabase functions deploy get-evolution-qrcode"
  echo "     npx supabase functions deploy evolution-disconnect"
  echo "     npx supabase functions deploy send-order-whatsapp-notification"
  echo ""
  echo "  Guia completo: ~/evolution-api-setup/SETUP-CLOUDPANEL.md"
  echo ""
else
  echo ""
  echo "⚠️  Container não está rodando ainda. Verifique com:"
  echo "   docker ps"
  echo "   docker compose logs evolution-api"
  echo ""
fi
