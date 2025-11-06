DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'backlog_items'
  ) THEN
    EXECUTE '
      CREATE TABLE public.backlog_items (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT ''TODO'',
        "priority" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )';
  ELSE
    RAISE NOTICE 'Skipping public.backlog_items creation because the table already exists.';
  END IF;
END;
$$;

-- Foreign key to tenants
DO $$
DECLARE
  tenant_column TEXT;
BEGIN
  SELECT column_name
  INTO tenant_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'backlog_items'
    AND column_name IN ('tenant_id', 'tenantId')
  ORDER BY CASE column_name WHEN 'tenant_id' THEN 1 ELSE 2 END
  LIMIT 1;

  IF tenant_column IS NULL THEN
    RAISE NOTICE 'Skipping backlog_items tenant foreign key because tenant column not found.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'backlog_items_tenant_fkey'
      AND table_schema = 'public'
      AND table_name = 'backlog_items'
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.backlog_items ADD CONSTRAINT backlog_items_tenant_fkey FOREIGN KEY (%I) REFERENCES public.tenants(id) ON DELETE CASCADE',
      tenant_column
    );
  ELSE
    RAISE NOTICE 'Skipping backlog_items tenant foreign key because it already exists.';
  END IF;
END;
$$;

-- Indexes
DO $$
DECLARE
  tenant_column TEXT;
BEGIN
  SELECT column_name
  INTO tenant_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'backlog_items'
    AND column_name IN ('tenant_id', 'tenantId')
  ORDER BY CASE column_name WHEN 'tenant_id' THEN 1 ELSE 2 END
  LIMIT 1;

  IF tenant_column IS NULL THEN
    RAISE NOTICE 'Skipping backlog_items_tenant_idx because tenant column not found.';
  ELSE
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS backlog_items_tenant_idx ON public.backlog_items (%I)',
      tenant_column
    );
  END IF;
END;
$$;
