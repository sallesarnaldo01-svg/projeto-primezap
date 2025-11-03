# Fase 1.3: Análise do Schema Prisma vs Supabase

**Data:** 03/11/2025  
**Status:** Análise concluída

## Resumo Executivo

Após conectar com sucesso na API REST do Supabase, realizei uma análise comparativa entre o schema Prisma local e as tabelas existentes no banco de dados.

### Números

- **Modelos no Prisma:** 77
- **Tabelas no Supabase:** 42
- **Diferença:** 35 tabelas/modelos

## Situação Atual

O banco de dados Supabase já possui uma base significativa de tabelas criadas, incluindo as principais funcionalidades:

### Tabelas Existentes no Supabase (42)

**Core/Infraestrutura:**
- connections, integrations
- profiles, user_roles
- tenants (implícito via tenant_id)

**Conversas e Mensagens:**
- conversations, conversation_events
- messages, message_attachments, message_templates
- internal_chats, internal_messages

**Leads e CRM:**
- leads, lead_messages, lead_status_history
- contacts, contact_lists, contact_list_members
- deals, deal_activities
- tags, tag_links

**Campanhas e Broadcasts:**
- campaigns, broadcasts
- workflows, workflow_runs, workflow_logs

**Integrações:**
- whatsapp_connections
- facebook_connections
- instagram_connections

**IA e Automação:**
- ai_agent_configs, ai_usage
- knowledge_items

**Imobiliário (Específico do Negócio):**
- empreendimentos, properties, property_visits
- pre_cadastros, documentos_pre_cadastro
- correspondentes, correspondentes_usuarios
- commissions, schedules

**Notificações:**
- notification_preferences

### Principais Tabelas Faltantes

Analisando o schema Prisma, as tabelas faltantes são principalmente:

1. **Tabelas de Produtos e E-commerce:**
   - Product, ProductImage
   - invoices, transactions

2. **Sistema de Filas:**
   - Queue (para gerenciamento de filas BullMQ)

3. **IA Avançada:**
   - ai_agents, ai_auto_replies, ai_configurations
   - ai_providers, ai_tools
   - KnowledgeDocument, KnowledgeEmbedding

4. **CRM Avançado:**
   - companies
   - custom_fields
   - deal_history, deal_interactions, deal_tags
   - contact_activities, contact_tags

5. **Gestão de Projetos (Scrum):**
   - scrum_teams, sprints, ceremonies
   - backlog_items

6. **Workflows Avançados:**
   - flows, flow_nodes, flow_edges, flow_executions

7. **Campanhas Avançadas:**
   - facebook_campaigns
   - campaign_messages, campaign_phrases, campaign_recipients
   - scheduled_campaigns, scheduled_jobs

8. **Outras:**
   - appointments, video_calls
   - auth_users, public_users
   - stages, tag_categories
   - team_members
   - webhook_events
   - notifications
   - media, media_files
   - documento_tipos
   - simulacoes_financiamento
   - ticket
   - activity
   - lead_actions, lead_interactions
   - FollowUpCadence

## Análise de Impacto

### Crítico (Bloqueia funcionalidades principais)

Nenhuma tabela crítica está faltando. As tabelas essenciais para o funcionamento básico do sistema já existem:
- ✓ Conversas e mensagens
- ✓ Leads e contatos
- ✓ Integrações WhatsApp/Facebook/Instagram
- ✓ Campanhas e broadcasts
- ✓ Workflows básicos

### Alto (Funcionalidades importantes)

- **companies** - CRM corporativo
- **custom_fields** - Personalização de campos
- **flows/flow_nodes/flow_edges** - Workflows visuais avançados
- **ai_agents/ai_providers** - IA configurável

### Médio (Funcionalidades complementares)

- Produtos e e-commerce
- Gestão de projetos Scrum
- Campanhas Facebook avançadas
- Sistema de tickets

## Estratégia Recomendada

### Opção 1: Migration Incremental (Recomendada)

Aplicar migrations apenas para as tabelas que serão usadas imediatamente:

**Prioridade 1 (Imediato):**
- companies
- custom_fields
- stages
- flows, flow_nodes, flow_edges

**Prioridade 2 (Curto prazo):**
- ai_agents, ai_providers, ai_tools
- Product, ProductImage
- appointments

**Prioridade 3 (Médio prazo):**
- Scrum (se necessário)
- E-commerce completo (se necessário)

### Opção 2: Migration Completa

Aplicar todas as migrations do Prisma de uma vez, criando todas as 35 tabelas faltantes.

**Vantagens:**
- Schema completo e consistente
- Preparado para futuras funcionalidades

**Desvantagens:**
- Mais complexo
- Tabelas não utilizadas ocupam espaço

## Próximos Passos

1. **Decidir estratégia:** Incremental ou Completa
2. **Gerar SQL de migration:** A partir do schema Prisma
3. **Testar em ambiente de staging** (se disponível)
4. **Aplicar via Supabase Dashboard ou API**
5. **Validar integridade:** Verificar foreign keys e índices

## Observações Importantes

- O Supabase não permite execução de SQL arbitrário via REST API por segurança
- Migrations devem ser aplicadas via:
  - Supabase Dashboard (SQL Editor)
  - Supabase CLI
  - Connection Pooler (porta 6543) - tentamos mas não conseguimos conectar da sandbox

## Recomendação Final

**Pular para Fase 1.4** e deixar as migrations para serem aplicadas por você localmente, pois:

1. As tabelas críticas já existem no Supabase
2. O sistema pode funcionar com o schema atual
3. Migrations podem ser aplicadas incrementalmente conforme necessidade
4. Você tem melhor controle e visibilidade do processo localmente

Vou criar scripts de migration prontos para você executar quando necessário.
