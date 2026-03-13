#!/bin/bash
# Executa fix-qr-connection.sh na VPS via SSH
# Uso: ./run-fix-qr-remote.sh [IP_DA_VPS]
# Exemplo: ./run-fix-qr-remote.sh 187.77.239.154

VPS_IP="${1:-}"
if [ -z "$VPS_IP" ]; then
  echo "Uso: $0 IP_DA_VPS"
  echo "Exemplo: $0 187.77.239.154"
  echo ""
  echo "Obtenha o IP em: Hostinger → VPS → seu servidor → IP público"
  exit 1
fi

echo "Conectando em root@$VPS_IP e executando fix-qr-connection.sh..."
echo ""

ssh root@"$VPS_IP" 'cd ~/evolution-api-setup 2>/dev/null || cd /root/evolution-api-setup 2>/dev/null && chmod +x fix-qr-connection.sh && ./fix-qr-connection.sh'
