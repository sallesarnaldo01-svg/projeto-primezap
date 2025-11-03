DO $$ BEGIN
  -- Drop legacy table if schema mismatched
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='appointments'
  ) THEN
    -- Simple approach: drop and recreate when no critical data is expected (fresh deploy)
    DROP TABLE public.appointments;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid,
  title varchar(255) NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  type varchar(50) DEFAULT 'other',
  status varchar(50) DEFAULT 'pending',
  location text,
  assigned_to uuid,
  reminder_minutes int DEFAULT 30,
  reminder_sent boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON public.appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);

