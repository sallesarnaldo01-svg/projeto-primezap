# Guia de Aplicação de Migrations via Supabase

**Data**: 03/11/2025  
**Projeto**: PrimeZap AI

## Visão Geral

Este guia descreve como aplicar as migrations do projeto PrimeZap diretamente no Supabase, ao invés de usar `prisma migrate deploy`.

## Por que usar SQL direto no Supabase?

- ✅ **Controle total** sobre o schema do banco
- ✅ **Row Level Security (RLS)** configurado automaticamente
- ✅ **Policies de segurança** aplicadas
- ✅ **Triggers e functions** criados
- ✅ **Grants de permissões** configurados
- ✅ **Compatibilidade** com recursos específicos do PostgreSQL/Supabase

## Passo a Passo

### 1. Acessar o Supabase SQL Editor

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**

### 2. Aplicar Migration de CRM

1. Abra o arquivo `supabase/migrations/20251103_add_crm_tables.sql`
2. Copie todo o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou pressione Ctrl/Cmd + Enter)

**Tempo estimado**: ~5 segundos

### 3. Verificar Tabelas Criadas

Execute o seguinte SQL para confirmar:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links')
ORDER BY table_name;
```

**Resultado esperado**:
```
table_name
-------------------
lead_messages
lead_status_history
leads
schedules
tag_links
```

### 4. Verificar Índices

```sql
SELECT 
  tablename, 
  indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links')
ORDER BY tablename, indexname;
```

### 5. Verificar RLS (Row Level Security)

```sql
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links');
```

**Resultado esperado**: `rowsecurity = true` para todas as tabelas

### 6. Verificar Policies

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links')
ORDER BY tablename, cmd;
```

## Atualizar Schema Prisma

Após aplicar a migration no Supabase, atualize o schema Prisma local:

### Opção A: Pull do Banco (Recomendado)

```bash
cd apps/api

# Fazer pull do schema do Supabase
pnpm exec prisma db pull

# Gerar Prisma Client
pnpm exec prisma generate
```

Isso irá:
- Sincronizar `schema.prisma` com o banco de dados
- Detectar automaticamente as novas tabelas
- Gerar os tipos TypeScript

### Opção B: Adicionar Modelos Manualmente

Se preferir adicionar manualmente, copie os modelos de `prisma/schema_additions.prisma` para `prisma/schema.prisma`:

```bash
# Abrir schema principal
nano prisma/schema.prisma

# Copiar conteúdo de schema_additions.prisma e colar no final

# Validar
pnpm exec prisma validate

# Formatar
pnpm exec prisma format

# Gerar client
pnpm exec prisma generate
```

## Tabelas Criadas

### 1. leads

Tabela principal de leads do CRM.

**Campos principais**:
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `contact_id` (UUID, FK → contacts)
- `name`, `email`, `phone`
- `source`, `status`, `stage`
- `score` (0-100)
- `owner_user_id` (UUID, FK → users)

**Índices**:
- tenant_id, contact_id, owner_user_id
- status, stage

### 2. lead_status_history

Histórico de mudanças de status.

**Campos principais**:
- `id` (UUID, PK)
- `lead_id` (UUID, FK → leads)
- `old_status`, `new_status`
- `changed_by` (UUID, FK → users)
- `changed_at`

### 3. lead_messages

Mensagens e notas dos leads.

**Campos principais**:
- `id` (UUID, PK)
- `lead_id` (UUID, FK → leads)
- `author_id` (UUID, FK → users)
- `role`, `content`

### 4. schedules

Agendamentos de visitas e callbacks.

**Campos principais**:
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `lead_id` (UUID, FK → leads)
- `title`, `starts_at`, `ends_at`
- `status` (scheduled, completed, cancelled)

### 5. tag_links

Sistema flexível de tags.

**Campos principais**:
- `tag_id` (UUID, FK → tags)
- `contact_id` (UUID, FK → contacts, opcional)
- `lead_id` (UUID, FK → leads, opcional)
- `deal_id` (UUID, FK → deals, opcional)

**Constraint**: Pelo menos um ID (contact, lead ou deal) deve estar presente.

## Row Level Security (RLS)

Todas as tabelas têm RLS habilitado com as seguintes policies:

### Leads

- **SELECT**: Usuários veem apenas leads do seu tenant
- **INSERT**: Usuários podem criar leads no seu tenant
- **UPDATE**: Usuários podem atualizar leads do seu tenant
- **DELETE**: Usuários podem deletar leads do seu tenant

### Outras Tabelas

Policies similares aplicadas para garantir isolamento por tenant.

## Triggers

### update_leads_updated_at

Atualiza automaticamente o campo `updated_at` quando um lead é modificado.

```sql
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

## Permissões (Grants)

Todas as tabelas têm permissões configuradas para `authenticated`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT ON public.lead_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.tag_links TO authenticated;
```

## Rollback (Se Necessário)

Se precisar reverter a migration:

```sql
-- Desabilitar RLS temporariamente
ALTER TABLE public.tag_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

-- Dropar tabelas (ordem importa devido a FKs)
DROP TABLE IF EXISTS public.tag_links CASCADE;
DROP TABLE IF EXISTS public.lead_messages CASCADE;
DROP TABLE IF EXISTS public.lead_status_history CASCADE;
DROP TABLE IF EXISTS public.schedules CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;

-- Dropar trigger e function se necessário
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
-- Nota: Não dropar a function se outras tabelas a usam
```

## Troubleshooting

### Erro: "relation already exists"

Se a tabela já existe, a migration é idempotente (`CREATE TABLE IF NOT EXISTS`), então não haverá erro.

### Erro: "foreign key constraint"

Certifique-se de que as tabelas referenciadas existem:
- `tenants`
- `contacts`
- `users`
- `tags`
- `deals`

### Erro: "permission denied"

Verifique se você está usando a **Service Role Key** no Supabase ou se está logado como administrador.

### Erro: "function auth.uid() does not exist"

Isso indica que você está testando fora do contexto de autenticação do Supabase. As policies funcionarão corretamente quando acessadas via API do Supabase.

## Próximos Passos

Após aplicar a migration:

1. ✅ Atualizar schema Prisma (`prisma db pull`)
2. ✅ Gerar Prisma Client (`prisma generate`)
3. ✅ Executar testes de integração
4. ✅ Validar no Supabase Table Editor
5. ✅ Testar RLS com diferentes usuários

## Validação Final

Execute este checklist no Supabase:

```sql
-- 1. Verificar tabelas
SELECT COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links');
-- Esperado: 5

-- 2. Verificar RLS habilitado
SELECT COUNT(*) as tables_with_rls
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links')
  AND rowsecurity = true;
-- Esperado: 5

-- 3. Verificar policies
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE tablename IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links');
-- Esperado: >= 10

-- 4. Verificar índices
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links');
-- Esperado: >= 15

-- 5. Verificar foreign keys
SELECT COUNT(*) as total_fks
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND table_name IN ('leads', 'lead_status_history', 'lead_messages', 'schedules', 'tag_links')
  AND constraint_type = 'FOREIGN KEY';
-- Esperado: >= 10
```

Se todos os checks passarem, a migration foi aplicada com sucesso! ✅

---

**Preparado por**: Manus AI  
**Data**: 03/11/2025  
**Versão**: 1.0
