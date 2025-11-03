#!/bin/bash

###############################################################################
# SCRIPT DE LIMPEZA DE VERSÕES ANTIGAS - PRIMEFLOW-HUB
# Autor: Manus AI
# Data: 07 de Outubro de 2025
# Versão: 8.0.0-complete
#
# Remove todas as versões anteriores à V8 e arquiva em backup
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variáveis
BASE_DIR="${BASE_DIR:-/home/administrator/unified}"
BACKUP_FILE="/home/administrator/backup_versoes_anteriores.zip"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   LIMPEZA DE VERSÕES ANTIGAS - PRIMEFLOW-HUB V8               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# FASE 1: IDENTIFICAR VERSÕES ANTIGAS
###############################################################################

echo -e "${YELLOW}[FASE 1/4]${NC} Identificando versões antigas..."

cd "$BASE_DIR" || exit 1

# Listar todos os diretórios que não são a versão 8
OLD_VERSIONS=()

for dir in version*_primeflow; do
    if [ -d "$dir" ] && [ "$dir" != "version8_primeflow" ]; then
        OLD_VERSIONS+=("$dir")
        echo -e "${BLUE}→${NC} Encontrado: $dir"
    fi
done

# Verificar se há versões antigas
if [ ${#OLD_VERSIONS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Nenhuma versão antiga encontrada"
    echo -e "${GREEN}✓${NC} Sistema já está limpo com apenas a Versão 8"
    exit 0
fi

echo -e "${YELLOW}⚠${NC} Encontradas ${#OLD_VERSIONS[@]} versões antigas para remover"

###############################################################################
# FASE 2: CRIAR BACKUP DAS VERSÕES ANTIGAS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 2/4]${NC} Criando backup das versões antigas..."

# Remover backup anterior se existir
if [ -f "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}⚠${NC} Backup anterior encontrado, renomeando..."
    mv "$BACKUP_FILE" "${BACKUP_FILE}.${TIMESTAMP}.old"
fi

# Criar arquivo zip com todas as versões antigas
echo -e "${BLUE}→${NC} Compactando versões antigas..."

zip -r "$BACKUP_FILE" "${OLD_VERSIONS[@]}" \
    -x "*/node_modules/*" \
    -x "*/dist/*" \
    -x "*/.next/*" \
    -x "*/build/*" \
    > /dev/null 2>&1

if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓${NC} Backup criado: $BACKUP_FILE (${BACKUP_SIZE})"
else
    echo -e "${RED}✗${NC} Erro ao criar backup"
    exit 1
fi

###############################################################################
# FASE 3: REMOVER VERSÕES ANTIGAS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 3/4]${NC} Removendo versões antigas..."

for version in "${OLD_VERSIONS[@]}"; do
    echo -e "${BLUE}→${NC} Removendo: $version"
    rm -rf "$version"
    echo -e "${GREEN}✓${NC} Removido: $version"
done

# Remover outros arquivos temporários
echo -e "${BLUE}→${NC} Limpando arquivos temporários..."

# Remover backups antigos de package.json
find "$BASE_DIR" -name "package.json.backup" -delete 2>/dev/null || true

# Remover arquivos .patch
find "$BASE_DIR" -name "*.patch" -delete 2>/dev/null || true

# Remover node_modules órfãos (fora da versão 8)
for dir in "$BASE_DIR"/*/node_modules; do
    parent_dir=$(dirname "$dir")
    if [ "$parent_dir" != "$BASE_DIR/primeflow-hub-main" ]; then
        echo -e "${BLUE}→${NC} Removendo node_modules órfão: $dir"
        rm -rf "$dir" 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓${NC} Limpeza concluída"

###############################################################################
# FASE 4: VALIDAÇÃO
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 4/4]${NC} Validando limpeza..."

# Verificar se apenas a versão 8 permanece
REMAINING_VERSIONS=$(find "$BASE_DIR" -maxdepth 1 -type d -name "version*_primeflow" | wc -l)

if [ "$REMAINING_VERSIONS" -eq 1 ]; then
    echo -e "${GREEN}✓${NC} Apenas a Versão 8 permanece ativa"
else
    echo -e "${RED}✗${NC} Erro: Ainda existem $REMAINING_VERSIONS versões no sistema"
    exit 1
fi

# Verificar tamanho do backup
if [ -f "$BACKUP_FILE" ]; then
    echo -e "${GREEN}✓${NC} Backup verificado: $BACKUP_FILE"
else
    echo -e "${RED}✗${NC} Erro: Backup não encontrado"
    exit 1
fi

###############################################################################
# RELATÓRIO FINAL
###############################################################################

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              LIMPEZA CONCLUÍDA COM SUCESSO                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} Versões antigas removidas: ${#OLD_VERSIONS[@]}"
echo -e "${GREEN}✓${NC} Backup criado: $BACKUP_FILE (${BACKUP_SIZE})"
echo -e "${GREEN}✓${NC} Apenas Versão 8 ativa"
echo -e "${GREEN}✓${NC} Sistema limpo e pronto para produção"
echo ""
echo -e "${BLUE}Versões removidas:${NC}"
for version in "${OLD_VERSIONS[@]}"; do
    echo -e "  - $version"
done
echo ""
echo -e "${YELLOW}Para restaurar uma versão antiga (se necessário):${NC}"
echo -e "  unzip $BACKUP_FILE -d $BASE_DIR"
echo ""
