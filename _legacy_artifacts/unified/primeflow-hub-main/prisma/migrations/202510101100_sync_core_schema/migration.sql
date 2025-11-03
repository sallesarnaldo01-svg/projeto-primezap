-- =================================================================================================
-- Migration: 202510131900_sync_core_schema
-- Objetivo: Sincronizar o banco existente com o schema Prisma antes do Patch 7.
-- Gerado via `prisma migrate diff --from-url postgres://... --to-schema-datamodel prisma/schema.prisma --script`
-- e complementado para preencher o tenant_id dos contatos existentes.
-- =================================================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "public"."backlog_items" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "actual_hours" DECIMAL(5,2),
ADD COLUMN     "assigned_to" UUID,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estimated_hours" DECIMAL(5,2),
ADD COLUMN     "item_type" TEXT DEFAULT 'story',
ADD COLUMN     "sprint_id" UUID,
ADD COLUMN     "story_points" INTEGER,
ADD COLUMN     "team_id" UUID NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'todo',
ALTER COLUMN "priority" DROP NOT NULL,
ALTER COLUMN "priority" SET DEFAULT 'medium',
ALTER COLUMN "priority" SET DATA TYPE TEXT,
ALTER COLUMN "sprintId" SET DATA TYPE TEXT,
ALTER COLUMN "assignee" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."connections" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "instagram_account_id" TEXT,
ADD COLUMN     "last_sync_at" TIMESTAMP(6),
ADD COLUMN     "page_id" TEXT,
ADD COLUMN     "webhook_verified" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "public"."contacts" ADD COLUMN     "lead_status" TEXT DEFAULT 'novo',
ADD COLUMN     "origem" TEXT DEFAULT 'manual',
ADD COLUMN     "tenant_id" UUID,
ALTER COLUMN "user_id" DROP NOT NULL;

-- Preencher tenant_id existente com base no usuário vinculado
UPDATE "public"."contacts" AS c
SET tenant_id = u.tenant_id
FROM "public"."users" AS u
WHERE c.user_id = u.id
  AND c.tenant_id IS NULL;

-- CreateTable
CREATE TABLE "public"."ai_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "provider_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "temperature" DECIMAL(3,2) DEFAULT 0.7,
    "max_tokens" INTEGER DEFAULT 1000,
    "is_active" BOOLEAN DEFAULT true,
    "config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key" TEXT,
    "model" TEXT NOT NULL,
    "config" JSONB DEFAULT '{}',
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_tools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "endpoint" TEXT,
    "parameters" JSONB NOT NULL,
    "response_schema" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "agent_id" UUID,
    "provider_id" UUID,
    "contact_id" UUID,
    "conversation_id" UUID,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost" DECIMAL(10,6) DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "enabled" BOOLEAN DEFAULT true,
    "auto_reply" BOOLEAN DEFAULT false,
    "sentiment_analysis" BOOLEAN DEFAULT false,
    "suggestion_enabled" BOOLEAN DEFAULT false,
    "config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_auto_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "configuration_id" UUID,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "message_id" UUID,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokens_used" INTEGER DEFAULT 0,
    "confidence" DECIMAL(5,2),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_auto_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."campaign_phrases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "integration_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'scheduled',
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "messages_payload" JSONB NOT NULL DEFAULT '[]',
    "delay_seconds" INTEGER DEFAULT 5,
    "simulate_typing" BOOLEAN DEFAULT true,
    "simulate_recording" BOOLEAN DEFAULT false,
    "stats" JSONB DEFAULT '{}',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ceremonies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "sprint_id" UUID,
    "ceremony_type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ceremonies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "contact_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER DEFAULT 60,
    "type" VARCHAR(50) DEFAULT 'other',
    "status" VARCHAR(50) DEFAULT 'pending',
    "location" TEXT,
    "assigned_to" UUID,
    "reminder_minutes" INTEGER DEFAULT 30,
    "reminder_sent" BOOLEAN DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contact_tags" (
    "contact_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("contact_id","tag_id")
);

-- CreateTable
CREATE TABLE "public"."contact_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "user_id" UUID,
    "type" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."custom_fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN DEFAULT false,
    "display_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."deal_tags" (
    "deal_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "deal_tags_pkey" PRIMARY KEY ("deal_id","tag_id")
);

