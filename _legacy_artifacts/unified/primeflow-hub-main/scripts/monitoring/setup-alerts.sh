#!/bin/bash

###############################################################################
# SCRIPT DE CONFIGURAÇÃO DE ALERTAS - PRIMEFLOW-HUB V8
# Autor: Manus AI
# Data: 07 de Outubro de 2025
#
# Configura alertas de erro via email, Slack e webhook
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     CONFIGURAÇÃO DE ALERTAS - PRIMEFLOW-HUB V8                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Diretório de configuração
CONFIG_DIR="/etc/primeflow/alerts"
mkdir -p "$CONFIG_DIR"

# Criar arquivo de configuração de alertas
cat > "$CONFIG_DIR/alerts.conf" << 'EOF'
# Configuração de Alertas - Primeflow-Hub V8

# Email
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_TO="admin@primeflow.com"
ALERT_EMAIL_FROM="alerts@primeflow.com"
ALERT_EMAIL_SMTP_HOST="smtp.gmail.com"
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER=""
ALERT_EMAIL_SMTP_PASS=""

# Slack
ALERT_SLACK_ENABLED=false
ALERT_SLACK_WEBHOOK_URL=""
ALERT_SLACK_CHANNEL="#alerts"

# Webhook genérico
ALERT_WEBHOOK_ENABLED=false
ALERT_WEBHOOK_URL=""

# Thresholds
ALERT_ERROR_THRESHOLD=10        # Alertar após 10 erros em 5min
ALERT_CPU_THRESHOLD=80          # Alertar se CPU > 80%
ALERT_MEMORY_THRESHOLD=85       # Alertar se Memória > 85%
ALERT_DISK_THRESHOLD=90         # Alertar se Disco > 90%
ALERT_RESPONSE_TIME_THRESHOLD=2 # Alertar se tempo de resposta > 2s
EOF

echo -e "${GREEN}✓${NC} Arquivo de configuração criado: $CONFIG_DIR/alerts.conf"

# Criar script de envio de alertas
cat > "$CONFIG_DIR/send-alert.sh" << 'ALERT_SCRIPT'
#!/bin/bash

# Carregar configuração
source /etc/primeflow/alerts/alerts.conf

ALERT_TYPE="$1"
ALERT_MESSAGE="$2"
ALERT_SEVERITY="${3:-warning}"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Enviar email
send_email() {
    if [ "$ALERT_EMAIL_ENABLED" = "true" ]; then
        echo "Subject: [Primeflow Alert] $ALERT_TYPE
From: $ALERT_EMAIL_FROM
To: $ALERT_EMAIL_TO

Timestamp: $TIMESTAMP
Severity: $ALERT_SEVERITY
Type: $ALERT_TYPE

Message:
$ALERT_MESSAGE
" | sendmail -t 2>/dev/null || echo "Erro ao enviar email"
    fi
}

# Enviar para Slack
send_slack() {
    if [ "$ALERT_SLACK_ENABLED" = "true" ] && [ -n "$ALERT_SLACK_WEBHOOK_URL" ]; then
        EMOJI=":warning:"
        [ "$ALERT_SEVERITY" = "critical" ] && EMOJI=":rotating_light:"
        [ "$ALERT_SEVERITY" = "info" ] && EMOJI=":information_source:"
        
        curl -X POST "$ALERT_SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"channel\": \"$ALERT_SLACK_CHANNEL\",
                \"username\": \"Primeflow Alerts\",
                \"icon_emoji\": \"$EMOJI\",
                \"text\": \"*$ALERT_TYPE* ($ALERT_SEVERITY)\",
                \"attachments\": [{
                    \"color\": \"$([ "$ALERT_SEVERITY" = "critical" ] && echo "danger" || echo "warning")\",
                    \"fields\": [{
                        \"title\": \"Message\",
                        \"value\": \"$ALERT_MESSAGE\",
                        \"short\": false
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$TIMESTAMP\",
                        \"short\": true
                    }]
                }]
            }" 2>/dev/null
    fi
}

# Enviar para webhook
send_webhook() {
    if [ "$ALERT_WEBHOOK_ENABLED" = "true" ] && [ -n "$ALERT_WEBHOOK_URL" ]; then
        curl -X POST "$ALERT_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"type\": \"$ALERT_TYPE\",
                \"severity\": \"$ALERT_SEVERITY\",
                \"message\": \"$ALERT_MESSAGE\",
                \"timestamp\": \"$TIMESTAMP\"
            }" 2>/dev/null
    fi
}

# Enviar alertas
send_email
send_slack
send_webhook

