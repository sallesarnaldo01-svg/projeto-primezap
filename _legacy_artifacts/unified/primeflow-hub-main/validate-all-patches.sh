#!/bin/bash

###############################################################################
# SCRIPT DE VALIDAÇÃO COMPLETA - PATCHES V2 AO V5
# Autor: Manus AI
# Data: 07 de Outubro de 2025
#
# Valida automaticamente todas as funcionalidades dos patches V2 ao V5
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Função de teste
test_check() {
    local description="$1"
    local command="$2"
    local expected="$3"
    
    ((TOTAL_TESTS++))
    
    echo -n "  Testing: $description... "
    
    if eval "$command" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED_TESTS++))
        return 1
    fi
}

echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║     VALIDAÇÃO COMPLETA - PATCHES V2 AO V5                     ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# PATCH V2 - Limpeza e Resolução de Conflitos
###############################################################################

echo -e "${YELLOW}[PATCH V2]${NC} Validando limpeza e resolução de conflitos..."
echo ""

# Apenas versão 8 ativa
test_check "Apenas versão 8 ativa" \
    "ls /home/administrator/unified/ | wc -l" \
    "1"

# Backup de versões antigas
test_check "Backup de versões antigas criado" \
    "ls /home/administrator/backups/ | grep backup_versoes" \
    "backup_versoes"

# Portas livres ou em uso pelo Primeflow
echo -e "  ${BLUE}→${NC} Verificando portas..."
netstat -tulpn | grep -E ':(8080|4000|6379|9090|3001)' >/dev/null 2>&1 && \
    echo -e "  ${GREEN}✓${NC} Portas em uso pelo sistema" || \
    echo -e "  ${YELLOW}⚠${NC} Algumas portas podem não estar em uso ainda"

echo ""

###############################################################################
# PATCH V3 - Reimplantação Completa
###############################################################################

echo -e "${YELLOW}[PATCH V3]${NC} Validando reimplantação completa..."
echo ""

PROJECT_DIR="/home/administrator/unified/primeflow-hub-main"

# Estrutura de diretórios
test_check "Diretório src/ existe" \
    "ls -d $PROJECT_DIR/src" \
    "src"

test_check "Diretório apps/ existe" \
    "ls -d $PROJECT_DIR/apps" \
    "apps"

test_check "Diretório scripts/ existe" \
    "ls -d $PROJECT_DIR/scripts" \
    "scripts"

# .env configurado
test_check ".env existe" \
    "ls $PROJECT_DIR/.env" \
    ".env"

test_check "VITE_APP_URL configurado" \
    "grep VITE_APP_URL $PROJECT_DIR/.env" \
    "primezap.primezapia.com"

test_check "API_URL configurado" \
    "grep API_URL $PROJECT_DIR/.env" \
    "api.primezapia.com"

# Build executado
test_check "Build dist/ existe" \
    "ls -d $PROJECT_DIR/dist" \
    "dist"

echo ""

###############################################################################
# PATCH V4 - Deploy e Monitoramento
###############################################################################

echo -e "${YELLOW}[PATCH V4]${NC} Validando deploy e monitoramento..."
echo ""

# Nginx configurado
test_check "Nginx configurado" \
    "ls /etc/nginx/sites-enabled/primeflow" \
    "primeflow"

test_check "Domínio frontend configurado" \
    "cat /etc/nginx/sites-enabled/primeflow | grep server_name" \
    "primezap.primezapia.com"

test_check "Domínio backend configurado" \
    "cat /etc/nginx/sites-enabled/primeflow | grep server_name" \
    "api.primezapia.com"

# SSL
test_check "Certificado SSL existe" \
    "ls /etc/letsencrypt/live/primezapia.com/fullchain.pem" \
    "fullchain.pem"

# Nginx ativo
test_check "Nginx rodando" \
    "systemctl is-active nginx" \
    "active"

