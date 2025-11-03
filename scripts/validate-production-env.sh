#!/bin/bash

# Script de Validação de Ambiente de Produção
# Valida se todos os serviços e variáveis necessárias estão configurados

set -e

echo "🔍 Validando Ambiente de Produção do PrimeZap..."
echo "================================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Função para verificar variável de ambiente
check_env_var() {
    local var_name=$1
    local is_required=$2
    
    if [ -z "${!var_name}" ]; then
        if [ "$is_required" = "required" ]; then
            echo -e "${RED}✗${NC} $var_name não está definida (OBRIGATÓRIA)"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠${NC} $var_name não está definida (opcional)"
            ((WARNINGS++))
        fi
    else
        echo -e "${GREEN}✓${NC} $var_name está definida"
    fi
}

# Função para verificar serviço Docker
check_docker_service() {
    local service_name=$1
    
    if docker-compose ps | grep -q "$service_name.*Up"; then
        echo -e "${GREEN}✓${NC} Serviço $service_name está rodando"
    else
        echo -e "${RED}✗${NC} Serviço $service_name NÃO está rodando"
        ((ERRORS++))
    fi
}

# Função para verificar conectividade de rede
check_network_connectivity() {
    local host=$1
    local port=$2
    local service_name=$3
    
    if nc -z -w5 "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $service_name está acessível em $host:$port"
    else
        echo -e "${RED}✗${NC} $service_name NÃO está acessível em $host:$port"
        ((ERRORS++))
    fi
}

echo ""
echo "1. Verificando Variáveis de Ambiente Críticas"
echo "----------------------------------------------"

# Carregar .env se existir
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Variáveis obrigatórias
check_env_var "DATABASE_URL" "required"
check_env_var "REDIS_URL" "required"
check_env_var "JWT_SECRET" "required"
check_env_var "VITE_SUPABASE_URL" "required"
check_env_var "VITE_SUPABASE_PUBLISHABLE_KEY" "required"
check_env_var "SUPABASE_SERVICE_ROLE_KEY" "required"

echo ""
echo "2. Verificando Variáveis de Ambiente de IA"
echo "-------------------------------------------"

# Variáveis de IA (opcionais mas recomendadas)
check_env_var "GEMINI_API_KEY" "optional"
check_env_var "OPENAI_API_KEY" "optional"

echo ""
echo "3. Verificando Variáveis de Email"
echo "----------------------------------"

check_env_var "SMTP_HOST" "optional"
check_env_var "SMTP_PORT" "optional"
check_env_var "SMTP_USER" "optional"
check_env_var "SMTP_PASSWORD" "optional"

echo ""
echo "4. Verificando Serviços Docker"
echo "-------------------------------"

if command -v docker-compose &> /dev/null; then
    check_docker_service "api"
    check_docker_service "worker"
    check_docker_service "redis"
    check_docker_service "nginx"
else
    echo -e "${YELLOW}⚠${NC} Docker Compose não encontrado - pulando verificação de serviços"
    ((WARNINGS++))
fi

echo ""
echo "5. Verificando Conectividade de Rede"
echo "-------------------------------------"

# Verificar PostgreSQL (Supabase)
if [ -n "$DATABASE_URL" ]; then
    # Extrair host e porta do DATABASE_URL
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
        check_network_connectivity "$DB_HOST" "$DB_PORT" "PostgreSQL"
    fi
fi

# Verificar Redis
if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
    check_network_connectivity "$REDIS_HOST" "$REDIS_PORT" "Redis"
fi

# Verificar API local
if [ -n "$PORT" ]; then
    check_network_connectivity "localhost" "$PORT" "API Local"
fi

echo ""
echo "6. Verificando Migrations do Prisma"
echo "------------------------------------"

if [ -d "prisma/migrations" ]; then
    MIGRATION_COUNT=$(find prisma/migrations -type d -mindepth 1 | wc -l)
    echo -e "${GREEN}✓${NC} Encontradas $MIGRATION_COUNT migrations"
    
    # Verificar se há migrations pendentes
    if command -v pnpm &> /dev/null; then
        echo "Verificando status das migrations..."
        cd apps/api && pnpm exec prisma migrate status 2>&1 | tail -5
        cd ../..
    fi
else
    echo -e "${YELLOW}⚠${NC} Diretório de migrations não encontrado"
    ((WARNINGS++))
fi

echo ""
echo "7. Verificando Arquivos de Configuração"
echo "----------------------------------------"

# Verificar arquivos essenciais
FILES_TO_CHECK=(
    "docker-compose.yml"
    "package.json"
    "prisma/schema.prisma"
    ".env"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file existe"
    else
        echo -e "${RED}✗${NC} $file NÃO encontrado"
        ((ERRORS++))
    fi
done

echo ""
echo "8. Verificando Portas em Uso"
echo "-----------------------------"

PORTS_TO_CHECK=(3000 3001 5000 6379 5432 9090 3100)

for port in "${PORTS_TO_CHECK[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Porta $port está em uso"
    else
        echo -e "${YELLOW}⚠${NC} Porta $port está livre"
    fi
done

echo ""
echo "================================================"
echo "Resumo da Validação"
echo "================================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Ambiente de produção está 100% configurado!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Ambiente configurado com $WARNINGS avisos${NC}"
    echo "Revise os avisos acima para garantir funcionalidade completa."
    exit 0
else
    echo -e "${RED}✗ Encontrados $ERRORS erros e $WARNINGS avisos${NC}"
    echo "Corrija os erros antes de prosseguir para produção."
    exit 1
fi
