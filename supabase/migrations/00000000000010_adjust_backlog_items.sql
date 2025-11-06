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

DO $$
DECLARE
  tenant_column TEXT;
  status_column TEXT;
BEGIN
  SELECT column_name
  INTO tenant_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'backlog_items'
    AND column_name IN ('tenantId', 'tenant_id')
  ORDER BY CASE column_name WHEN 'tenantId' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT column_name
  INTO status_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'backlog_items'
    AND column_name IN ('status', 'status')
  LIMIT 1;

  IF tenant_column IS NULL OR status_column IS NULL THEN
    RAISE NOTICE 'Skipping backlog_items_tenant_status_idx because tenant or status column not found.';
  ELSE
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS backlog_items_tenant_status_idx ON public.backlog_items (%I, %I)',
      tenant_column,
      status_column
    );
  END IF;
END;
$$;

DO $$
DECLARE
  sprint_column TEXT;
BEGIN
  SELECT column_name
  INTO sprint_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'backlog_items'
    AND column_name IN ('sprintId', 'sprint_id')
  ORDER BY CASE column_name WHEN 'sprintId' THEN 1 ELSE 2 END
  LIMIT 1;

  IF sprint_column IS NULL THEN
    RAISE NOTICE 'Skipping backlog_items_sprint_idx because sprint column not found.';
  ELSE
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS backlog_items_sprint_idx ON public.backlog_items (%I)',
      sprint_column
    );
  END IF;
END;
$$;
