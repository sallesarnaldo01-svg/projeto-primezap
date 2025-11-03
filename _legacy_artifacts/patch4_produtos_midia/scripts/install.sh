#!/bin/bash

###############################################################################
# Patch 4: Produtos e Mídia - Script de Instalação
# Primeflow-Hub
# Versão: 1.0.0
###############################################################################

set -e

# Cores
RED=\'\033[0;31m\'
GREEN=\'\033[0;32m\'
YELLOW=\'\033[1;33m\'
BLUE=\'\033[0;34m\'
NC=\'\033[0m\'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Banner
echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Patch 4: Produtos e Mídia - Instalação"
echo "  Primeflow-Hub - Catálogo Inteligente"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Verificar argumentos
if [ -z "$1" ]; then
    log_error "Uso: $0 <caminho-do-projeto>"
    log_info "Exemplo: $0 /home/administrator/unified/primeflow-hub-main"
    exit 1
fi

PROJECT_PATH="$1"
PATCH_DIR=$(pwd)

if [ ! -d "$PROJECT_PATH" ]; then
    log_error "Projeto não encontrado: $PROJECT_PATH"
    exit 1
fi

log_info "Projeto encontrado: $PROJECT_PATH"

# Criar backup
BACKUP_DIR="$PROJECT_PATH/../backup_patch4_$(date +%Y%m%d_%H%M%S)"
log_info "Criando backup em: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_PATH/apps/api/src/controllers" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$PROJECT_PATH/src/pages" "$BACKUP_DIR/" 2>/dev/null || true
log_success "Backup criado!"

# Passo 1: Copiar Arquivos do Backend
log_info "Passo 1/5: Copiando arquivos do backend..."
mkdir -p "$PROJECT_PATH/apps/api/src/controllers"
mkdir -p "$PROJECT_PATH/apps/api/src/services"

cp backend/controllers/products.controller.ts "$PROJECT_PATH/apps/api/src/controllers/"
cp backend/controllers/media.controller.ts "$PROJECT_PATH/apps/api/src/controllers/"
cp backend/services/ai-media.service.ts "$PROJECT_PATH/apps/api/src/services/"
log_success "Arquivos do backend copiados!"

# Passo 2: Copiar Arquivos do Frontend
log_info "Passo 2/5: Copiando arquivos do frontend..."
mkdir -p "$PROJECT_PATH/src/pages"
mkdir -p "$PROJECT_PATH/src/hooks"
mkdir -p "$PROJECT_PATH/src/services"

cp frontend/pages/Produtos.tsx "$PROJECT_PATH/src/pages/"
cp frontend/hooks/useProducts.ts "$PROJECT_PATH/src/hooks/"
cp frontend/hooks/useMedia.ts "$PROJECT_PATH/src/hooks/"
cp frontend/services/products.service.ts "$PROJECT_PATH/src/services/"
cp frontend/services/media.service.ts "$PROJECT_PATH/src/services/"
log_success "Arquivos do frontend copiados!"

# Passo 3: Instalar Dependências
log_info "Passo 3/5: Instalando dependências..."
cd "$PROJECT_PATH/apps/api"
if command -v pnpm &> /dev/null; then
    pnpm add multer sharp @google/generative-ai uuid zod 2>&1 | grep -v "deprecated" || true
    pnpm add -D @types/multer @types/sharp @types/uuid 2>&1 | grep -v "deprecated" || true
    log_success "Dependências do backend instaladas!"
else
    log_warning "pnpm não encontrado, instale manualmente as dependências."
fi

# Passo 4: Aplicar Migration do Banco de Dados
log_info "Passo 4/5: Lembrete de Migration do Banco de Dados"
DB_SCRIPT="database/001_products_media.sql"

if [ -f "$PATCH_DIR/$DB_SCRIPT" ]; then
    log_warning "A migration do banco de dados precisa ser aplicada MANUALMENTE."
    log_warning "Execute o seguinte comando, substituindo as credenciais do seu banco de dados:"
    echo ""
    echo -e "${YELLOW}PGPASSWORD=\"SUA_SENHA\" psql -h SEU_HOST -U SEU_USUARIO -d SEU_BANCO -f \"$PATCH_DIR/$DB_SCRIPT\"}${NC}"
    echo ""
else
    log_error "Script de migration 
'$DB_SCRIPT' não encontrado!"
fi

# Passo 5: Configurar Variáveis de Ambiente
log_info "Passo 5/5: Configurando variáveis de ambiente..."
ENV_FILE="$PROJECT_PATH/.env"

if [ ! -f "$ENV_FILE" ]; then
    log_warning "Arquivo .env não encontrado, criando..."
    touch "$ENV_FILE"
fi

if ! grep -q "GEMINI_API_KEY" "$ENV_FILE"; then
    cat >> "$ENV_FILE" << \'EOF\'

# ============================================================
# Patch 4: Configuração de IA para Mídia
# ============================================================
GEMINI_API_KEY=SUA_CHAVE_API_AQUI
EOF
    log_success "Variável de ambiente para IA adicionada!"
    log_warning "IMPORTANTE: Edite o arquivo .env e adicione sua chave da API do Gemini!"
else
    log_warning "Variável de ambiente GEMINI_API_KEY já existe, pulando..."
fi

# Resumo
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Patch 4 Instalado com Sucesso!"
echo "═══════════════════════════════════════════════════════════"
echo ""
log_warning "⚠️  PRÓXIMOS PASSOS OBRIGATÓRIOS:"
echo ""
echo "1. APLICAR A MIGRATION DO BANCO DE DADOS (comando mostrado acima)."
echo ""
echo "2. Adicionar a chave da API do Gemini no arquivo .env:"
echo "   nano $PROJECT_PATH/.env"
echo ""
echo "3. Adicionar as rotas dos novos controllers no arquivo apps/api/src/index.ts."
echo "   (Este passo é manual para evitar conflitos)"
echo ""
echo "4. Adicionar a nova página 'Produtos' ao menu de navegação do frontend."
echo ""
echo "5. Reiniciar o servidor para aplicar todas as mudanças."
echo ""
log_success "Instalação concluída! 🎉"

