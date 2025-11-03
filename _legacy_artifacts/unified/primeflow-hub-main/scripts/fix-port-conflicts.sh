#!/bin/bash

###############################################################################
# SCRIPT DE RESOLUÇÃO DE CONFLITOS DE PORTA - PRIMEFLOW-HUB
# Autor: Manus AI
# Data: 07 de Outubro de 2025
# Versão: 8.0.0-complete
#
# Detecta e resolve conflitos de porta entre serviços
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variáveis
PROJECT_DIR="${PROJECT_DIR:-/home/administrator/unified/primeflow-hub-main}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   RESOLUÇÃO DE CONFLITOS DE PORTA - PRIMEFLOW-HUB V8          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# FASE 1: DETECTAR PORTAS EM USO
###############################################################################

echo -e "${YELLOW}[FASE 1/4]${NC} Detectando portas em uso..."

# Portas padrão do projeto
declare -A PORTS=(
    ["Frontend"]=8080
    ["Backend API"]=4000
    ["PostgreSQL"]=5432
    ["Redis"]=6379
    ["Worker"]=4001
    ["WhatsApp"]=3000
)

# Verificar cada porta
CONFLICTS=()

for service in "${!PORTS[@]}"; do
    port=${PORTS[$service]}
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        echo -e "${RED}✗${NC} Porta $port ($service) em uso por PID $pid ($process)"
        CONFLICTS+=("$service:$port:$pid")
    else
        echo -e "${GREEN}✓${NC} Porta $port ($service) disponível"
    fi
done

if [ ${#CONFLICTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Nenhum conflito de porta detectado"
    exit 0
fi

echo -e "${YELLOW}⚠${NC} Encontrados ${#CONFLICTS[@]} conflitos de porta"

###############################################################################
# FASE 2: PARAR PROCESSOS CONFLITANTES
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 2/4]${NC} Parando processos conflitantes..."

for conflict in "${CONFLICTS[@]}"; do
    IFS=':' read -r service port pid <<< "$conflict"
    
    echo -e "${BLUE}→${NC} Parando processo na porta $port (PID $pid)..."
    
    # Tentar parar graciosamente
    kill -TERM $pid 2>/dev/null || true
    sleep 2
    
    # Forçar se ainda estiver rodando
    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠${NC} Processo não respondeu, forçando..."
        kill -KILL $pid 2>/dev/null || true
    fi
    
    # Verificar se a porta foi liberada
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}✗${NC} Erro ao liberar porta $port"
    else
        echo -e "${GREEN}✓${NC} Porta $port liberada"
    fi
done

###############################################################################
# FASE 3: ATUALIZAR CONFIGURAÇÕES
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 3/4]${NC} Atualizando configurações..."

cd "$PROJECT_DIR" || exit 1

# Atualizar .env se existir
if [ -f ".env" ]; then
    echo -e "${BLUE}→${NC} Atualizando .env..."
    
    # Backup
    cp .env .env.backup.ports
    
    # Atualizar portas
    sed -i 's/^PORT=.*/PORT=4000/' .env
    sed -i 's/^REDIS_PORT=.*/REDIS_PORT=6379/' .env
    sed -i 's/^FRONTEND_PORT=.*/FRONTEND_PORT=8080/' .env
    
    echo -e "${GREEN}✓${NC} .env atualizado"
fi

# Atualizar docker-compose.yml se existir
if [ -f "docker-compose.yml" ]; then
    echo -e "${BLUE}→${NC} Verificando docker-compose.yml..."
    
    # Backup
    cp docker-compose.yml docker-compose.yml.backup.ports
    
    # Verificar mapeamento de portas
    if grep -q "8080:80" docker-compose.yml; then
        echo -e "${GREEN}✓${NC} docker-compose.yml com portas corretas"
    else
        echo -e "${YELLOW}⚠${NC} docker-compose.yml pode precisar de ajustes manuais"
    fi
fi

# Atualizar package.json scripts se necessário
if [ -f "package.json" ]; then
    echo -e "${BLUE}→${NC} Verificando package.json..."
    
    if grep -q '"dev":.*--port' package.json; then
        echo -e "${GREEN}✓${NC} Scripts de dev configurados"
    fi
fi

###############################################################################
# FASE 4: VALIDAÇÃO
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 4/4]${NC} Validando resolução de conflitos..."

# Verificar novamente todas as portas
ALL_CLEAR=true

for service in "${!PORTS[@]}"; do
    port=${PORTS[$service]}
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}✗${NC} Porta $port ($service) ainda em uso"
        ALL_CLEAR=false
    else
        echo -e "${GREEN}✓${NC} Porta $port ($service) disponível"
    fi
done

###############################################################################
# RELATÓRIO FINAL
###############################################################################

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"

if [ "$ALL_CLEAR" = true ]; then
    echo -e "${BLUE}║         CONFLITOS DE PORTA RESOLVIDOS COM SUCESSO              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Todas as portas liberadas"
    echo -e "${GREEN}✓${NC} Configurações atualizadas"
    echo -e "${GREEN}✓${NC} Sistema pronto para iniciar"
    echo ""
    echo -e "${BLUE}Portas configuradas:${NC}"
    for service in "${!PORTS[@]}"; do
        echo -e "  - $service: ${PORTS[$service]}"
    done
    echo ""
    echo -e "${YELLOW}Próximo passo:${NC}"
    echo -e "  make docker-up  # ou npm run dev"
    echo ""
    exit 0
else
    echo -e "${BLUE}║           ALGUNS CONFLITOS AINDA PERSISTEM                     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}✗${NC} Alguns conflitos não foram resolvidos automaticamente"
    echo -e "${YELLOW}⚠${NC} Verifique manualmente os processos em uso"
    echo ""
    echo -e "${YELLOW}Comandos úteis:${NC}"
    echo -e "  lsof -i :PORT          # Ver processo usando a porta"
    echo -e "  kill -9 PID            # Forçar parada do processo"
    echo -e "  docker ps              # Ver containers rodando"
    echo -e "  docker stop CONTAINER  # Parar container"
    echo ""
    exit 1
fi
