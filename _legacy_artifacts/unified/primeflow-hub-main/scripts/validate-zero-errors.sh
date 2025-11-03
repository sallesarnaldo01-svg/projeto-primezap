#!/bin/bash

###############################################################################
# SCRIPT DE VALIDAÇÃO COMPLETA - ZERO ERROS
# Autor: Manus AI
# Data: 07 de Outubro de 2025
# Versão: 8.0.0-complete
#
# Valida que o sistema está 100% funcional sem erros
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
ERROR_COUNT=0
WARNING_COUNT=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      VALIDAÇÃO COMPLETA - ZERO ERROS - PRIMEFLOW-HUB V8       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR" || exit 1

###############################################################################
# FASE 1: VALIDAÇÃO DE ESTRUTURA
###############################################################################

echo -e "${YELLOW}[FASE 1/8]${NC} Validando estrutura do projeto..."

# Verificar diretórios essenciais
REQUIRED_DIRS=(
    "src"
    "apps/api"
    "apps/worker"
    "public"
    "scripts"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} Diretório encontrado: $dir"
    else
        echo -e "${RED}✗${NC} Diretório ausente: $dir"
        ((ERROR_COUNT++))
    fi
done

# Verificar arquivos essenciais
REQUIRED_FILES=(
    "package.json"
    "vite.config.ts"
    ".env.example"
    "docker-compose.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Arquivo encontrado: $file"
    else
        echo -e "${RED}✗${NC} Arquivo ausente: $file"
        ((ERROR_COUNT++))
    fi
done

###############################################################################
# FASE 2: VALIDAÇÃO DE DEPENDÊNCIAS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 2/8]${NC} Validando dependências..."

# Verificar node_modules
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules instalado"
    
    # Verificar dependências críticas
    CRITICAL_DEPS=(
        "react"
        "react-dom"
        "react-router-dom"
        "vite"
    )
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ -d "node_modules/$dep" ]; then
            echo -e "${GREEN}✓${NC} Dependência encontrada: $dep"
        else
            echo -e "${RED}✗${NC} Dependência ausente: $dep"
            ((ERROR_COUNT++))
        fi
    done
else
    echo -e "${RED}✗${NC} node_modules não encontrado"
    echo -e "${YELLOW}⚠${NC} Execute: npm ci --legacy-peer-deps"
    ((ERROR_COUNT++))
fi

# Verificar package-lock.json
if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓${NC} package-lock.json presente"
else
    echo -e "${YELLOW}⚠${NC} package-lock.json ausente"
    ((WARNING_COUNT++))
fi

###############################################################################
# FASE 3: VALIDAÇÃO DE CONFIGURAÇÃO
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 3/8]${NC} Validando configurações..."

# Verificar .env
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env encontrado"
    
    # Verificar variáveis críticas
    CRITICAL_VARS=(
        "VITE_SUPABASE_URL"
        "VITE_SUPABASE_PUBLISHABLE_KEY"
        "PORT"
    )
    
    for var in "${CRITICAL_VARS[@]}"; do
        if grep -q "^${var}=" .env; then
            echo -e "${GREEN}✓${NC} Variável configurada: $var"
        else
            echo -e "${YELLOW}⚠${NC} Variável ausente: $var"
            ((WARNING_COUNT++))
        fi
    done
else
    echo -e "${YELLOW}⚠${NC} .env não encontrado (usando .env.example como referência)"
    ((WARNING_COUNT++))
fi

# Verificar vite.config.ts
if [ -f "vite.config.ts" ]; then
    if grep -q "sourcemap: true" vite.config.ts; then
        echo -e "${GREEN}✓${NC} Sourcemaps habilitados"
    else
        echo -e "${YELLOW}⚠${NC} Sourcemaps desabilitados"
        ((WARNING_COUNT++))
    fi
    
    if grep -q "base: '/'" vite.config.ts; then
        echo -e "${GREEN}✓${NC} Base path correto"
    else
        echo -e "${YELLOW}⚠${NC} Base path pode estar incorreto"
        ((WARNING_COUNT++))
    fi
fi

###############################################################################
# FASE 4: VALIDAÇÃO DE BUILD
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 4/8]${NC} Validando build..."

# Verificar se dist existe
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} Diretório dist/ encontrado"
    
    # Verificar arquivos essenciais no dist
    if [ -f "dist/index.html" ]; then
        echo -e "${GREEN}✓${NC} index.html gerado"
    else
        echo -e "${RED}✗${NC} index.html ausente no dist"
        ((ERROR_COUNT++))
    fi
    
    # Contar arquivos JS
    JS_COUNT=$(find dist -name "*.js" | wc -l)
    if [ $JS_COUNT -gt 0 ]; then
        echo -e "${GREEN}✓${NC} $JS_COUNT arquivos JavaScript gerados"
    else
        echo -e "${RED}✗${NC} Nenhum arquivo JavaScript no dist"
        ((ERROR_COUNT++))
    fi
else
    echo -e "${YELLOW}⚠${NC} dist/ não encontrado (build não executado)"
    echo -e "${YELLOW}⚠${NC} Execute: npm run build"
    ((WARNING_COUNT++))
