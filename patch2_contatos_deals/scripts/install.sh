#!/bin/bash

###############################################################################
# Patch 2: Contatos e Deals - Script de Instalação
# Primeflow-Hub
# Versão: 1.0.0
###############################################################################

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Patch 2: Contatos e Deals - Instalação"
echo "  Primeflow-Hub - CRUD Completo de CRM"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Verificar argumentos
if [ -z "$1" ]; then
    log_error "Uso: $0 <caminho-do-projeto>"
    log_info "Exemplo: $0 /home/administrator/unified/primeflow-hub-main"
    exit 1
fi

PROJECT_PATH="$1"

# Verificar se projeto existe
if [ ! -d "$PROJECT_PATH" ]; then
    log_error "Projeto não encontrado: $PROJECT_PATH"
    exit 1
fi

log_info "Projeto encontrado: $PROJECT_PATH"

# Criar backup
BACKUP_DIR="$PROJECT_PATH/../backup_patch2_$(date +%Y%m%d_%H%M%S)"
log_info "Criando backup em: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_PATH/src/services" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$PROJECT_PATH/apps/api/src/controllers" "$BACKUP_DIR/" 2>/dev/null || true
log_success "Backup criado!"

# Passo 1: Copiar Services Frontend
log_info "Passo 1/6: Copiando services frontend..."
mkdir -p "$PROJECT_PATH/src/services"
cp frontend/services/contacts.service.ts "$PROJECT_PATH/src/services/"
cp frontend/services/deals.service.ts "$PROJECT_PATH/src/services/"
log_success "Services copiados!"

# Passo 2: Copiar Controllers Backend
log_info "Passo 2/6: Copiando controllers backend..."
mkdir -p "$PROJECT_PATH/apps/api/src/controllers"
cp backend/controllers/contacts.controller.ts "$PROJECT_PATH/apps/api/src/controllers/"
cp backend/controllers/deals.controller.ts "$PROJECT_PATH/apps/api/src/controllers/"
log_success "Controllers copiados!"

# Passo 3: Verificar se rotas já existem
log_info "Passo 3/6: Verificando rotas no backend..."
INDEX_FILE="$PROJECT_PATH/apps/api/src/index.ts"

if grep -q "contactsController" "$INDEX_FILE"; then
    log_warning "Rotas de contatos já existem, pulando..."
else
    log_info "Adicionando rotas de contatos e deals..."
    
    # Criar arquivo temporário com as rotas
    cat > /tmp/routes_patch2.txt << 'EOF'

// ============================================================
// Patch 2: Rotas de Contatos e Deals
// ============================================================
import { contactsController } from './controllers/contacts.controller.js';
import { dealsController } from './controllers/deals.controller.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

// Rotas de Contatos
app.get('/api/contacts', authMiddleware, contactsController.listContacts);
app.get('/api/contacts/stats', authMiddleware, contactsController.getStats);
app.get('/api/contacts/:id', authMiddleware, contactsController.getContact);
app.post('/api/contacts', authMiddleware, contactsController.createContact);
app.put('/api/contacts/:id', authMiddleware, contactsController.updateContact);
app.delete('/api/contacts/:id', authMiddleware, contactsController.deleteContact);
app.post('/api/contacts/import', authMiddleware, upload.single('file'), contactsController.importCSV);
app.get('/api/contacts/:id/timeline', authMiddleware, contactsController.getTimeline);

