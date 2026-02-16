#!/bin/bash

# ============================================================================
# COMANDOS GIT - Conectar ao GitHub
# ============================================================================
# 
# INSTRUÇÕES:
# 1. Crie o repositório no GitHub primeiro: https://github.com/new
# 2. Substitua SEU-USUARIO pelo seu username do GitHub
# 3. Execute os comandos abaixo
#
# ============================================================================

# SUBSTITUA AQUI! ⬇️
GITHUB_USERNAME="SEU-USUARIO"  # <-- Coloque seu username aqui!
REPO_NAME="app-restaurante-sistema"

# ============================================================================
# NÃO MEXA DAQUI PARA BAIXO (a menos que saiba o que está fazendo)
# ============================================================================

echo ""
echo "🚀 Conectando ao GitHub..."
echo ""

# Verificar se já tem remote
if git remote | grep -q "origin"; then
    echo "⚠️  Remote 'origin' já existe. Removendo..."
    git remote remove origin
fi

# Adicionar remote
echo "📡 Adicionando remote..."
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

# Verificar
echo ""
echo "✅ Remote adicionado:"
git remote -v

# Push
echo ""
echo "📤 Fazendo push para o GitHub..."
echo ""
git push -u origin main

echo ""
echo "🎉 Pronto! Seu código está no GitHub!"
echo ""
echo "🔗 Acesse: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo ""
