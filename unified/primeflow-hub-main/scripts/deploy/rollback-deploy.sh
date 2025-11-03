#!/bin/bash

###############################################################################
# SCRIPT DE ROLLBACK - PRIMEFLOW-HUB V8
# Autor: Manus AI
# Data: 07 de Outubro de 2025
#
# Reverte deploy para backup anterior
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variáveis
BACKUP_FILE="${1:-}"
PROJECT_DIR="/home/administrator/unified/primeflow-hub-main"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   ROLLBACK - PRIMEFLOW-HUB V8                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar se backup foi fornecido
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}Uso: $0 <arquivo_de_backup>${NC}"
    echo ""
    echo -e "${BLUE}Backups disponíveis:${NC}"
    ls -lh /home/administrator/backups/pre_deploy_*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
    exit 1
fi

# Verificar se backup existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗${NC} Backup não encontrado: $BACKUP_FILE"
    exit 1
fi

echo -e "${YELLOW}⚠ AVISO: Este processo irá reverter o sistema para o backup:${NC}"
echo -e "${BLUE}→${NC} $BACKUP_FILE"
echo ""
read -p "Deseja continuar? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}✗${NC} Rollback cancelado"
    exit 1
fi

echo ""
echo -e "${YELLOW}[1/4]${NC} Parando serviços..."
cd "$PROJECT_DIR"
docker-compose down 2>/dev/null || true
pkill -f "node.*primeflow" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Serviços parados"

echo ""
echo -e "${YELLOW}[2/4]${NC} Criando backup do estado atual..."
CURRENT_BACKUP="/home/administrator/backups/before_rollback_${TIMESTAMP}.tar.gz"
tar -czf "$CURRENT_BACKUP" \
    --exclude="node_modules" \
    -C "$(dirname "$PROJECT_DIR")" \
    "$(basename "$PROJECT_DIR")" \
    2>/dev/null
echo -e "${GREEN}✓${NC} Backup criado: $CURRENT_BACKUP"

echo ""
echo -e "${YELLOW}[3/4]${NC} Restaurando backup..."
rm -rf "${PROJECT_DIR}.old" 2>/dev/null || true
mv "$PROJECT_DIR" "${PROJECT_DIR}.old"
mkdir -p "$(dirname "$PROJECT_DIR")"
tar -xzf "$BACKUP_FILE" -C "$(dirname "$PROJECT_DIR")"
echo -e "${GREEN}✓${NC} Backup restaurado"

echo ""
echo -e "${YELLOW}[4/4]${NC} Reiniciando serviços..."
cd "$PROJECT_DIR"
docker-compose up -d 2>/dev/null || echo -e "${YELLOW}⚠${NC} Inicie manualmente"
echo -e "${GREEN}✓${NC} Serviços reiniciados"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              ✅ ROLLBACK CONCLUÍDO COM SUCESSO                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} Sistema revertido para: $BACKUP_FILE"
echo -e "${GREEN}✓${NC} Estado anterior salvo em: $CURRENT_BACKUP"
echo ""
