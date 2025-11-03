-- Create backlog_items table and relation to tenants
CREATE TABLE IF NOT EXISTS "backlog_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign key to tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'backlog_items_tenant_fkey'
  ) THEN
    ALTER TABLE "backlog_items"
      ADD CONSTRAINT backlog_items_tenant_fkey
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "backlog_items_tenant_idx" ON "backlog_items" ("tenantId");
