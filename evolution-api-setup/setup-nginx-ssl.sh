#!/bin/bash
# =============================================================================
# Configura Nginx + SSL (Let's Encrypt) para api.quiero.food
# Executar na VPS APÓS o install.sh e após o DNS estar propagado
# =============================================================================

set -e

DOMAIN="api.quiero.food"
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=============================================="
echo "  Nginx + SSL para ${DOMAIN}"
echo "=============================================="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute como root: sudo ./setup-nginx-ssl.sh"
  exit 1
fi

# Reinicia containers com binding 127.0.0.1:8080 (libera 80/443 para Nginx)
echo "[0/5] Aplicando nova configuração de portas..."
cd "${INSTALL_DIR}"
if docker compose ps 2>/dev/null | grep -q evolution_api; then
  docker compose down 2>/dev/null || true
  docker compose up -d 2>/dev/null || true
  sleep 5
fi
echo "✅ Evolution API agora escuta apenas em 127.0.0.1:8080."
echo ""

# -----------------------------------------------------------------------------
# 1. Instalar Nginx e Certbot
# -----------------------------------------------------------------------------
echo "[1/5] Instalando Nginx e Certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx
echo "✅ Instalado."
echo ""

# -----------------------------------------------------------------------------
# 2. Criar diretório para validação ACME
# -----------------------------------------------------------------------------
echo "[2/5] Configurando diretório ACME..."
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot
echo "✅ OK."
echo ""

# -----------------------------------------------------------------------------
# 3. Config inicial (porta 80, sem SSL) para obter certificado
# -----------------------------------------------------------------------------
echo "[3/5] Configurando Nginx (inicial)..."
cp "${INSTALL_DIR}/nginx/api.quiero.food.conf.initial" /etc/nginx/sites-available/api.quiero.food
ln -sf /etc/nginx/sites-available/api.quiero.food /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
echo "✅ Nginx configurado (HTTP na porta 80)."
echo ""

# -----------------------------------------------------------------------------
# 4. Obter certificado SSL
# -----------------------------------------------------------------------------
echo "[4/5] Obtendo certificado SSL..."
echo "   Verifique se ${DOMAIN} aponta para este servidor (propagação DNS)."
echo ""
certbot certonly --webroot -w /var/www/certbot -d "${DOMAIN}" --non-interactive --agree-tos --email flxlima9@gmail.com --no-eff-email 2>/dev/null || {
  echo "⚠️  Certbot falhou. Confirme que:"
  echo "   1. api.quiero.food aponta para o IP desta VPS"
  echo "   2. A porta 80 está liberada no firewall"
  echo ""
  echo "   Tente manualmente:"
  echo "   certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN}"
  exit 1
}
echo "✅ Certificado obtido."
echo ""

# -----------------------------------------------------------------------------
# 5. Config final com SSL
# -----------------------------------------------------------------------------
echo "[5/5] Aplicando config SSL..."
cp "${INSTALL_DIR}/nginx/api.quiero.food.conf" /etc/nginx/sites-available/api.quiero.food
nginx -t && systemctl reload nginx
echo "✅ SSL ativo."
echo ""

# -----------------------------------------------------------------------------
# Atualizar .env com SERVER_URL (se existir)
# -----------------------------------------------------------------------------
ENV_FILE="${INSTALL_DIR}/.env"
if [ -f "${ENV_FILE}" ] && ! grep -q "SERVER_URL" "${ENV_FILE}"; then
  echo "" >> "${ENV_FILE}"
  echo "# URL pública da API (para webhooks/QR)" >> "${ENV_FILE}"
  echo "SERVER_URL=https://${DOMAIN}" >> "${ENV_FILE}"
  cd "${INSTALL_DIR}"
  if docker compose ps 2>/dev/null | grep -q evolution_api; then
    docker compose up -d evolution-api 2>/dev/null || true
    echo "   Evolution API reiniciada com SERVER_URL."
  fi
fi

echo "=============================================="
echo "  ✅ Pronto!"
echo "=============================================="
echo ""
echo "📍 Evolution API: https://${DOMAIN}"
echo "📍 Manager:       https://${DOMAIN}/manager"
echo ""
echo "   Renovação automática do certificado está configurada (certbot)."
echo ""
