-- Core CRM schema for leads, deals, activities and schedules
-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  contact_id        UUID,
  name              TEXT,
  email             TEXT,
  phone             TEXT,
  source            TEXT,
  status            TEXT,
  stage             TEXT,
  score             NUMERIC,
  owner_user_id     UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- history of lead status changes
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ DEFAULT now()
);

-- messages associated with a lead (timeline or internal notes)
CREATE TABLE IF NOT EXISTS public.lead_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id   UUID,
  role        TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- deals table representing business opportunities
CREATE TABLE IF NOT EXISTS public.deals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  amount        NUMERIC,
  stage         TEXT,
  owner_user_id UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- activities tied to a deal (stage change, notes, calls, etc.)
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  kind        TEXT,
  payload     JSONB,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- schedules table for visits or callbacks
CREATE TABLE IF NOT EXISTS public.schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  lead_id     UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title       TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ,
  status      TEXT DEFAULT 'scheduled',
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- indexes to speed up tenant-specific lookups
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON public.schedules(tenant_id);