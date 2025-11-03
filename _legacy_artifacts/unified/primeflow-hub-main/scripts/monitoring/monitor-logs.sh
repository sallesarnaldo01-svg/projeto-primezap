#!/bin/bash

###############################################################################
# SCRIPT DE MONITORAMENTO DE LOGS - PRIMEFLOW-HUB V8
# Autor: Manus AI
# Data: 07 de Outubro de 2025
#
# Monitora logs por 48h e gera relatórios
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
MONITOR_DURATION="${MONITOR_DURATION:-172800}"  # 48h em segundos
CHECK_INTERVAL="${CHECK_INTERVAL:-300}"         # 5 minutos
REPORT_DIR="/var/log/primeflow/monitoring"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/report_${TIMESTAMP}.log"

mkdir -p "$REPORT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        MONITORAMENTO DE LOGS - PRIMEFLOW-HUB V8               ║${NC}"
echo -e "${BLUE}║        Duração: 48 horas                                       ║${NC}"
echo -e "${BLUE}║        Intervalo: 5 minutos                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Função de log
log_report() {
    echo -e "$1" | tee -a "$REPORT_FILE"
}

# Iniciar monitoramento
START_TIME=$(date +%s)
END_TIME=$((START_TIME + MONITOR_DURATION))
CHECK_COUNT=0

log_report "${CYAN}📊 Monitoramento iniciado em: $(date)${NC}"
log_report "${CYAN}📊 Término previsto em: $(date -d @$END_TIME)${NC}"
log_report ""

while [ $(date +%s) -lt $END_TIME ]; do
    ((CHECK_COUNT++))
    CURRENT_TIME=$(date +"%Y-%m-%d %H:%M:%S")
    
    log_report "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    log_report "${BLUE}Check #$CHECK_COUNT - $CURRENT_TIME${NC}"
    log_report "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    
    # Verificar containers Docker
    log_report ""
    log_report "${YELLOW}[Docker Containers]${NC}"
    
    if command -v docker &> /dev/null; then
        CONTAINERS=$(docker ps --filter "name=primeflow" --format "{{.Names}}" 2>/dev/null || echo "")
        
        if [ -n "$CONTAINERS" ]; then
            while IFS= read -r container; do
                STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
                
                if [ "$STATUS" = "running" ]; then
                    log_report "  ${GREEN}✓${NC} $container: $STATUS"
                    
                    # Contar erros nos logs
                    ERROR_COUNT=$(docker logs "$container" --since 5m 2>&1 | grep -i "error" | wc -l)
                    WARN_COUNT=$(docker logs "$container" --since 5m 2>&1 | grep -i "warn" | wc -l)
                    
                    if [ $ERROR_COUNT -gt 0 ]; then
                        log_report "    ${RED}⚠${NC} Erros (últimos 5min): $ERROR_COUNT"
                    fi
                    
                    if [ $WARN_COUNT -gt 0 ]; then
                        log_report "    ${YELLOW}⚠${NC} Avisos (últimos 5min): $WARN_COUNT"
                    fi
                else
                    log_report "  ${RED}✗${NC} $container: $STATUS"
                fi
            done <<< "$CONTAINERS"
        else
            log_report "  ${YELLOW}⚠${NC} Nenhum container encontrado"
        fi
    else
        log_report "  ${YELLOW}⚠${NC} Docker não disponível"
    fi
    
    # Verificar uso de recursos
    log_report ""
    log_report "${YELLOW}[Recursos do Sistema]${NC}"
    
    # CPU
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    log_report "  CPU: ${CPU_USAGE}%"
    
    # Memória
    MEM_INFO=$(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
    log_report "  Memória: ${MEM_INFO}"
    
    # Disco
    DISK_USAGE=$(df -h / | awk 'NR==2{print $5}')
    log_report "  Disco: ${DISK_USAGE}"
    
    # Verificar conectividade
    log_report ""
    log_report "${YELLOW}[Conectividade]${NC}"
    
    # Backend
    if curl -f -s http://localhost:4000/api/health >/dev/null 2>&1; then
        RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:4000/api/health)
        log_report "  ${GREEN}✓${NC} Backend: OK (${RESPONSE_TIME}s)"
    else
        log_report "  ${RED}✗${NC} Backend: FALHOU"
    fi
    
    # Frontend
    if curl -f -s http://localhost:8080/ >/dev/null 2>&1; then
        log_report "  ${GREEN}✓${NC} Frontend: OK"
    else
        log_report "  ${RED}✗${NC} Frontend: FALHOU"
    fi
    
    # Análise de logs de erro
    log_report ""
    log_report "${YELLOW}[Erros Recentes]${NC}"
    
    if [ -d "/var/log/primeflow" ]; then
        RECENT_ERRORS=$(find /var/log/primeflow -name "*.log" -type f -mmin -5 -exec grep -i "error" {} \; 2>/dev/null | wc -l)
        
        if [ $RECENT_ERRORS -gt 0 ]; then
            log_report "  ${RED}⚠${NC} Erros encontrados nos últimos 5min: $RECENT_ERRORS"
            
            # Mostrar últimos 5 erros
            log_report "  ${YELLOW}Últimos erros:${NC}"
            find /var/log/primeflow -name "*.log" -type f -mmin -5 -exec grep -i "error" {} \; 2>/dev/null | tail -5 | while read line; do
                log_report "    - $line"
            done
        else
            log_report "  ${GREEN}✓${NC} Nenhum erro nos últimos 5min"
        fi
    fi
    
    log_report ""
    
    # Aguardar próximo check
    REMAINING=$((END_TIME - $(date +%s)))
    REMAINING_HOURS=$((REMAINING / 3600))
    REMAINING_MINS=$(((REMAINING % 3600) / 60))
    
    log_report "${CYAN}Próximo check em 5 minutos...${NC}"
    log_report "${CYAN}Tempo restante: ${REMAINING_HOURS}h ${REMAINING_MINS}min${NC}"
    log_report ""
    
    sleep $CHECK_INTERVAL
done

# Relatório final
log_report "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
log_report "${BLUE}║        MONITORAMENTO CONCLUÍDO - RELATÓRIO FINAL              ║${NC}"
log_report "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
log_report ""
log_report "${CYAN}📊 Estatísticas:${NC}"
log_report "  - Checks realizados: $CHECK_COUNT"
log_report "  - Duração: 48 horas"
log_report "  - Relatório salvo em: $REPORT_FILE"
log_report ""
log_report "${GREEN}✅ Monitoramento de 48h concluído com sucesso${NC}"
log_report ""

echo -e "${GREEN}✅ Monitoramento concluído!${NC}"
echo -e "${CYAN}Relatório completo: $REPORT_FILE${NC}"
