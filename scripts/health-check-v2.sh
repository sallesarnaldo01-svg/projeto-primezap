#!/bin/bash
# Health Check Script v2 - PrimeZapAI
# Valida se todos os serviços estão funcionando corretamente

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================"
echo "  PrimeZapAI - Health Check v2"
echo "================================================"
echo ""

# Contador de erros e warnings
ERRORS=0
WARNINGS=0

# Função para verificar serviço
check_service() {
    local service_name=$1
    local check_command=$2
    
    echo -n "  Verificando $service_name... "
    
    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FALHOU${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Função para verificar URL HTTP
check_http() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    local max_attempts=${4:-3}
    
    echo -n "  Verificando $name ($url)... "
    
    for attempt in $(seq 1 $max_attempts); do
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
        
        if [ "$response" = "$expected_code" ]; then
            echo -e "${GREEN}✓ OK (HTTP $response)${NC}"
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            sleep 2
        fi
    done
    
    echo -e "${RED}✗ FALHOU (HTTP $response, esperado $expected_code)${NC}"
    ERRORS=$((ERRORS + 1))
    return 1
}

# Função para warning
warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# 1. Verificar Docker
echo -e "${BLUE}=== 1. Infraestrutura Docker ===${NC}"
check_service "Docker daemon" "docker info"
echo ""

# 2. Verificar containers
echo -e "${BLUE}=== 2. Containers Docker ===${NC}"
if docker compose ps > /dev/null 2>&1; then
    # Listar containers do projeto
    containers=$(docker compose ps --format "{{.Name}}" 2>/dev/null || docker compose ps -q | xargs docker inspect --format '{{.Name}}' | sed 's/^\///')
    
    if [ -z "$containers" ]; then
        warn "Nenhum container encontrado. Execute 'docker compose up -d'"
    else
        for container in $containers; do
            status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
            health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "")
            
            if [ "$status" = "running" ]; then
                if [ -n "$health" ] && [ "$health" != "<no value>" ]; then
                    if [ "$health" = "healthy" ]; then
                        echo -e "  $container: ${GREEN}✓ running (healthy)${NC}"
                    else
                        echo -e "  $container: ${YELLOW}⚠ running ($health)${NC}"
                        WARNINGS=$((WARNINGS + 1))
                    fi
                else
                    echo -e "  $container: ${GREEN}✓ running${NC}"
                fi
            else
                echo -e "  $container: ${RED}✗ $status${NC}"
                ERRORS=$((ERRORS + 1))
            fi
        done
    fi
else
    warn "docker-compose não encontrado ou não está rodando"
fi
echo ""

# 3. Verificar Redis
echo -e "${BLUE}=== 3. Redis ===${NC}"
if docker ps --format '{{.Names}}' | grep -q redis; then
    redis_container=$(docker ps --format '{{.Names}}' | grep redis | head -1)
    check_service "Redis ping" "docker exec $redis_container redis-cli ping | grep -q PONG"
else
    warn "Container Redis não encontrado"
fi
echo ""

# 4. Verificar PostgreSQL/Supabase
echo -e "${BLUE}=== 4. Banco de Dados ===${NC}"
if [ -f .env ]; then
    source .env
    if [[ "$DATABASE_URL" == *"supabase"* ]]; then
        echo "  Usando Supabase (conexão externa)"
        warn "Verificação de conectividade requer ambiente de produção"
    elif docker ps --format '{{.Names}}' | grep -q postgres; then
        postgres_container=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
        check_service "PostgreSQL" "docker exec $postgres_container pg_isready -U postgres"
    else
        warn "Container PostgreSQL não encontrado"
    fi
else
    echo -e "${RED}✗ Arquivo .env não encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Verificar API
echo -e "${BLUE}=== 5. API ===${NC}"
check_http "API Health" "http://localhost:4000/health" "200" 5
echo ""

# 6. Verificar Worker
echo -e "${BLUE}=== 6. Worker ===${NC}"
if docker ps --format '{{.Names}}' | grep -q worker; then
    worker_container=$(docker ps --format '{{.Names}}' | grep worker | head -1)
    echo -e "  Worker container: ${GREEN}✓ running${NC}"
    
    # Verificar logs recentes
    recent_logs=$(docker logs --tail 5 "$worker_container" 2>&1)
    if echo "$recent_logs" | grep -qi "error"; then
        warn "Worker tem erros recentes nos logs"
    fi
else
    warn "Container Worker não encontrado"
fi
echo ""

# 7. Verificar Frontend
echo -e "${BLUE}=== 7. Frontend ===${NC}"
check_http "Frontend" "http://localhost:8080" "200" 3
echo ""

# 8. Verificar Nginx (se configurado)
echo -e "${BLUE}=== 8. Nginx (Reverse Proxy) ===${NC}"
if docker ps --format '{{.Names}}' | grep -q nginx; then
    check_http "Nginx" "http://localhost" "200" 3
else
    warn "Nginx não está rodando (opcional em desenvolvimento)"
fi
echo ""

# 9. Verificar arquivos de configuração
echo -e "${BLUE}=== 9. Configuração ===${NC}"
check_service ".env existe" "test -f .env"
check_service "docker-compose.yml existe" "test -f docker-compose.yml"
check_service "package.json existe" "test -f package.json"
check_service "prisma/schema.prisma existe" "test -f prisma/schema.prisma"
echo ""

# 10. Verificar variáveis de ambiente críticas
echo -e "${BLUE}=== 10. Variáveis de Ambiente Críticas ===${NC}"
if [ -f .env ]; then
    source .env
    
    check_var() {
        local var_name=$1
        local var_value="${!var_name}"
        local optional=${2:-false}
        
        if [ -n "$var_value" ]; then
            echo -e "  $var_name: ${GREEN}✓ configurada${NC}"
        else
            if [ "$optional" = "true" ]; then
                warn "$var_name: vazia (opcional)"
            else
                echo -e "  $var_name: ${RED}✗ vazia${NC}"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    }
    
    # Críticas
    check_var "DATABASE_URL"
    check_var "JWT_SECRET"
    check_var "SUPABASE_URL"
    check_var "SUPABASE_SERVICE_ROLE_KEY"
    check_var "REDIS_HOST"
    
    # Opcionais mas recomendadas
    check_var "OPENAI_API_KEY" "true"
    check_var "GEMINI_API_KEY" "true"
    check_var "SMTP_HOST" "true"
else
    echo -e "${RED}✗ Arquivo .env não encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 11. Verificar conectividade entre serviços
echo -e "${BLUE}=== 11. Conectividade entre Serviços ===${NC}"
if docker ps --format '{{.Names}}' | grep -q api; then
    api_container=$(docker ps --format '{{.Names}}' | grep api | head -1)
    
    # API → Redis
    echo -n "  API → Redis... "
    if docker exec "$api_container" sh -c "nc -zv redis 6379" 2>&1 | grep -q succeeded; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ FALHOU${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi
echo ""

# 12. Resumo
echo "================================================"
echo -e "${BLUE}📊 Resumo do Health Check${NC}"
echo "================================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Todos os checks passaram!${NC}"
    echo "O ambiente está pronto para uso."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) encontrado(s)${NC}"
    echo "O ambiente está funcional, mas revise os warnings."
    exit 0
else
    echo -e "${RED}✗ $ERRORS erro(s) e $WARNINGS warning(s) encontrado(s)${NC}"
    echo "Revise os itens acima antes de prosseguir."
    exit 1
fi