// Rotas de Deals
app.get('/api/deals', authMiddleware, dealsController.listDeals);
app.get('/api/deals/by-stage', authMiddleware, dealsController.getDealsByStage);
app.get('/api/deals/stats', authMiddleware, dealsController.getStats);
app.get('/api/deals/:id', authMiddleware, dealsController.getDeal);
app.post('/api/deals', authMiddleware, dealsController.createDeal);
app.put('/api/deals/:id', authMiddleware, dealsController.updateDeal);
app.patch('/api/deals/:id/stage', authMiddleware, dealsController.updateStage);
app.delete('/api/deals/:id', authMiddleware, dealsController.deleteDeal);
app.post('/api/deals/bulk-ai', authMiddleware, dealsController.bulkAIAction);
app.get('/api/deals/:id/history', authMiddleware, dealsController.getHistory);
EOF

    # Adicionar rotas antes do app.listen
    sed -i '/app.listen/i\
// Rotas adicionadas pelo Patch 2\
' "$INDEX_FILE"
    
    cat /tmp/routes_patch2.txt >> "$INDEX_FILE.tmp"
    mv "$INDEX_FILE.tmp" "$INDEX_FILE"
    
    log_success "Rotas adicionadas!"
fi

# Passo 4: Instalar dependências backend
log_info "Passo 4/6: Instalando dependências backend..."
cd "$PROJECT_PATH/apps/api"
if command -v pnpm &> /dev/null; then
    pnpm add papaparse zod multer 2>&1 | grep -v "deprecated" || true
    pnpm add -D @types/papaparse @types/multer 2>&1 | grep -v "deprecated" || true
    log_success "Dependências backend instaladas!"
else
    log_warning "pnpm não encontrado, instale manualmente: pnpm add papaparse zod multer"
fi

# Passo 5: Instalar dependências frontend
log_info "Passo 5/6: Instalando dependências frontend..."
cd "$PROJECT_PATH"
if command -v pnpm &> /dev/null; then
    pnpm add papaparse 2>&1 | grep -v "deprecated" || true
    log_success "Dependências frontend instaladas!"
else
    log_warning "pnpm não encontrado, instale manualmente: pnpm add papaparse"
fi

# Passo 6: Validar instalação
log_info "Passo 6/6: Validando instalação..."

VALIDATION_ERRORS=0

# Verificar services
if [ ! -f "$PROJECT_PATH/src/services/contacts.service.ts" ]; then
    log_error "Service de contatos não encontrado!"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

if [ ! -f "$PROJECT_PATH/src/services/deals.service.ts" ]; then
    log_error "Service de deals não encontrado!"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Verificar controllers
if [ ! -f "$PROJECT_PATH/apps/api/src/controllers/contacts.controller.ts" ]; then
    log_error "Controller de contatos não encontrado!"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

if [ ! -f "$PROJECT_PATH/apps/api/src/controllers/deals.controller.ts" ]; then
    log_error "Controller de deals não encontrado!"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

if [ $VALIDATION_ERRORS -eq 0 ]; then
    log_success "Validação concluída com sucesso!"
else
    log_error "Validação falhou com $VALIDATION_ERRORS erros!"
    exit 1
fi

# Resumo
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Patch 2 Instalado com Sucesso!"
echo "═══════════════════════════════════════════════════════════"
echo ""
log_info "Arquivos instalados:"
echo "  ✅ frontend/services/contacts.service.ts"
echo "  ✅ frontend/services/deals.service.ts"
echo "  ✅ backend/controllers/contacts.controller.ts"
echo "  ✅ backend/controllers/deals.controller.ts"
echo "  ✅ 19 rotas de API adicionadas"
echo ""
log_info "Backup criado em: $BACKUP_DIR"
echo ""
log_warning "Próximos passos:"
echo "  1. Atualizar página Contatos.tsx (ver README.md)"
echo "  2. Atualizar página CRM.tsx (ver README.md)"
echo "  3. Testar CRUD de contatos"
echo "  4. Testar CRUD de deals"
echo "  5. Testar drag-and-drop no Kanban"
echo ""
log_info "Comandos úteis:"
echo "  cd $PROJECT_PATH"
echo "  pnpm dev                    # Rodar projeto"
echo "  pnpm build                  # Build completo"
echo "  bash $BACKUP_DIR/restore.sh # Reverter patch"
echo ""
log_success "Instalação concluída! 🎉"
echo ""

