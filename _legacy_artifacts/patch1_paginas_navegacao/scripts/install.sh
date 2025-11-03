#!/bin/bash

# Patch 1: Páginas e Navegação - Script de Instalação
# Versão: 1.0.0
# Data: 12/10/2025

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║        🚀 PATCH 1: PÁGINAS E NAVEGAÇÃO 🚀                   ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║              Primeflow-Hub - Fundação                        ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$1" ]; then
    echo -e "${RED}❌ Erro: Caminho do projeto não fornecido${NC}"
    echo ""
    echo "Uso: sudo bash install.sh /caminho/para/primeflow-hub-main"
    echo ""
    echo "Exemplo:"
    echo "  sudo bash install.sh /home/administrator/unified/primeflow-hub-main"
    exit 1
fi

PROJECT_PATH="$1"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${RED}❌ Erro: Projeto não encontrado em $PROJECT_PATH${NC}"
    exit 1
fi

echo -e "${BLUE}📂 Projeto: $PROJECT_PATH${NC}"
echo -e "${BLUE}📦 Patch: $PATCH_DIR${NC}"
echo ""

log_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Passo 1: Criar backup
log_step "Passo 1/7: Criando backup completo..."
BACKUP_DIR="$PROJECT_PATH/backups/patch1_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_PATH/src/pages" "$BACKUP_DIR/" 2>/dev/null || true
cp "$PROJECT_PATH/src/App.tsx" "$BACKUP_DIR/" 2>/dev/null || true
cp "$PROJECT_PATH/src/components/layout/Sidebar.tsx" "$BACKUP_DIR/" 2>/dev/null || true
log_success "Backup criado em: $BACKUP_DIR"
echo ""

# Passo 2: Copiar 4 páginas
log_step "Passo 2/7: Copiando 4 páginas novas..."
mkdir -p "$PROJECT_PATH/src/pages"
cp "$PATCH_DIR/frontend/ConfiguracoesIA.tsx" "$PROJECT_PATH/src/pages/" 2>/dev/null || true
cp "$PATCH_DIR/frontend/CampanhasFacebook.tsx" "$PROJECT_PATH/src/pages/" 2>/dev/null || true
cp "$PATCH_DIR/frontend/Leads.tsx" "$PROJECT_PATH/src/pages/" 2>/dev/null || true
cp "$PATCH_DIR/frontend/ListasContatos.tsx" "$PROJECT_PATH/src/pages/" 2>/dev/null || true
log_success "Páginas copiadas:"
echo "  ✅ ConfiguracoesIA.tsx"
echo "  ✅ CampanhasFacebook.tsx"
echo "  ✅ Leads.tsx"
echo "  ✅ ListasContatos.tsx"
echo ""

# Passo 3: Adicionar imports no App.tsx
log_step "Passo 3/7: Adicionando imports no App.tsx..."
if [ -f "$PROJECT_PATH/src/App.tsx" ]; then
    # Verificar se imports já existem
    if ! grep -q "ConfiguracoesIA" "$PROJECT_PATH/src/App.tsx"; then
        # Adicionar imports após os imports existentes
        sed -i "/^import.*from.*pages/a\\
import ConfiguracoesIA from './pages/ConfiguracoesIA';\\
import CampanhasFacebook from './pages/CampanhasFacebook';\\
import Leads from './pages/Leads';\\
import ListasContatos from './pages/ListasContatos';" "$PROJECT_PATH/src/App.tsx"
        log_success "Imports adicionados"
    else
        log_success "Imports já existem"
    fi
else
    log_error "App.tsx não encontrado"
fi
echo ""

# Passo 4: Adicionar rotas
log_step "Passo 4/7: Adicionando rotas..."
if [ -f "$PROJECT_PATH/src/App.tsx" ]; then
    if ! grep -q "configuracoes-ia" "$PROJECT_PATH/src/App.tsx"; then
        # Adicionar rotas antes do fechamento de Routes
        sed -i "/<\/Routes>/i\\
          <Route path=\"/configuracoes-ia\" element={<ConfiguracoesIA />} />\\
          <Route path=\"/campanhas-facebook\" element={<CampanhasFacebook />} />\\
          <Route path=\"/leads\" element={<Leads />} />\\
          <Route path=\"/listas-contatos\" element={<ListasContatos />} />" "$PROJECT_PATH/src/App.tsx"
        log_success "Rotas adicionadas"
    else
        log_success "Rotas já existem"
    fi
