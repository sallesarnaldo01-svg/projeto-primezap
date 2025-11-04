#!/bin/bash

# Script para migrar migrations do Prisma para formato Supabase
# Este script copia e organiza as migrations existentes para o formato esperado pelo Supabase CLI

set -e

echo "🔄 Migrando migrations do Prisma para Supabase..."

# Criar diretório de migrations do Supabase se não existir
mkdir -p supabase/migrations

# Contador para numeração sequencial
counter=1

# Função para copiar migration com timestamp
copy_migration() {
    local source=$1
    local name=$2
    local timestamp=$(printf "%014d" $counter)
    local target="supabase/migrations/${timestamp}_${name}.sql"
    
    if [ -f "$source" ]; then
        echo "  ✅ Copiando: $name"
        cp "$source" "$target"
        ((counter++))
    elif [ -d "$source" ]; then
        if [ -f "$source/migration.sql" ]; then
            echo "  ✅ Copiando: $name"
            cp "$source/migration.sql" "$target"
            ((counter++))
        fi
    fi
}

# Copiar migrations na ordem correta
echo "📦 Copiando migrations core..."
copy_migration "prisma/migrations/001_create_core_tables.sql" "create_core_tables"
copy_migration "prisma/migrations/002_create_crm_tables.sql" "create_crm_tables"
copy_migration "prisma/migrations/003_create_ai_tables.sql" "create_ai_tables"
copy_migration "prisma/migrations/004_create_conversation_tables.sql" "create_conversation_tables"
copy_migration "prisma/migrations/005_create_workflow_tables.sql" "create_workflow_tables"
copy_migration "prisma/migrations/006_create_scrum_tables.sql" "create_scrum_tables"
copy_migration "prisma/migrations/007_create_storage_buckets.sql" "create_storage_buckets"

echo "📦 Copiando migrations de features..."
copy_migration "prisma/migrations/20250103_user_roles.sql" "user_roles"
copy_migration "prisma/migrations/202510041715_add_backlog_items" "add_backlog_items"
copy_migration "prisma/migrations/202510041730_adjust_backlog_items" "adjust_backlog_items"
copy_migration "prisma/migrations/20251009112839_conversations_system" "conversations_system"
copy_migration "prisma/migrations/202510091600_add_patch_v8_structures.sql" "add_patch_v8_structures"
copy_migration "prisma/migrations/202510101100_sync_core_schema" "sync_core_schema"
copy_migration "prisma/migrations/202510101230_patch7_core_structures" "patch7_core_structures"

echo "📦 Copiando migrations de CRM..."
copy_migration "prisma/migrations/202510261700_crm_modules.sql" "crm_modules"
copy_migration "prisma/migrations/202510261720_leads_enhancements.sql" "leads_enhancements"
copy_migration "prisma/migrations/202510261740_lead_actions.sql" "lead_actions"
copy_migration "prisma/migrations/202510261750_deal_interactions.sql" "deal_interactions"
copy_migration "prisma/migrations/202510261800_notifications.sql" "notifications"
copy_migration "prisma/migrations/202510261815_appointments.sql" "appointments"

echo "📦 Copiando migrations recentes..."
copy_migration "prisma/migrations/202510271000_generate_pre_cadastro_numero.sql" "generate_pre_cadastro_numero"
copy_migration "prisma/migrations/202510271015_drop_temp_compat.sql" "drop_temp_compat"
copy_migration "prisma/migrations/202510271120_appointments_recreate.sql" "appointments_recreate"
copy_migration "prisma/migrations/202510291700_add_password_hash.sql" "add_password_hash"
copy_migration "prisma/migrations/202510291705_create_integrations.sql" "create_integrations"
copy_migration "prisma/migrations/202510291710_create_whatsapp_connections.sql" "create_whatsapp_connections"
copy_migration "prisma/migrations/20251101_add_connections_columns.sql" "add_connections_columns"
copy_migration "prisma/migrations/20251101_documents_bucket.sql" "documents_bucket"
copy_migration "prisma/migrations/20251101_view_whatsapp_connections.sql" "view_whatsapp_connections"
copy_migration "prisma/migrations/20251103000001_add_crm_missing_tables" "add_crm_missing_tables"

echo "📦 Copiando migrations de correção..."
copy_migration "supabase/migrations/20251104_fix_rls_performance.sql" "fix_rls_performance"
copy_migration "supabase/migrations/20251104_fix_rls_security.sql" "fix_rls_security"

echo ""
echo "✅ Migração concluída! $((counter-1)) migrations copiadas."
echo ""
echo "📝 Próximos passos:"
echo "  1. Revisar migrations em supabase/migrations/"
echo "  2. Configurar SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF"
echo "  3. Executar: supabase link --project-ref <PROJECT_REF>"
echo "  4. Executar: supabase db push"
echo ""