-- CreateTable
CREATE TABLE "public"."deals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID,
    "stage_id" UUID,
    "owner_id" UUID,
    "title" TEXT NOT NULL,
    "value" DECIMAL(15,2),
    "currency" TEXT DEFAULT 'BRL',
    "probability" INTEGER DEFAULT 0,
    "expected_close_date" DATE,
    "notes" TEXT,
    "custom_data" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."deal_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flow_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flow_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "label" TEXT,
    "condition" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flow_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flow_id" UUID NOT NULL,
    "contact_id" UUID,
    "conversation_id" UUID,
    "status" TEXT DEFAULT 'running',
    "current_node_id" UUID,
    "variables" JSONB DEFAULT '{}',
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "flow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flow_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flow_id" UUID NOT NULL,
    "node_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position_x" DECIMAL(10,2) NOT NULL,
    "position_y" DECIMAL(10,2) NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL,
    "trigger_config" JSONB DEFAULT '{}',
    "is_active" BOOLEAN DEFAULT false,
    "version" INTEGER DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."knowledge_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "agent_id" UUID,
    "name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_url" TEXT,
    "storage_path" TEXT,
    "content" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "chunk_count" INTEGER DEFAULT 0,
    "embedding_status" TEXT DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."knowledge_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "message_id" UUID,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "alt_text" TEXT,
    "display_order" INTEGER DEFAULT 0,
    "ai_tags" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "price" DECIMAL(15,2),
    "stock" INTEGER DEFAULT 0,
    "category" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "ai_tags" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "job_data" JSONB NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "attempts" INTEGER DEFAULT 0,
    "max_attempts" INTEGER DEFAULT 3,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scrum_teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrum_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sprints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT DEFAULT 'planning',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#3b82f6',
    "display_order" INTEGER DEFAULT 0,
    "is_final" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_members" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."video_calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "room_name" TEXT NOT NULL,
    "host_id" UUID,
    "title" TEXT,
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "status" TEXT DEFAULT 'scheduled',
    "participants" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_agents_tenant_id" ON "public"."ai_agents"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_ai_tools_tenant_id" ON "public"."ai_tools"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_ai_tools_trigger" ON "public"."ai_tools"("trigger");

-- CreateIndex
CREATE INDEX "idx_ai_usage_created_at" ON "public"."ai_usage"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_ai_usage_tenant_id" ON "public"."ai_usage"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_ai_configurations_provider" ON "public"."ai_configurations"("provider");

-- CreateIndex
CREATE INDEX "idx_ai_configurations_user_id" ON "public"."ai_configurations"("user_id");

-- CreateIndex
CREATE INDEX "idx_ai_auto_replies_configuration_id" ON "public"."ai_auto_replies"("configuration_id");

-- CreateIndex
CREATE INDEX "idx_ai_auto_replies_conversation_id" ON "public"."ai_auto_replies"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_ai_auto_replies_message_id" ON "public"."ai_auto_replies"("message_id");

-- CreateIndex
CREATE INDEX "idx_ai_auto_replies_user_id" ON "public"."ai_auto_replies"("user_id");

-- CreateIndex
CREATE INDEX "idx_scheduled_campaigns_integration_id" ON "public"."scheduled_campaigns"("integration_id");

-- CreateIndex
CREATE INDEX "idx_scheduled_campaigns_scheduled_at" ON "public"."scheduled_campaigns"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_scheduled_campaigns_status" ON "public"."scheduled_campaigns"("status");

-- CreateIndex
CREATE INDEX "idx_scheduled_campaigns_user_id" ON "public"."scheduled_campaigns"("user_id");

-- CreateIndex
CREATE INDEX "idx_ceremonies_team_id" ON "public"."ceremonies"("team_id");

-- CreateIndex
CREATE INDEX "idx_appointments_contact_id" ON "public"."appointments"("contact_id");

-- CreateIndex
CREATE INDEX "idx_appointments_scheduled_at" ON "public"."appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_appointments_status" ON "public"."appointments"("status");

-- CreateIndex
CREATE INDEX "idx_appointments_user_id" ON "public"."appointments"("user_id");

-- CreateIndex
CREATE INDEX "idx_contact_activities_contact_id" ON "public"."contact_activities"("contact_id");

-- CreateIndex
CREATE INDEX "idx_contact_activities_user_id" ON "public"."contact_activities"("user_id");

-- CreateIndex
CREATE INDEX "idx_deals_contact_id" ON "public"."deals"("contact_id");

-- CreateIndex
CREATE INDEX "idx_deals_owner_id" ON "public"."deals"("owner_id");

-- CreateIndex
CREATE INDEX "idx_deals_stage_id" ON "public"."deals"("stage_id");

-- CreateIndex
CREATE INDEX "idx_deals_tenant_id" ON "public"."deals"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_deal_history_deal_id" ON "public"."deal_history"("deal_id");

-- CreateIndex
CREATE INDEX "idx_deal_history_user_id" ON "public"."deal_history"("user_id");

-- CreateIndex
CREATE INDEX "idx_flow_edges_flow_id" ON "public"."flow_edges"("flow_id");

-- CreateIndex
CREATE INDEX "idx_flow_edges_source_node" ON "public"."flow_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "idx_flow_edges_target_node" ON "public"."flow_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "idx_flow_executions_flow_id" ON "public"."flow_executions"("flow_id");

