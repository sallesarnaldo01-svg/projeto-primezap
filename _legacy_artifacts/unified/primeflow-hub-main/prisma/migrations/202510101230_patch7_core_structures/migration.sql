-- =================================================================================================
-- Patch 7: Estruturas centrais para CRM avançado (empresas, listas de contato, finanças e tags)
-- Esta migration adiciona as tabelas e campos necessários para substituir os mocks do frontend
-- por dados reais, habilitando os módulos de deals, tags, contact-lists, financeiro e relatórios.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- Empresas
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "tax_id" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB DEFAULT '{}'::jsonb,
    "logo_url" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT '{}'::text[],
    "status" TEXT DEFAULT 'active',
    "health_score" INTEGER DEFAULT 0,
    "revenue" DECIMAL(15,2),
    "employees" INTEGER,
    "owner_id" UUID,
    "last_interaction_at" TIMESTAMPTZ,
    "custom_fields" JSONB DEFAULT '{}'::jsonb,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_companies_tenant_id" ON "public"."companies"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_companies_tax_id" ON "public"."companies"("tax_id");

ALTER TABLE "public"."companies"
    ADD CONSTRAINT "companies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."companies"
    ADD CONSTRAINT "companies_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- -------------------------------------------------------------------------------------------------
-- Contatos: novos campos e relacionamentos
-- -------------------------------------------------------------------------------------------------
ALTER TABLE "public"."contacts"
    ADD COLUMN IF NOT EXISTS "tenant_id" UUID,
    ADD COLUMN IF NOT EXISTS "user_id" UUID,
    ADD COLUMN IF NOT EXISTS "integration_id" UUID,
    ADD COLUMN IF NOT EXISTS "company_id" UUID,
    ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
    ADD COLUMN IF NOT EXISTS "whatsapp_id" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "facebook_id" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "instagram_id" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "origem" TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS "lead_status" TEXT DEFAULT 'novo',
    ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "labels" TEXT[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "is_blocked" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "is_favorite" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "last_interaction_at" TIMESTAMPTZ;

UPDATE "public"."contacts" AS c
SET tenant_id = u.tenant_id
FROM "public"."users" AS u
WHERE c.user_id = u.id
  AND c.tenant_id IS NULL;

ALTER TABLE "public"."contacts"
    ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_contacts_integration_id" ON "public"."contacts"("integration_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_company_id" ON "public"."contacts"("company_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_facebook_id" ON "public"."contacts"("facebook_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_instagram_id" ON "public"."contacts"("instagram_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_whatsapp_id" ON "public"."contacts"("whatsapp_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_user_id" ON "public"."contacts"("user_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_phone" ON "public"."contacts"("phone");
CREATE INDEX IF NOT EXISTS "idx_contacts_tenant_id" ON "public"."contacts"("tenant_id");

ALTER TABLE "public"."contacts"
    ADD CONSTRAINT "contacts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;


-- -------------------------------------------------------------------------------------------------
-- Listas de Contatos
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."contact_lists" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT DEFAULT 'manual',
    "filter_criteria" JSONB DEFAULT '{}'::jsonb,
    "contact_count" INTEGER DEFAULT 0,
    "created_by" UUID,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_contact_lists_tenant_id" ON "public"."contact_lists"("tenant_id");

ALTER TABLE "public"."contact_lists"
    ADD CONSTRAINT "contact_lists_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."contact_lists"
    ADD CONSTRAINT "contact_lists_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS "public"."contact_list_members" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "list_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE "public"."contact_list_members"
    ADD CONSTRAINT "contact_list_members_list_id_fkey"
    FOREIGN KEY ("list_id") REFERENCES "public"."contact_lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."contact_list_members"
    ADD CONSTRAINT "contact_list_members_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "contact_list_members_list_contact_unique"
    ON "public"."contact_list_members"("list_id", "contact_id");

CREATE INDEX IF NOT EXISTS "idx_contact_list_members_list"
    ON "public"."contact_list_members"("list_id");

CREATE INDEX IF NOT EXISTS "idx_contact_list_members_contact"
    ON "public"."contact_list_members"("contact_id");

-- -------------------------------------------------------------------------------------------------
-- Categorias e metadados de Tags
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."tag_categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#4A90E2',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "tag_categories_tenant_name_unique" UNIQUE ("tenant_id", "name")
);