# Log local
echo "[$TIMESTAMP] [$ALERT_SEVERITY] $ALERT_TYPE: $ALERT_MESSAGE" >> /var/log/primeflow/alerts.log
ALERT_SCRIPT

chmod +x "$CONFIG_DIR/send-alert.sh"
echo -e "${GREEN}✓${NC} Script de envio de alertas criado: $CONFIG_DIR/send-alert.sh"

# Criar serviço de monitoramento contínuo
cat > "$CONFIG_DIR/alert-monitor.sh" << 'MONITOR_SCRIPT'
#!/bin/bash

# Carregar configuração
source /etc/primeflow/alerts/alerts.conf

while true; do
    # Verificar erros nos logs
    if [ -d "/var/log/primeflow" ]; then
        ERROR_COUNT=$(find /var/log/primeflow -name "*.log" -type f -mmin -5 -exec grep -i "error" {} \; 2>/dev/null | wc -l)
        
        if [ $ERROR_COUNT -gt $ALERT_ERROR_THRESHOLD ]; then
            /etc/primeflow/alerts/send-alert.sh \
                "High Error Rate" \
                "$ERROR_COUNT errors detected in the last 5 minutes" \
                "critical"
        fi
    fi
    
    # Verificar CPU
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d'.' -f1)
    if [ $CPU_USAGE -gt $ALERT_CPU_THRESHOLD ]; then
        /etc/primeflow/alerts/send-alert.sh \
            "High CPU Usage" \
            "CPU usage is at ${CPU_USAGE}%" \
            "warning"
    fi
    
    # Verificar Memória
    MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2 }')
    if [ $MEM_USAGE -gt $ALERT_MEMORY_THRESHOLD ]; then
        /etc/primeflow/alerts/send-alert.sh \
            "High Memory Usage" \
            "Memory usage is at ${MEM_USAGE}%" \
            "warning"
    fi
    
    # Verificar Disco
    DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)
    if [ $DISK_USAGE -gt $ALERT_DISK_THRESHOLD ]; then
        /etc/primeflow/alerts/send-alert.sh \
            "High Disk Usage" \
            "Disk usage is at ${DISK_USAGE}%" \
            "critical"
    fi
    
    # Verificar tempo de resposta do backend
    if curl -f -s http://localhost:4000/api/health >/dev/null 2>&1; then
        RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:4000/api/health)
        RESPONSE_TIME_INT=$(echo "$RESPONSE_TIME" | cut -d'.' -f1)
        
        if [ $RESPONSE_TIME_INT -gt $ALERT_RESPONSE_TIME_THRESHOLD ]; then
            /etc/primeflow/alerts/send-alert.sh \
                "Slow Response Time" \
                "Backend response time is ${RESPONSE_TIME}s" \
                "warning"
        fi
    else
        /etc/primeflow/alerts/send-alert.sh \
            "Backend Down" \
            "Backend API is not responding" \
            "critical"
    fi
    
    # Aguardar 5 minutos
    sleep 300
done
MONITOR_SCRIPT

chmod +x "$CONFIG_DIR/alert-monitor.sh"
echo -e "${GREEN}✓${NC} Monitor de alertas criado: $CONFIG_DIR/alert-monitor.sh"

# Criar serviço systemd
cat > /etc/systemd/system/primeflow-alerts.service << 'SERVICE'
[Unit]
Description=Primeflow Alert Monitor
After=network.target

[Service]
Type=simple
User=root
ExecStart=/etc/primeflow/alerts/alert-monitor.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

echo -e "${GREEN}✓${NC} Serviço systemd criado: primeflow-alerts.service"

# Instruções finais
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              CONFIGURAÇÃO CONCLUÍDA                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📝 Próximos passos:${NC}"
echo ""
echo -e "1. ${YELLOW}Editar configuração:${NC}"
echo -e "   nano $CONFIG_DIR/alerts.conf"
echo ""
echo -e "2. ${YELLOW}Configurar credenciais de email/Slack/webhook${NC}"
echo ""
echo -e "3. ${YELLOW}Iniciar serviço de alertas:${NC}"
echo -e "   systemctl enable primeflow-alerts"
echo -e "   systemctl start primeflow-alerts"
echo ""
echo -e "4. ${YELLOW}Verificar status:${NC}"
echo -e "   systemctl status primeflow-alerts"
echo ""
echo -e "5. ${YELLOW}Ver logs de alertas:${NC}"
echo -e "   tail -f /var/log/primeflow/alerts.log"
echo ""
echo -e "6. ${YELLOW}Testar alerta manualmente:${NC}"
echo -e "   $CONFIG_DIR/send-alert.sh \"Test Alert\" \"This is a test\" \"info\""
echo ""
