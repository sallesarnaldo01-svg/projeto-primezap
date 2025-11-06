CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  lead_id uuid,
  contact_phone text,
  start_at timestamptz NOT NULL,
  reminder_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS appointments_tenant_idx ON public.appointments(tenant_id)';
  ELSE
    RAISE NOTICE 'Skipping index appointments_tenant_idx because column appointments.tenant_id is missing.';
  END IF;
END;
$$;
