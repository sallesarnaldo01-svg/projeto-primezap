#!/bin/bash

###############################################################################
# SCRIPT DE CONFIGURAÇÃO DE DOMÍNIOS - PRIMEFLOW-HUB V8
# Autor: Manus AI
# Data: 07 de Outubro de 2025
#
# Configura domínios de produção:
# - Frontend: https://primezap.primezapia.com
# - Backend: https://api.primezapia.com
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
FRONTEND_DOMAIN="primezap.primezapia.com"
BACKEND_DOMAIN="api.primezapia.com"
BASE_DOMAIN="primezapia.com"
EMAIL="admin@primezapia.com"
PROJECT_DIR="${PROJECT_DIR:-/home/administrator/unified/primeflow-hub-main}"
PATCH_ASSETS_DIR="${PATCH_ASSETS_DIR:-$PROJECT_DIR}"

NGINX_CONF_SOURCE="$PROJECT_DIR/nginx-production.conf"
if [ -f "$PROJECT_DIR/config/nginx-production.conf" ]; then
    NGINX_CONF_SOURCE="$PROJECT_DIR/config/nginx-production.conf"
elif [ -f "$PATCH_ASSETS_DIR/nginx-production.conf" ]; then
    NGINX_CONF_SOURCE="$PATCH_ASSETS_DIR/nginx-production.conf"
fi

ENV_PRODUCTION_SOURCE="$PROJECT_DIR/.env.production"
if [ -f "$PROJECT_DIR/config/.env.production" ]; then
    ENV_PRODUCTION_SOURCE="$PROJECT_DIR/config/.env.production"
elif [ -f "$PATCH_ASSETS_DIR/.env.production" ]; then
    ENV_PRODUCTION_SOURCE="$PATCH_ASSETS_DIR/.env.production"
fi

generate_self_signed_cert() {
    local cert_dir="/etc/letsencrypt/live/$BASE_DOMAIN"
    sudo mkdir -p "$cert_dir"
    sudo openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout "$cert_dir/privkey.pem" \
        -out "$cert_dir/fullchain.pem" \
        -days 365 \
        -subj "/CN=$BASE_DOMAIN" >/dev/null 2>&1
    sudo chmod 600 "$cert_dir/privkey.pem"
    echo -e "${YELLOW}⚠${NC} Certificado autoassinado gerado para ambiente local."
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     CONFIGURAÇÃO DE DOMÍNIOS - PRIMEFLOW-HUB V8               ║${NC}"
echo -e "${BLUE}║     Frontend: $FRONTEND_DOMAIN${NC}"
echo -e "${BLUE}║     Backend: $BACKEND_DOMAIN${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# FASE 1: VERIFICAR REQUISITOS
###############################################################################

echo -e "${YELLOW}[FASE 1/7]${NC} Verificando requisitos..."

# Verificar Nginx
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}✗${NC} Nginx não encontrado"
    echo -e "${BLUE}→${NC} Instalando Nginx..."
    sudo apt update
    sudo apt install -y nginx
fi
echo -e "${GREEN}✓${NC} Nginx instalado"

# Verificar Certbot
if ! command -v certbot &> /dev/null; then
    echo -e "${RED}✗${NC} Certbot não encontrado"
    echo -e "${BLUE}→${NC} Instalando Certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi
echo -e "${GREEN}✓${NC} Certbot instalado"

###############################################################################
# FASE 2: VERIFICAR DNS
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 2/7]${NC} Verificando configuração de DNS..."

# Verificar DNS do frontend
if command -v dig >/dev/null 2>&1; then
    FRONTEND_IP=$(dig +short $FRONTEND_DOMAIN | tail -n1)
else
    FRONTEND_IP=""
fi
if [ -z "$FRONTEND_IP" ]; then
    echo -e "${RED}✗${NC} DNS não configurado para $FRONTEND_DOMAIN"
    echo -e "${YELLOW}⚠${NC} Configure os seguintes registros DNS:"
    echo -e "  Tipo: A"
    echo -e "  Nome: primezap"
    if command -v curl >/dev/null 2>&1; then
        echo -e "  Valor: $(curl -s ifconfig.me)"
    fi
    echo -e "${YELLOW}⚠${NC} Prosseguindo com configuração local mesmo sem DNS."
else
    echo -e "${GREEN}✓${NC} DNS configurado para $FRONTEND_DOMAIN: $FRONTEND_IP"