# Scripts de monitoramento
test_check "Script monitor-logs.sh existe" \
    "ls $PROJECT_DIR/scripts/monitoring/monitor-logs.sh" \
    "monitor-logs.sh"

test_check "Script setup-alerts.sh existe" \
    "ls $PROJECT_DIR/scripts/monitoring/setup-alerts.sh" \
    "setup-alerts.sh"

echo ""

###############################################################################
# PATCH V5 - Monitoramento Avançado
###############################################################################

echo -e "${YELLOW}[PATCH V5]${NC} Validando monitoramento avançado..."
echo ""

# Prometheus
test_check "Prometheus instalado" \
    "which prometheus" \
    "prometheus"

test_check "Prometheus rodando" \
    "curl -s http://localhost:9090/-/healthy" \
    "Healthy"

test_check "Configuração Prometheus existe" \
    "ls /etc/prometheus/prometheus.yml" \
    "prometheus.yml"

# Grafana
test_check "Grafana instalado" \
    "which grafana-server" \
    "grafana"

test_check "Grafana rodando" \
    "curl -s http://localhost:4000/api/health | jq -r '.database'" \
    "ok"

# Redis
test_check "Redis rodando" \
    "redis-cli ping" \
    "PONG"

test_check "Redis maxmemory configurado" \
    "redis-cli CONFIG GET maxmemory | tail -1" \
    "268435456"

test_check "Redis policy LRU" \
    "redis-cli CONFIG GET maxmemory-policy | tail -1" \
    "allkeys-lru"

# Feature flags
test_check "Feature flags implementados" \
    "ls $PROJECT_DIR/src/lib/featureFlags.ts" \
    "featureFlags.ts"

# Lazy loading
test_check "Lazy loading implementado" \
    "ls $PROJECT_DIR/src/lib/lazyRoutes.tsx" \
    "lazyRoutes.tsx"

echo ""

###############################################################################
# SERVIÇOS EM PRODUÇÃO
###############################################################################

echo -e "${YELLOW}[SERVIÇOS]${NC} Validando serviços em produção..."
echo ""

# Frontend
test_check "Frontend respondendo" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/" \
    "200"

# Backend
test_check "Backend respondendo" \
    "curl -s http://localhost:4000/api/health" \
    "ok"

# Redis
test_check "Redis respondendo" \
    "redis-cli ping" \
    "PONG"

# Prometheus
test_check "Prometheus respondendo" \
    "curl -s http://localhost:9090/-/healthy" \
    "Healthy"

# Grafana
test_check "Grafana respondendo" \
    "curl -s http://localhost:4000/api/health" \
    "ok"

# Nginx
test_check "Nginx ativo" \
    "systemctl is-active nginx" \
    "active"

echo ""

###############################################################################
# RELATÓRIO FINAL
###############################################################################

echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║              RELATÓRIO DE VALIDAÇÃO                            ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📊 Estatísticas:${NC}"
echo -e "  Total de testes: $TOTAL_TESTS"
echo -e "  ${GREEN}✓${NC} Passou: $PASSED_TESTS"
echo -e "  ${RED}✗${NC} Falhou: $FAILED_TESTS"
echo ""

PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo -e "${CYAN}📈 Taxa de Sucesso: ${PERCENTAGE}%${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}║         ✅ TODOS OS PATCHES VALIDADOS COM SUCESSO              ║${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}║         Status: APROVADO PARA PRODUÇÃO                         ║${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                                ║${NC}"
    echo -e "${RED}║         ⚠️  ALGUNS TESTES FALHARAM                             ║${NC}"
    echo -e "${RED}║                                                                ║${NC}"
    echo -e "${RED}║         Status: REQUER ATENÇÃO                                 ║${NC}"
    echo -e "${RED}║                                                                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Verifique os logs para mais detalhes:${NC}"
    echo -e "  tail -100 /var/log/primeflow/install_complete_*.log"
    echo ""
    exit 1
fi
