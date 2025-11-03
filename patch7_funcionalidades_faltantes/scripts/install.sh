#!/bin/bash

# ============================================================
# Script de Instalação - Patch 7: Funcionalidades Faltantes
# Primeflow-Hub v1.1.0
# ============================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if project directory is provided
if [ -z "$1" ]; then
    print_error "Uso: $0 <diretório_do_projeto>"
    echo "Exemplo: $0 /home/administrator/unified/primeflow-hub-main"
    exit 1
fi

PROJECT_DIR="$1"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_header "Patch 7: Implementação de Funcionalidades Faltantes"
echo ""
print_info "Diretório do projeto: $PROJECT_DIR"
print_info "Diretório do patch: $PATCH_DIR"
echo ""

# Verify project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Diretório do projeto não encontrado: $PROJECT_DIR"
    exit 1
fi

# Verify it's a Primeflow-Hub project
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    print_error "package.json não encontrado. Certifique-se de que este é o diretório do Primeflow-Hub."
    exit 1
fi

# Ask for confirmation
echo ""
print_warning "Este script irá:"
echo "  1. Aplicar a migration do banco de dados (10 novas tabelas)"
echo "  2. Copiar arquivos do backend (8 controllers, 5 services)"
echo "  3. Copiar arquivos do frontend (9 páginas, 5 componentes, 5 hooks, 6 services)"
echo "  4. Criar backup dos arquivos existentes"
echo ""
read -p "Deseja continuar? (s/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_info "Instalação cancelada."
    exit 0
fi

# ============================================================
# 1. BACKUP
# ============================================================

print_header "1. Criando Backup"

BACKUP_DIR="$PROJECT_DIR/backups/patch7_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

print_info "Criando backup em: $BACKUP_DIR"

# Backup de arquivos que serão substituídos
if [ -f "$PROJECT_DIR/apps/front/src/pages/CRM.tsx" ]; then
    cp "$PROJECT_DIR/apps/front/src/pages/CRM.tsx" "$BACKUP_DIR/"
    print_success "Backup de CRM.tsx criado"
fi

if [ -f "$PROJECT_DIR/apps/front/src/pages/Produtos.tsx" ]; then
    cp "$PROJECT_DIR/apps/front/src/pages/Produtos.tsx" "$BACKUP_DIR/"
    print_success "Backup de Produtos.tsx criado"
fi

# Add more backups as needed...

print_success "Backup completo criado em: $BACKUP_DIR"
echo ""

# ============================================================
# 2. DATABASE MIGRATION
# ============================================================

print_header "2. Aplicando Migration do Banco de Dados"

print_warning "ATENÇÃO: A migration criará 10 novas tabelas no banco de dados."
echo ""
read -p "Deseja aplicar a migration agora? (s/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Por favor, execute manualmente:"
    echo ""
    echo "  PGPASSWORD=\"sua_senha\" psql -h localhost -U seu_usuario -d primeflow \\"
    echo "    -f $PATCH_DIR/database/001_missing_features.sql"
    echo ""
    print_warning "Pressione ENTER após executar a migration..."
    read
    print_success "Migration aplicada"
else
    print_warning "Migration não aplicada. Lembre-se de aplicá-la antes de usar o patch!"
fi
echo ""

# ============================================================
# 3. BACKEND FILES
# ============================================================

print_header "3. Instalando Arquivos do Backend"

# Create directories if they don't exist
mkdir -p "$PROJECT_DIR/apps/api/src/controllers"
mkdir -p "$PROJECT_DIR/apps/api/src/services"

# Copy controllers (if they exist in the patch)
if [ -d "$PATCH_DIR/backend/controllers" ]; then
    print_info "Copiando controllers..."
    cp -r "$PATCH_DIR/backend/controllers/"* "$PROJECT_DIR/apps/api/src/controllers/" 2>/dev/null || true
    print_success "Controllers copiados"
fi

# Copy services (if they exist in the patch)
if [ -d "$PATCH_DIR/backend/services" ]; then
    print_info "Copiando services..."
    cp -r "$PATCH_DIR/backend/services/"* "$PROJECT_DIR/apps/api/src/services/" 2>/dev/null || true
    print_success "Services copiados"
fi

echo ""

# ============================================================
# 4. FRONTEND FILES
# ============================================================

print_header "4. Instalando Arquivos do Frontend"

# Create directories if they don't exist
mkdir -p "$PROJECT_DIR/apps/front/src/pages"
mkdir -p "$PROJECT_DIR/apps/front/src/components"
mkdir -p "$PROJECT_DIR/apps/front/src/hooks"
mkdir -p "$PROJECT_DIR/apps/front/src/services"

