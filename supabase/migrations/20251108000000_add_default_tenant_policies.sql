-- Auto-create basic tenant-scoped RLS policies for tables that have a tenant_id column
-- but no custom policies defined yet. This allows authenticated users to work with data
-- from their own tenant while keeping service_role unrestricted for backend jobs.

DO $policy$
DECLARE
  rec record;
  tenant_condition TEXT;
BEGIN
  FOR rec IN
    SELECT t.table_name,
           MAX(CASE WHEN c.data_type = 'uuid' THEN 'uuid' ELSE 'other' END) AS tenant_type
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema
     AND c.table_name = t.table_name
    WHERE t.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = t.table_name
      )
    GROUP BY t.table_name
  LOOP
    tenant_condition :=
      CASE
        WHEN rec.tenant_type = 'uuid'
          THEN 'tenant_id = public.get_user_tenant_id(auth.uid())'
        ELSE
          'tenant_id = public.get_user_tenant_id(auth.uid())::text'
      END;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rec.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
      rec.table_name || '_tenant_select', rec.table_name, tenant_condition
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      rec.table_name || '_tenant_write', rec.table_name, tenant_condition, tenant_condition
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE)',
      rec.table_name || '_service_all', rec.table_name
    );
  END LOOP;
END;
$policy$;