-- CreateIndex
CREATE INDEX "idx_flow_executions_status" ON "public"."flow_executions"("status");

-- CreateIndex
CREATE INDEX "idx_flow_nodes_flow_id" ON "public"."flow_nodes"("flow_id");

-- CreateIndex
CREATE INDEX "idx_flows_is_active" ON "public"."flows"("is_active");

-- CreateIndex
CREATE INDEX "idx_flows_tenant_id" ON "public"."flows"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_knowledge_docs_agent_id" ON "public"."knowledge_documents"("agent_id");

-- CreateIndex
CREATE INDEX "idx_knowledge_docs_tenant_id" ON "public"."knowledge_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_media_files_message_id" ON "public"."media_files"("message_id");

-- CreateIndex
CREATE INDEX "idx_media_files_user_id" ON "public"."media_files"("user_id");

-- CreateIndex
CREATE INDEX "idx_products_sku" ON "public"."products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_tenant_id" ON "public"."products"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_scheduled_jobs_scheduled_at" ON "public"."scheduled_jobs"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_scheduled_jobs_tenant_id" ON "public"."scheduled_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_scrum_teams_tenant_id" ON "public"."scrum_teams"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_sprints_team_id" ON "public"."sprints"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_calls_room_name_key" ON "public"."video_calls"("room_name");

-- CreateIndex
CREATE INDEX "idx_video_calls_tenant_id" ON "public"."video_calls"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_backlog_items_sprint_id" ON "public"."backlog_items"("sprint_id");

-- CreateIndex
CREATE INDEX "idx_backlog_items_team_id" ON "public"."backlog_items"("team_id");

-- CreateIndex
CREATE INDEX "idx_contacts_tenant_id" ON "public"."contacts"("tenant_id");

-- AddForeignKey
ALTER TABLE "public"."ai_agents" ADD CONSTRAINT "ai_agents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_agents" ADD CONSTRAINT "ai_agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_providers" ADD CONSTRAINT "ai_providers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_tools" ADD CONSTRAINT "ai_tools_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_usage" ADD CONSTRAINT "ai_usage_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_usage" ADD CONSTRAINT "ai_usage_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_usage" ADD CONSTRAINT "ai_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_configurations" ADD CONSTRAINT "ai_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_auto_replies" ADD CONSTRAINT "ai_auto_replies_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_configurations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_auto_replies" ADD CONSTRAINT "ai_auto_replies_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_auto_replies" ADD CONSTRAINT "ai_auto_replies_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ai_auto_replies" ADD CONSTRAINT "ai_auto_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."backlog_items" ADD CONSTRAINT "backlog_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."backlog_items" ADD CONSTRAINT "backlog_items_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."backlog_items" ADD CONSTRAINT "backlog_items_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."scrum_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."campaign_phrases" ADD CONSTRAINT "campaign_phrases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."scheduled_campaigns" ADD CONSTRAINT "scheduled_campaigns_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."scheduled_campaigns" ADD CONSTRAINT "scheduled_campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ceremonies" ADD CONSTRAINT "ceremonies_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ceremonies" ADD CONSTRAINT "ceremonies_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."scrum_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contact_tags" ADD CONSTRAINT "contact_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contact_activities" ADD CONSTRAINT "contact_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contact_activities" ADD CONSTRAINT "contact_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."custom_fields" ADD CONSTRAINT "custom_fields_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deal_tags" ADD CONSTRAINT "deal_tags_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deal_tags" ADD CONSTRAINT "deal_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deal_history" ADD CONSTRAINT "deal_history_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."deal_history" ADD CONSTRAINT "deal_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flow_edges" ADD CONSTRAINT "flow_edges_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flow_edges" ADD CONSTRAINT "flow_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "public"."flow_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flow_edges" ADD CONSTRAINT "flow_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "public"."flow_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flow_executions" ADD CONSTRAINT "flow_executions_current_node_id_fkey" FOREIGN KEY ("current_node_id") REFERENCES "public"."flow_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flow_executions" ADD CONSTRAINT "flow_executions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flow_nodes" ADD CONSTRAINT "flow_nodes_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flows" ADD CONSTRAINT "flows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."flows" ADD CONSTRAINT "flows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."knowledge_documents" ADD CONSTRAINT "knowledge_documents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."media_files" ADD CONSTRAINT "media_files_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."media_files" ADD CONSTRAINT "media_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."scrum_teams" ADD CONSTRAINT "scrum_teams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."sprints" ADD CONSTRAINT "sprints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."scrum_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."stages" ADD CONSTRAINT "stages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."scrum_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."video_calls" ADD CONSTRAINT "video_calls_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."video_calls" ADD CONSTRAINT "video_calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
