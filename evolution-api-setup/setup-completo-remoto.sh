#!/bin/bash
# =============================================================================
# Evolution API — Setup completo (install + nginx + ssl)
# Executar NA VPS, dentro da pasta evolution-api-setup (após scp):
#
#   scp -r evolution-api-setup root@SEU_IP:~/
#   ssh root@SEU_IP
#   cd ~/evolution-api-setup
#   chmod +x setup-completo-remoto.sh
#   ./setup-completo-remoto.sh
#
# Pré-requisito: api.quiero.food deve apontar para o IP desta VPS (DNS propagado)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute como root: sudo ./setup-completo-remoto.sh"
  exit 1
fi

echo "=============================================="
echo "  Evolution API — Setup Completo"
echo "=============================================="
echo ""

# 1. Instalação base (Docker + containers)
if [ -f "install.sh" ]; then
  echo "[1/2] Executando install.sh..."
  chmod +x install.sh
  ./install.sh
else
  echo "❌ install.sh não encontrado."
  exit 1
fi

# 2. Nginx + SSL
if [ -f "setup-nginx-ssl.sh" ]; then
  echo ""
  echo "[2/2] Executando setup-nginx-ssl.sh..."
  chmod +x setup-nginx-ssl.sh
  ./setup-nginx-ssl.sh
else
  echo "⚠️  setup-nginx-ssl.sh não encontrado. SSL não configurado."
  echo "   Configure manualmente ou copie o arquivo e execute novamente."
fi

echo ""
echo "=============================================="
echo "  ✅ Setup completo finalizado!"
echo "=============================================="
echo ""
echo "Próximos passos:"
echo "  1. Copie AUTHENTICATION_API_KEY do .env (cat .env)"
echo "  2. Configure no Supabase: npx supabase secrets set EVOLUTION_API_KEY=\"SUA_CHAVE\""
echo "  3. Configure: EVOLUTION_API_BASE_URL e WEBHOOK_BASE_URL"
echo "  4. Deploy: npx supabase functions deploy get-evolution-qrcode"
echo "  5. Habilite o restaurante no Super Admin"
echo ""
