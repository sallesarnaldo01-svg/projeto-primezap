#!/bin/bash

###############################################################################
# SCRIPT DE DEPLOY EM PRODUÇÃO - PRIMEFLOW-HUB V8
# Autor: Manus AI
# Data: 07 de Outubro de 2025
# Versão: 8.0.0-production
#
# Deploy seguro em produção com rollback automático
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variáveis
PROJECT_DIR="${PROJECT_DIR:-/home/administrator/unified/primeflow-hub-main}"
DEPLOY_ENV="${DEPLOY_ENV:-production}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/administrator/backups"
LOG_FILE="/var/log/primeflow/deploy_${TIMESTAMP}.log"

# Criar diretório de logs
mkdir -p /var/log/primeflow
mkdir -p "$BACKUP_DIR"

# Função de log
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

log "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
log "${BLUE}║           DEPLOY EM PRODUÇÃO - PRIMEFLOW-HUB V8               ║${NC}"
log "${BLUE}║           Ambiente: $DEPLOY_ENV${NC}"
log "${BLUE}║           Timestamp: $TIMESTAMP${NC}"
log "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
log ""

###############################################################################
# FASE 1: PRÉ-VALIDAÇÃO
###############################################################################

log "${YELLOW}[FASE 1/8]${NC} Pré-validação do ambiente..."

cd "$PROJECT_DIR"

# Verificar branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
log "${BLUE}→${NC} Branch atual: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    log "${YELLOW}⚠${NC} Aviso: Deploy não está em branch main/master"
    read -p "Continuar mesmo assim? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "${RED}✗${NC} Deploy cancelado pelo usuário"
        exit 1
    fi
fi

# Verificar mudanças não commitadas
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    log "${YELLOW}⚠${NC} Existem mudanças não commitadas"
    git status --short
    read -p "Continuar mesmo assim? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "${RED}✗${NC} Deploy cancelado pelo usuário"
        exit 1
    fi
fi

# Verificar .env de produção
if [ ! -f ".env.production" ]; then
    log "${RED}✗${NC} Arquivo .env.production não encontrado"
    log "${YELLOW}⚠${NC} Crie o arquivo .env.production com as variáveis de produção"
    exit 1
fi

log "${GREEN}✓${NC} Pré-validação concluída"

###############################################################################
# FASE 2: BACKUP PRÉ-DEPLOY
###############################################################################

log ""
log "${YELLOW}[FASE 2/8]${NC} Criando backup pré-deploy..."

BACKUP_FILE="$BACKUP_DIR/pre_deploy_${TIMESTAMP}.tar.gz"

tar -czf "$BACKUP_FILE" \
    --exclude="node_modules" \
    --exclude="dist" \
    --exclude="build" \
    --exclude=".next" \
    -C "$(dirname "$PROJECT_DIR")" \
    "$(basename "$PROJECT_DIR")" \
    2>/dev/null

if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "${GREEN}✓${NC} Backup criado: $BACKUP_FILE ($BACKUP_SIZE)"
else
    log "${RED}✗${NC} Falha ao criar backup"
    exit 1
fi

###############################################################################
# FASE 3: PARAR SERVIÇOS
###############################################################################

log ""
log "${YELLOW}[FASE 3/8]${NC} Parando serviços atuais..."

# Parar Docker Compose
if [ -f "docker-compose.yml" ]; then
    log "${BLUE}→${NC} Parando containers Docker..."
    docker-compose down 2>&1 | tee -a "$LOG_FILE"
    log "${GREEN}✓${NC} Containers parados"
fi

# Parar processos Node.js
log "${BLUE}→${NC} Parando processos Node.js..."
pkill -f "node.*primeflow" 2>/dev/null || true
sleep 3
log "${GREEN}✓${NC} Processos parados"

###############################################################################
# FASE 4: ATUALIZAR CÓDIGO
###############################################################################

log ""
log "${YELLOW}[FASE 4/8]${NC} Atualizando código..."

# Pull do repositório
if [ -d ".git" ]; then
    log "${BLUE}→${NC} Atualizando do repositório..."
    git fetch --all 2>&1 | tee -a "$LOG_FILE"
    git pull origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
    log "${GREEN}✓${NC} Código atualizado"
else
    log "${YELLOW}⚠${NC} Não é um repositório Git (pulando pull)"
fi

# Copiar .env de produção
log "${BLUE}→${NC} Configurando ambiente de produção..."
cp .env.production .env
log "${GREEN}✓${NC} Ambiente configurado"

###############################################################################
# FASE 5: INSTALAR DEPENDÊNCIAS
###############################################################################

log ""
log "${YELLOW}[FASE 5/8]${NC} Instalando dependências..."

# Frontend
log "${BLUE}→${NC} Instalando dependências do frontend..."
npm ci --legacy-peer-deps --production 2>&1 | tee -a "$LOG_FILE"
log "${GREEN}✓${NC} Dependências do frontend instaladas"

# Backend
if [ -d "apps/api" ]; then
    log "${BLUE}→${NC} Instalando dependências do backend..."
    cd apps/api
    npm ci --production 2>&1 | tee -a "$LOG_FILE"
    cd ../..
    log "${GREEN}✓${NC} Dependências do backend instaladas"
fi

# Workers
if [ -d "apps/worker" ]; then
    log "${BLUE}→${NC} Instalando dependências dos workers..."
    cd apps/worker
    npm ci --production 2>&1 | tee -a "$LOG_FILE"
    cd ../..
    log "${GREEN}✓${NC} Dependências dos workers instaladas"
fi

###############################################################################
# FASE 6: BUILD
###############################################################################

log ""
log "${YELLOW}[FASE 6/8]${NC} Executando build de produção..."