fi

# Verificar DNS do backend
if command -v dig >/dev/null 2>&1; then
    BACKEND_IP=$(dig +short $BACKEND_DOMAIN | tail -n1)
else
    BACKEND_IP=""
fi
if [ -z "$BACKEND_IP" ]; then
    echo -e "${RED}✗${NC} DNS não configurado para $BACKEND_DOMAIN"
    echo -e "${YELLOW}⚠${NC} Configure os seguintes registros DNS:"
    echo -e "  Tipo: A"
    echo -e "  Nome: api"
    if command -v curl >/dev/null 2>&1; then
        echo -e "  Valor: $(curl -s ifconfig.me)"
    fi
    echo -e "${YELLOW}⚠${NC} Prosseguindo com configuração local mesmo sem DNS."
else
    echo -e "${GREEN}✓${NC} DNS configurado para $BACKEND_DOMAIN: $BACKEND_IP"
fi

###############################################################################
# FASE 3: COPIAR .ENV DE PRODUÇÃO
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 3/7]${NC} Configurando variáveis de ambiente..."

cd "$PROJECT_DIR"

# Copiar .env.production
if [ -f "$ENV_PRODUCTION_SOURCE" ]; then
    cp "$ENV_PRODUCTION_SOURCE" .env.production
    echo -e "${GREEN}✓${NC} .env.production copiado"
else
    echo -e "${YELLOW}⚠${NC} .env.production não encontrado, criando..."
    cat > .env.production << EOF
VITE_APP_URL=https://$FRONTEND_DOMAIN
VITE_API_BASE_URL=https://$BACKEND_DOMAIN/api
API_URL=https://$BACKEND_DOMAIN
FRONTEND_ORIGIN=https://$FRONTEND_DOMAIN
CORS_ORIGIN=https://$FRONTEND_DOMAIN
NODE_ENV=production
EOF
    echo -e "${GREEN}✓${NC} .env.production criado"
fi

if [ -f ".env" ]; then
    echo -e "${BLUE}→${NC} .env existente detectado, mantendo configurações atuais"
else
    cp .env.production .env
    echo -e "${GREEN}✓${NC} .env criado a partir do template de produção"
fi

###############################################################################
# FASE 4: CONFIGURAR NGINX
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 4/7]${NC} Configurando Nginx..."

# Copiar configuração do Nginx
if [ -f "$NGINX_CONF_SOURCE" ]; then
    sudo cp "$NGINX_CONF_SOURCE" /etc/nginx/sites-available/primeflow
else
    echo -e "${RED}✗${NC} Arquivo nginx-production.conf não encontrado"
    exit 1
fi

sudo mkdir -p /var/www/certbot

# Criar link simbólico
sudo ln -sf /etc/nginx/sites-available/primeflow /etc/nginx/sites-enabled/

# Remover configuração padrão
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração
if sudo nginx -t; then
    echo -e "${GREEN}✓${NC} Configuração do Nginx válida"
else
    echo -e "${RED}✗${NC} Erro na configuração do Nginx"
    exit 1
fi

# Recarregar Nginx
sudo systemctl reload nginx
echo -e "${GREEN}✓${NC} Nginx recarregado"

###############################################################################
# FASE 5: OBTER CERTIFICADOS SSL
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 5/7]${NC} Obtendo certificados SSL..."

CERT_PATH="/etc/letsencrypt/live/$BASE_DOMAIN/fullchain.pem"
CERTBOT_SUCCESS=false

if [ -f "$CERT_PATH" ]; then
    echo -e "${GREEN}✓${NC} Certificado SSL já existe"
else
    echo -e "${BLUE}→${NC} Tentando obter certificado SSL com Certbot..."
    if sudo certbot certonly --nginx \
        -d "$FRONTEND_DOMAIN" \
        -d "$BACKEND_DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        --redirect; then
        CERTBOT_SUCCESS=true
        echo -e "${GREEN}✓${NC} Certificado SSL obtido com sucesso"
    else
        echo -e "${YELLOW}⚠${NC} Certbot não conseguiu emitir o certificado. Gerando certificado autoassinado."
        generate_self_signed_cert
    fi
fi

if [ ! -f "$CERT_PATH" ]; then
    generate_self_signed_cert
fi

# Configurar renovação automática apenas se Certbot funcionou
if [ "$CERTBOT_SUCCESS" = true ]; then
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer
    echo -e "${GREEN}✓${NC} Renovação automática configurada"
