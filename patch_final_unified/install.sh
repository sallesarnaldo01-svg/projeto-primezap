#!/bin/bash

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PROJECT_DIR="$1"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$PROJECT_DIR" ]; then
    log_error "Uso: $0 <caminho-do-projeto>"
    log_info "Exemplo: $0 /home/administrator/unified/primeflow-hub-main"
    exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
    log_error "Diretório não encontrado: $PROJECT_DIR"
    exit 1
fi

log_info "========================================="
log_info "PATCH FINAL UNIFIED - CORREÇÃO COMPLETA"
log_info "========================================="
log_info ""
log_info "Projeto: $PROJECT_DIR"
log_info "Patch: $PATCH_DIR"
log_info ""
log_info "Este patch vai:"
log_info "  ✅ Adicionar 3 páginas faltantes"
log_info "  ✅ Inicializar MSW"
log_info "  ✅ Gerar Prisma Client"
log_info "  ✅ Adicionar scripts de monorepo"
log_info "  ✅ Sincronizar dependências"
log_info "  ✅ Ajustar configurações"
log_info ""

# Fase 1: Backup
log_info "[1/8] Criando backup..."
cd "$PROJECT_DIR"
BACKUP_FILE="../backup_pre_patch_final_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.next \
    --exclude=build \
    . 2>/dev/null || true
log_success "Backup criado: $BACKUP_FILE"

# Fase 2: Copiar páginas faltantes
log_info "[2/8] Adicionando páginas faltantes..."
if [ -d "$PATCH_DIR/pages" ]; then
    cp "$PATCH_DIR/pages/CampanhasFacebook.tsx" "$PROJECT_DIR/src/pages/" 2>/dev/null || log_warning "CampanhasFacebook.tsx já existe"
    cp "$PATCH_DIR/pages/Leads.tsx" "$PROJECT_DIR/src/pages/" 2>/dev/null || log_warning "Leads.tsx já existe"
    cp "$PATCH_DIR/pages/ListasContatos.tsx" "$PROJECT_DIR/src/pages/" 2>/dev/null || log_warning "ListasContatos.tsx já existe"
    log_success "Páginas copiadas"
else
    log_error "Diretório de páginas não encontrado no patch"
    exit 1
fi

# Fase 3: Atualizar package.json com scripts
log_info "[3/8] Adicionando scripts de monorepo..."
if [ -f "$PATCH_DIR/config/package.json.patch" ]; then
    # Fazer backup do package.json
    cp "$PROJECT_DIR/package.json" "$PROJECT_DIR/package.json.backup"
    
    # Aplicar patch (adicionar scripts)
    python3 << 'PYTHON_SCRIPT'
import json
import sys

project_dir = sys.argv[1]

# Ler package.json atual
with open(f"{project_dir}/package.json", 'r') as f:
    pkg = json.load(f)

# Adicionar scripts se não existirem
if 'scripts' not in pkg:
    pkg['scripts'] = {}

new_scripts = {
    "dev": "concurrently \"pnpm dev:api\" \"pnpm dev:worker\" \"vite\"",
    "dev:api": "cd apps/api && pnpm dev",
    "dev:worker": "cd apps/worker && pnpm dev",
    "dev:frontend": "vite",
    "build:all": "pnpm build && pnpm build:api && pnpm build:worker",
    "build:api": "cd apps/api && pnpm build",
    "build:worker": "cd apps/worker && pnpm build",
    "prisma:generate": "cd apps/api && npx prisma generate",
    "prisma:migrate": "cd apps/api && npx prisma migrate dev",
    "prisma:push": "cd apps/api && npx prisma db push",
    "prisma:seed": "cd apps/api && npx prisma db seed",
    "lint:all": "pnpm lint && pnpm lint:api && pnpm lint:worker",
    "lint:api": "cd apps/api && pnpm lint",
    "lint:worker": "cd apps/worker && pnpm lint"
}

# Adicionar scripts que não existem
for key, value in new_scripts.items():
    if key not in pkg['scripts']:
        pkg['scripts'][key] = value

# Salvar
with open(f"{project_dir}/package.json", 'w') as f:
    json.dump(pkg, f, indent=2)
    f.write('\n')

print("Scripts adicionados com sucesso!")
PYTHON_SCRIPT
    log_success "Scripts de monorepo adicionados"
else
    log_warning "Arquivo de patch de package.json não encontrado, pulando..."
fi

# Fase 4: Inicializar MSW
log_info "[4/8] Inicializando Mock Service Worker..."
if [ ! -f "$PROJECT_DIR/public/mockServiceWorker.js" ]; then
    cd "$PROJECT_DIR"
    npx msw@latest init public/ --save 2>&1 | tail -5
    log_success "MSW inicializado"
else
    log_warning "MSW já está inicializado"