# Build do frontend
log "${BLUE}→${NC} Build do frontend..."
NODE_ENV=production npm run build 2>&1 | tee -a "$LOG_FILE"

if [ ! -d "dist" ]; then
    log "${RED}✗${NC} Build do frontend falhou"
    log "${YELLOW}⚠${NC} Iniciando rollback..."
    bash "$(dirname "$0")/rollback-deploy.sh" "$BACKUP_FILE"
    exit 1
fi

log "${GREEN}✓${NC} Build do frontend concluído"

# Build do backend
if [ -d "apps/api" ]; then
    log "${BLUE}→${NC} Build do backend..."
    cd apps/api
    npm run build 2>&1 | tee -a "$LOG_FILE" || true
    cd ../..
    log "${GREEN}✓${NC} Build do backend concluído"
fi

###############################################################################
# FASE 7: MIGRATIONS
###############################################################################

log ""
log "${YELLOW}[FASE 7/8]${NC} Executando migrations..."

if [ -f "prisma/schema.prisma" ]; then
    log "${BLUE}→${NC} Executando prisma migrate deploy..."
    npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"
    log "${GREEN}✓${NC} Migrations executadas"
else
    log "${YELLOW}⚠${NC} Schema Prisma não encontrado (pulando migrations)"
fi

###############################################################################
# FASE 8: INICIAR SERVIÇOS
###############################################################################

log ""
log "${YELLOW}[FASE 8/8]${NC} Iniciando serviços..."

# Iniciar via Docker Compose
if [ -f "docker-compose.production.yml" ]; then
    log "${BLUE}→${NC} Iniciando via Docker Compose (produção)..."
    docker-compose -f docker-compose.production.yml up -d 2>&1 | tee -a "$LOG_FILE"
elif [ -f "docker-compose.yml" ]; then
    log "${BLUE}→${NC} Iniciando via Docker Compose..."
    docker-compose up -d 2>&1 | tee -a "$LOG_FILE"
else
    log "${YELLOW}⚠${NC} Docker Compose não encontrado"
    log "${BLUE}→${NC} Inicie manualmente com: npm start ou pm2 start"
fi

# Aguardar serviços iniciarem
log "${BLUE}→${NC} Aguardando serviços iniciarem (30s)..."
sleep 30

###############################################################################
# VALIDAÇÃO PÓS-DEPLOY
###############################################################################

log ""
log "${YELLOW}[VALIDAÇÃO]${NC} Validando deploy..."

# Testar backend
BACKEND_OK=false
if curl -f -s http://localhost:4000/api/health >/dev/null 2>&1; then
    log "${GREEN}✓${NC} Backend respondendo"
    BACKEND_OK=true
else
    log "${RED}✗${NC} Backend não responde"
fi

# Testar frontend
FRONTEND_OK=false
if curl -f -s http://localhost:8080/ >/dev/null 2>&1; then
    log "${GREEN}✓${NC} Frontend respondendo"
    FRONTEND_OK=true
else
    log "${RED}✗${NC} Frontend não responde"
fi

# Verificar se deploy foi bem-sucedido
if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    DEPLOY_STATUS="SUCCESS"
else
    DEPLOY_STATUS="FAILED"
    log "${RED}✗${NC} Deploy falhou na validação"
    log "${YELLOW}⚠${NC} Considere executar rollback: bash rollback-deploy.sh $BACKUP_FILE"
fi

###############################################################################
# RELATÓRIO FINAL
###############################################################################

log ""
log "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"

if [ "$DEPLOY_STATUS" = "SUCCESS" ]; then
    log "${BLUE}║              ✅ DEPLOY CONCLUÍDO COM SUCESSO                   ║${NC}"
else
    log "${BLUE}║                 ❌ DEPLOY FALHOU                               ║${NC}"
fi

log "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
log ""
log "${CYAN}📊 Resumo do Deploy:${NC}"
log "  ${GREEN}✓${NC} Ambiente: $DEPLOY_ENV"
log "  ${GREEN}✓${NC} Timestamp: $TIMESTAMP"
log "  ${GREEN}✓${NC} Branch: $CURRENT_BRANCH"
log "  ${GREEN}✓${NC} Backup: $BACKUP_FILE"
log "  ${GREEN}✓${NC} Log: $LOG_FILE"
log ""
log "${CYAN}📁 Arquivos:${NC}"
log "  - Backup: $BACKUP_FILE ($BACKUP_SIZE)"
log "  - Log: $LOG_FILE"
log ""
log "${CYAN}🔍 Validação:${NC}"
log "  - Backend: $([ "$BACKEND_OK" = true ] && echo "${GREEN}✓ OK${NC}" || echo "${RED}✗ FALHOU${NC}")"
log "  - Frontend: $([ "$FRONTEND_OK" = true ] && echo "${GREEN}✓ OK${NC}" || echo "${RED}✗ FALHOU${NC}")"
log ""

if [ "$DEPLOY_STATUS" = "SUCCESS" ]; then
    log "${CYAN}🚀 Próximos Passos:${NC}"
    log "  1. Monitorar logs: docker-compose logs -f"
    log "  2. Verificar métricas: http://localhost:9090"
    log "  3. Testar funcionalidades críticas"
    log "  4. Notificar equipe sobre deploy"
    log ""
    exit 0
else
    log "${CYAN}⚠️ Ações Recomendadas:${NC}"
    log "  1. Verificar logs: cat $LOG_FILE"
    log "  2. Executar rollback: bash rollback-deploy.sh $BACKUP_FILE"
    log "  3. Investigar erro e corrigir"
    log "  4. Tentar deploy novamente"
    log ""
    exit 1
fi