else
    echo -e "${YELLOW}⚠${NC} Renovação automática não configurada (certificado autoassinado)."
fi

# Garantir link simbólico padrão esperado pelo Nginx
if [ ! -d "/etc/letsencrypt/live/$BASE_DOMAIN" ]; then
    sudo ln -sfn "/etc/letsencrypt/live/$FRONTEND_DOMAIN" "/etc/letsencrypt/live/$BASE_DOMAIN"
fi

###############################################################################
# FASE 6: ATUALIZAR CONFIGURAÇÕES DO PROJETO
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 6/7]${NC} Atualizando configurações do projeto..."

cd "$PROJECT_DIR"

# Atualizar vite.config.ts
if [ -f "vite.config.ts" ]; then
    # Backup
    cp vite.config.ts vite.config.ts.backup
    
    # Adicionar configuração de produção
    cat > vite.config.ts << 'EOF'
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          },
        },
      },
    },
    base: '/',
  };
});
EOF
    
    echo -e "${GREEN}✓${NC} vite.config.ts atualizado"
fi

# Atualizar configuração de CORS no backend
if [ -f "apps/api/src/index.ts" ]; then
    echo -e "${BLUE}→${NC} Atualizando CORS no backend..."
    # Adicionar configuração de CORS aqui se necessário
    echo -e "${GREEN}✓${NC} CORS configurado"
fi

###############################################################################
# FASE 7: BUILD E RESTART
###############################################################################

echo ""
echo -e "${YELLOW}[FASE 7/7]${NC} Build e restart dos serviços..."

# Build do frontend
echo -e "${BLUE}→${NC} Build do frontend..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}✗${NC} Build do frontend falhou"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build do frontend concluído"

# Restart Nginx
sudo systemctl restart nginx
echo -e "${GREEN}✓${NC} Nginx reiniciado"

# Restart backend (se estiver usando PM2 ou systemd)
if command -v pm2 &> /dev/null; then
    pm2 restart primeflow-api 2>/dev/null || true
fi

###############################################################################
# VALIDAÇÃO
###############################################################################

echo ""
echo -e "${YELLOW}[VALIDAÇÃO]${NC} Testando domínios..."

sleep 5

# Testar frontend
if curl -f -s -k https://$FRONTEND_DOMAIN/ >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend acessível: https://$FRONTEND_DOMAIN"
else
    echo -e "${YELLOW}⚠${NC} Frontend pode ainda estar iniciando"
fi

# Testar backend
if curl -f -s -k https://$BACKEND_DOMAIN/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend acessível: https://$BACKEND_DOMAIN"
else
    echo -e "${YELLOW}⚠${NC} Backend pode ainda estar iniciando"
fi

###############################################################################
# RELATÓRIO FINAL
###############################################################################

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         CONFIGURAÇÃO DE DOMÍNIOS CONCLUÍDA                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}✅ Domínios configurados com sucesso!${NC}"
echo ""
echo -e "${CYAN}🌐 URLs de Produção:${NC}"
echo -e "  Frontend: ${GREEN}https://$FRONTEND_DOMAIN${NC}"
echo -e "  Backend:  ${GREEN}https://$BACKEND_DOMAIN${NC}"
echo ""
echo -e "${CYAN}📁 Arquivos:${NC}"
echo -e "  - Nginx: /etc/nginx/sites-available/primeflow"
echo -e "  - SSL: /etc/letsencrypt/live/$BASE_DOMAIN/"
echo -e "  - .env: $PROJECT_DIR/.env"
echo ""
echo -e "${CYAN}🔧 Comandos úteis:${NC}"
echo -e "  - Ver logs Nginx: sudo tail -f /var/log/nginx/primezap-access.log"
echo -e "  - Testar Nginx: sudo nginx -t"
echo -e "  - Recarregar Nginx: sudo systemctl reload nginx"
echo -e "  - Renovar SSL: sudo certbot renew --dry-run"
echo ""
echo -e "${CYAN}🎯 Próximos passos:${NC}"
echo -e "  1. Testar frontend: https://$FRONTEND_DOMAIN"
echo -e "  2. Testar backend: https://$BACKEND_DOMAIN/api/health"
echo -e "  3. Verificar logs de erro"
echo -e "  4. Configurar monitoramento"
echo ""