ALTER TABLE "public"."tag_categories"
    ADD CONSTRAINT "tag_categories_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."tags"
    ADD COLUMN IF NOT EXISTS "category_id" UUID,
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "category" TEXT,
    ADD COLUMN IF NOT EXISTS "usage_count" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "idx_tags_category_id" ON "public"."tags"("category_id");

ALTER TABLE "public"."tags"
    DROP CONSTRAINT IF EXISTS "tags_tenant_id_name_category_key";

ALTER TABLE "public"."tags"
    DROP CONSTRAINT IF EXISTS "tags_tenant_id_name_key";

ALTER TABLE "public"."tags"
    ADD CONSTRAINT "tags_tenant_id_name_key" UNIQUE ("tenant_id", "name");

ALTER TABLE "public"."tags"
    ADD CONSTRAINT "tags_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "public"."tag_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- -------------------------------------------------------------------------------------------------
-- Faturamento (Invoices e Transactions)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID,
    "company_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_date" DATE,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT DEFAULT 'BRL',
    "status" TEXT DEFAULT 'pending',
    "payment_method" TEXT,
    "notes" TEXT,
    "items" JSONB DEFAULT '[]'::jsonb,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "invoices_invoice_number_unique" UNIQUE ("invoice_number")
);

CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_id" ON "public"."invoices"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_contact_id" ON "public"."invoices"("contact_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_company_id" ON "public"."invoices"("company_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "public"."invoices"("status");
CREATE INDEX IF NOT EXISTS "idx_invoices_due_date" ON "public"."invoices"("due_date");

ALTER TABLE "public"."invoices"
    ADD CONSTRAINT "invoices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."invoices"
    ADD CONSTRAINT "invoices_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."invoices"
    ADD CONSTRAINT "invoices_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID,
    "company_id" UUID,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT DEFAULT 'BRL',
    "date" DATE NOT NULL,
    "description" TEXT,
    "payment_method" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_transactions_tenant_id" ON "public"."transactions"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_invoice_id" ON "public"."transactions"("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_type" ON "public"."transactions"("type");
CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "public"."transactions"("date");

ALTER TABLE "public"."transactions"
    ADD CONSTRAINT "transactions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."transactions"
    ADD CONSTRAINT "transactions_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."transactions"
    ADD CONSTRAINT "transactions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- -------------------------------------------------------------------------------------------------
-- Campanhas do Facebook
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."facebook_campaigns" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facebook_campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT DEFAULT 'active',
    "budget" DECIMAL(15,2),
    "currency" TEXT DEFAULT 'BRL',
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "metrics" JSONB DEFAULT '{}'::jsonb,
    "last_sync_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "facebook_campaigns_unique_external_id" UNIQUE ("facebook_campaign_id")
);

CREATE INDEX IF NOT EXISTS "idx_facebook_campaigns_tenant_id"
    ON "public"."facebook_campaigns"("tenant_id");

ALTER TABLE "public"."facebook_campaigns"
    ADD CONSTRAINT "facebook_campaigns_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- -------------------------------------------------------------------------------------------------
-- Atividades de Deals
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."deal_activities" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_deal_activities_deal_id"
    ON "public"."deal_activities"("deal_id");

CREATE INDEX IF NOT EXISTS "idx_deal_activities_created_at"
    ON "public"."deal_activities"("created_at" DESC);

ALTER TABLE "public"."deal_activities"
    ADD CONSTRAINT "deal_activities_deal_id_fkey"
    FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."deal_activities"
    ADD CONSTRAINT "deal_activities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