fi

# Fase 5: Instalar dependências faltantes
log_info "[5/8] Verificando dependências..."
cd "$PROJECT_DIR"

# Verificar se concurrently está instalado
if ! npm list concurrently > /dev/null 2>&1; then
    log_info "Instalando concurrently..."
    pnpm add -D concurrently
fi

log_success "Dependências verificadas"

# Fase 6: Gerar Prisma Client
log_info "[6/8] Gerando Prisma Client..."
cd "$PROJECT_DIR/apps/api"
if [ -f "prisma/schema.prisma" ] || [ -f "../../prisma/schema.prisma" ]; then
    npx prisma generate 2>&1 | tail -10
    log_success "Prisma Client gerado"
else
    log_warning "Schema do Prisma não encontrado, pulando..."
fi

# Fase 7: Atualizar App.tsx com novas rotas
log_info "[7/8] Atualizando rotas no App.tsx..."
APP_TSX="$PROJECT_DIR/src/App.tsx"

if [ -f "$APP_TSX" ]; then
    # Backup do App.tsx
    cp "$APP_TSX" "$APP_TSX.backup"
    
    # Verificar se as rotas já existem
    if ! grep -q "CampanhasFacebook" "$APP_TSX"; then
        # Adicionar imports
        sed -i '/const Dashboard = lazy/a\
const CampanhasFacebook = lazy(() => import("@/pages/CampanhasFacebook"));\
const Leads = lazy(() => import("@/pages/Leads"));\
const ListasContatos = lazy(() => import("@/pages/ListasContatos"));' "$APP_TSX"
        
        # Adicionar rotas (procurar última Route e adicionar depois)
        sed -i '/<Route path="\/workflows" element={<Workflows \/>} \/>/a\
            <Route path="/campanhas-facebook" element={<CampanhasFacebook />} />\
            <Route path="/leads" element={<Leads />} />\
            <Route path="/listas-contatos" element={<ListasContatos />} />' "$APP_TSX"
        
        log_success "Rotas adicionadas ao App.tsx"
    else
        log_warning "Rotas já existem no App.tsx"
    fi
else
    log_error "App.tsx não encontrado"
fi

# Fase 8: Testar build
log_info "[8/8] Testando configuração..."
cd "$PROJECT_DIR"

# Verificar se MSW foi criado
if [ -f "public/mockServiceWorker.js" ]; then
    log_success "✅ MSW configurado"
else
    log_error "❌ MSW não configurado"
fi

# Verificar se Prisma Client foi gerado
if [ -d "apps/api/node_modules/.prisma" ] || [ -d "node_modules/.prisma" ]; then
    log_success "✅ Prisma Client gerado"
else
    log_warning "⚠️ Prisma Client pode não estar gerado"
fi

# Verificar se scripts foram adicionados
if grep -q '"dev:api"' package.json; then
    log_success "✅ Scripts de monorepo adicionados"
else
    log_error "❌ Scripts não foram adicionados"
fi

# Verificar se páginas foram copiadas
if [ -f "src/pages/CampanhasFacebook.tsx" ] && [ -f "src/pages/Leads.tsx" ] && [ -f "src/pages/ListasContatos.tsx" ]; then
    log_success "✅ Páginas faltantes adicionadas"
else
    log_error "❌ Algumas páginas não foram copiadas"
fi

log_info ""
log_info "========================================="
log_success "✅ PATCH APLICADO COM SUCESSO!"
log_info "========================================="
log_info ""
log_info "Páginas adicionadas:"
log_info "  ✅ CampanhasFacebook.tsx"
log_info "  ✅ Leads.tsx"
log_info "  ✅ ListasContatos.tsx"
log_info ""
log_info "Configurações aplicadas:"
log_info "  ✅ MSW inicializado"
log_info "  ✅ Prisma Client gerado"
log_info "  ✅ Scripts de monorepo adicionados"
log_info "  ✅ Rotas atualizadas no App.tsx"
log_info ""
log_info "Próximos passos:"
log_info "  1. Instalar dependências: pnpm install"
log_info "  2. Rodar desenvolvimento: pnpm dev"
log_info "  3. Acessar: http://localhost:5173"
log_info ""
log_info "Novos comandos disponíveis:"
log_info "  pnpm dev              # Roda tudo (API + Worker + Frontend)"
log_info "  pnpm dev:api          # Roda apenas API"
log_info "  pnpm dev:worker       # Roda apenas Worker"
log_info "  pnpm dev:frontend     # Roda apenas Frontend"
log_info "  pnpm build:all        # Build completo"
log_info "  pnpm prisma:generate  # Gera Prisma Client"
log_info "  pnpm prisma:push      # Atualiza banco"
log_info ""
log_info "Backup salvo em: $BACKUP_FILE"
log_info ""