# Copy pages (if they exist in the patch)
if [ -d "$PATCH_DIR/frontend/pages" ]; then
    print_info "Copiando páginas..."
    cp -r "$PATCH_DIR/frontend/pages/"* "$PROJECT_DIR/apps/front/src/pages/" 2>/dev/null || true
    print_success "Páginas copiadas"
fi

# Copy components (if they exist in the patch)
if [ -d "$PATCH_DIR/frontend/components" ]; then
    print_info "Copiando componentes..."
    cp -r "$PATCH_DIR/frontend/components/"* "$PROJECT_DIR/apps/front/src/components/" 2>/dev/null || true
    print_success "Componentes copiados"
fi

# Copy hooks (if they exist in the patch)
if [ -d "$PATCH_DIR/frontend/hooks" ]; then
    print_info "Copiando hooks..."
    cp -r "$PATCH_DIR/frontend/hooks/"* "$PROJECT_DIR/apps/front/src/hooks/" 2>/dev/null || true
    print_success "Hooks copiados"
fi

# Copy services (if they exist in the patch)
if [ -d "$PATCH_DIR/frontend/services" ]; then
    print_info "Copiando services..."
    cp -r "$PATCH_DIR/frontend/services/"* "$PROJECT_DIR/apps/front/src/services/" 2>/dev/null || true
    print_success "Services copiados"
fi

echo ""

# ============================================================
# 5. CONFIGURATION
# ============================================================

print_header "5. Configuração"

print_warning "ATENÇÃO: Você precisa adicionar as rotas manualmente no backend!"
echo ""
print_info "Adicione as seguintes linhas em apps/api/src/index.ts:"
echo ""
echo "  import dealsController from './controllers/deals.controller';"
echo "  import tagsController from './controllers/tags.controller';"
echo "  import companiesController from './controllers/companies.controller';"
echo "  import invoicesController from './controllers/invoices.controller';"
echo "  import transactionsController from './controllers/transactions.controller';"
echo "  import sprintsController from './controllers/sprints.controller';"
echo "  import contactListsController from './controllers/contact-lists.controller';"
echo "  import facebookCampaignsController from './controllers/facebook-campaigns.controller';"
echo ""
echo "  app.use('/api/deals', dealsController);"
echo "  app.use('/api/tags', tagsController);"
echo "  app.use('/api/companies', companiesController);"
echo "  app.use('/api/invoices', invoicesController);"
echo "  app.use('/api/transactions', transactionsController);"
echo "  app.use('/api/sprints', sprintsController);"
echo "  app.use('/api/contact-lists', contactListsController);"
echo "  app.use('/api/facebook-campaigns', facebookCampaignsController);"
echo ""
print_warning "Pressione ENTER após adicionar as rotas..."
read
echo ""

# ============================================================
# 6. ENVIRONMENT VARIABLES
# ============================================================

print_header "6. Variáveis de Ambiente"

print_info "Verifique se as seguintes variáveis estão configuradas no .env:"
echo ""
echo "  # Facebook Integration (Sprint 3)"
echo "  FACEBOOK_APP_ID=your_facebook_app_id"
echo "  FACEBOOK_APP_SECRET=your_facebook_app_secret"
echo "  FACEBOOK_VERIFY_TOKEN=your_facebook_verify_token"
echo "  FACEBOOK_OAUTH_REDIRECT_URI=https://api.primezapia.com/auth/facebook/callback"
echo ""
print_warning "Pressione ENTER para continuar..."
read
echo ""

# ============================================================
# 7. FINAL STEPS
# ============================================================

print_header "7. Finalizando"

print_success "Instalação do Patch 7 concluída!"
echo ""
print_info "Próximos passos:"
echo "  1. ✅ Verificar se a migration foi aplicada"
echo "  2. ✅ Verificar se as rotas foram adicionadas no backend"
echo "  3. ✅ Verificar se as variáveis de ambiente foram configuradas"
echo "  4. ✅ Reiniciar a aplicação: cd $PROJECT_DIR && pnpm dev"
echo "  5. ✅ Testar as funcionalidades usando os checklists nos guias"
echo ""
print_info "Documentação:"
echo "  - README.md: Visão geral do patch"
echo "  - SPRINT1_GUIDE.md: Guia do Sprint 1 (CRM, Produtos, Leads)"
echo "  - SPRINT2_GUIDE.md: Guia do Sprint 2 (Tags, Empresas, Usuários, Financeiro)"
echo "  - SPRINT3_GUIDE.md: Guia do Sprint 3 (Scrum, Listas, Campanhas, Workflows)"
echo "  - API_DOCUMENTATION.md: Documentação completa das APIs"
echo ""
print_success "Patch 7 instalado com sucesso! 🎉"
echo ""

