-- Align backlog_items table with Prisma model
ALTER TABLE "backlog_items"
  ADD COLUMN IF NOT EXISTS "sprintId" UUID,
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'TASK',
  ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "epic" TEXT,
  ADD COLUMN IF NOT EXISTS "assignee" UUID;

-- Ensure status/priority columns exist with defaults
ALTER TABLE "backlog_items"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'TODO';
ALTER TABLE "backlog_items"
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS "backlog_items_tenant_status_idx" ON "backlog_items" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "backlog_items_sprint_idx" ON "backlog_items" ("sprintId");