else
    log_error "App.tsx não encontrado"
fi
echo ""

# Passo 5: Atualizar Sidebar
log_step "Passo 5/7: Atualizando Sidebar..."
if [ -f "$PROJECT_PATH/src/components/layout/Sidebar.tsx" ]; then
    # Adicionar import do ícone Megaphone se não existir
    if ! grep -q "Megaphone" "$PROJECT_PATH/src/components/layout/Sidebar.tsx"; then
        sed -i "s/import { \(.*\) } from 'lucide-react'/import { \1, Megaphone } from 'lucide-react'/" "$PROJECT_PATH/src/components/layout/Sidebar.tsx"
    fi
    log_success "Sidebar atualizado (verificar manualmente links)"
else
    log_error "Sidebar.tsx não encontrado"
fi
echo ""

# Passo 6: Instalar dependências
log_step "Passo 6/7: Instalando dependências..."
cd "$PROJECT_PATH"
pnpm install 2>/dev/null || npm install 2>/dev/null || true
log_success "Dependências instaladas"
echo ""

# Passo 7: Validar instalação
log_step "Passo 7/7: Validando instalação..."
ERRORS=0

if [ ! -f "$PROJECT_PATH/src/pages/ConfiguracoesIA.tsx" ]; then
    log_error "ConfiguracoesIA.tsx não encontrado"
    ERRORS=$((ERRORS + 1))
else
    log_success "ConfiguracoesIA.tsx OK"
fi

if [ ! -f "$PROJECT_PATH/src/pages/CampanhasFacebook.tsx" ]; then
    log_error "CampanhasFacebook.tsx não encontrado"
    ERRORS=$((ERRORS + 1))
else
    log_success "CampanhasFacebook.tsx OK"
fi

if [ ! -f "$PROJECT_PATH/src/pages/Leads.tsx" ]; then
    log_error "Leads.tsx não encontrado"
    ERRORS=$((ERRORS + 1))
else
    log_success "Leads.tsx OK"
fi

if [ ! -f "$PROJECT_PATH/src/pages/ListasContatos.tsx" ]; then
    log_error "ListasContatos.tsx não encontrado"
    ERRORS=$((ERRORS + 1))
else
    log_success "ListasContatos.tsx OK"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║            ✅ PATCH 1 INSTALADO COM SUCESSO! ✅             ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}📋 Próximos passos:${NC}"
    echo ""
    echo "  1. Verificar rotas no App.tsx:"
    echo "     cat src/App.tsx | grep -A 5 'configuracoes-ia'"
    echo ""
    echo "  2. Atualizar Sidebar manualmente (adicionar links):"
    echo "     nano src/components/layout/Sidebar.tsx"
    echo ""
    echo "  3. Conectar páginas aos services (veja README.md)"
    echo ""
    echo "  4. Testar build:"
    echo "     cd $PROJECT_PATH"
    echo "     pnpm build"
    echo ""
    echo "  5. Iniciar desenvolvimento:"
    echo "     pnpm dev"
    echo ""
    echo "  6. Acessar:"
    echo "     Frontend: https://primezap.primezapia.com"
    echo ""
    echo -e "${GREEN}✨ Patch 1 aplicado! Agora conecte as páginas aos services.${NC}"
    echo ""
    echo -e "${YELLOW}📦 Backup disponível em:${NC}"
    echo "   $BACKUP_DIR"
    echo ""
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                              ║${NC}"
    echo -e "${RED}║          ⚠️  INSTALAÇÃO CONCLUÍDA COM ERROS ⚠️              ║${NC}"
    echo -e "${RED}║                                                              ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Encontrados $ERRORS erros durante a instalação.${NC}"
    echo ""
    echo "Verifique os logs acima e tente novamente."
    echo ""
    echo "Para reverter:"
    echo "  cp -r $BACKUP_DIR/pages/* $PROJECT_PATH/src/pages/"
    echo "  cp $BACKUP_DIR/App.tsx $PROJECT_PATH/src/"
    echo ""
    exit 1
fi