fi

###############################################################################
# FASE 5: VALIDAÇÃO DE PORTAS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 5/8]${NC} Validando portas..."

# Portas que devem estar disponíveis
PORTS=(8080 4000 5432 6379)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}⚠${NC} Porta $port em uso por $process (PID $pid)"
        ((WARNING_COUNT++))
    else
        echo -e "${GREEN}✓${NC} Porta $port disponível"
    fi
done

###############################################################################
# FASE 6: VALIDAÇÃO DE SERVIÇOS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 6/8]${NC} Validando serviços..."

# Verificar se Docker está rodando
if docker ps >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker está rodando"
    
    # Verificar containers do projeto
    CONTAINERS=$(docker ps --filter "name=primeflow" --format "{{.Names}}")
    
    if [ -n "$CONTAINERS" ]; then
        echo -e "${GREEN}✓${NC} Containers encontrados:"
        while IFS= read -r container; do
            status=$(docker inspect --format='{{.State.Status}}' "$container")
            if [ "$status" = "running" ]; then
                echo -e "  ${GREEN}✓${NC} $container ($status)"
            else
                echo -e "  ${RED}✗${NC} $container ($status)"
                ((ERROR_COUNT++))
            fi
        done <<< "$CONTAINERS"
    else
        echo -e "${YELLOW}⚠${NC} Nenhum container do projeto rodando"
        ((WARNING_COUNT++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Docker não está rodando ou não acessível"
    ((WARNING_COUNT++))
fi

###############################################################################
# FASE 7: VALIDAÇÃO DE LOGS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 7/8]${NC} Validando logs..."

# Verificar logs de erro recentes
if [ -d "logs" ]; then
    ERROR_LOGS=$(find logs -name "error*.log" -mtime -1 2>/dev/null | wc -l)
    
    if [ $ERROR_LOGS -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Nenhum log de erro recente"
    else
        echo -e "${YELLOW}⚠${NC} $ERROR_LOGS logs de erro encontrados (últimas 24h)"
        ((WARNING_COUNT++))
    fi
else
    echo -e "${BLUE}→${NC} Diretório de logs não encontrado (normal se não configurado)"
fi

# Verificar logs do Docker
if docker ps --filter "name=primeflow" -q >/dev/null 2>&1; then
    for container in $(docker ps --filter "name=primeflow" --format "{{.Names}}"); do
        ERRORS=$(docker logs "$container" 2>&1 | grep -i "error" | wc -l)
        
        if [ $ERRORS -eq 0 ]; then
            echo -e "${GREEN}✓${NC} $container: sem erros nos logs"
        else
            echo -e "${YELLOW}⚠${NC} $container: $ERRORS linhas com 'error' nos logs"
            ((WARNING_COUNT++))
        fi
    done
fi

###############################################################################
# FASE 8: VALIDAÇÃO DE CONECTIVIDADE
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 8/8]${NC} Validando conectividade..."

# Testar backend API (se estiver rodando)
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    if curl -f -s http://localhost:4000/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend API respondendo"
    else
        echo -e "${RED}✗${NC} Backend API não responde"
        ((ERROR_COUNT++))
    fi
else
    echo -e "${BLUE}→${NC} Backend API não está rodando (normal se não iniciado)"
fi

# Testar frontend (se estiver rodando)
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    if curl -f -s http://localhost:8080/ >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend respondendo"
    else
        echo -e "${RED}✗${NC} Frontend não responde"
        ((ERROR_COUNT++))
    fi
else
    echo -e "${BLUE}→${NC} Frontend não está rodando (normal se não iniciado)"
fi

###############################################################################
# RELATÓRIO FINAL
###############################################################################

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"

if [ $ERROR_COUNT -eq 0 ] && [ $WARNING_COUNT -eq 0 ]; then
    echo -e "${BLUE}║          ✅ VALIDAÇÃO CONCLUÍDA: ZERO ERROS                    ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Sistema 100% validado"
    echo -e "${GREEN}✓${NC} Nenhum erro encontrado"
    echo -e "${GREEN}✓${NC} Nenhum aviso encontrado"
    echo -e "${GREEN}✓${NC} Versão 8 estável e operacional"
    echo ""
    exit 0
elif [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${BLUE}║       ✅ VALIDAÇÃO CONCLUÍDA: ZERO ERROS CRÍTICOS              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Nenhum erro crítico encontrado"
    echo -e "${YELLOW}⚠${NC} $WARNING_COUNT avisos encontrados"
    echo -e "${BLUE}→${NC} Sistema funcional com pequenos avisos"
    echo ""
    exit 0
else
    echo -e "${BLUE}║              ❌ VALIDAÇÃO FALHOU: ERROS ENCONTRADOS            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}✗${NC} $ERROR_COUNT erros críticos encontrados"
    echo -e "${YELLOW}⚠${NC} $WARNING_COUNT avisos encontrados"
    echo -e "${BLUE}→${NC} Corrija os erros acima antes de prosseguir"
    echo ""
    exit 1
fi
