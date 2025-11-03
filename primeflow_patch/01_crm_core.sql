-- Núcleo CRM: leads, deals, atividades e agenda (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  contact_id        uuid,
  name              text,
  email             text,
  phone             text,
  source            text,
  status            text,
  stage             text,
  score             numeric,
  owner_user_id     uuid,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Histórico de status
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text,
  changed_by  uuid,
  changed_at  timestamptz DEFAULT now()
);

-- Timeline do lead
CREATE TABLE IF NOT EXISTS public.lead_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id   uuid,
  role        text,       -- 'user' | 'agent' | 'system'
  content     text,
  created_at  timestamptz DEFAULT now()
);

-- Deals
CREATE TABLE IF NOT EXISTS public.deals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title         text NOT NULL,
  amount        numeric,
  stage         text,
  owner_user_id uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Atividades do Deal
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  kind        text,       -- 'note' | 'stage_change' | 'task' | etc.
  payload     jsonb,
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Agenda
CREATE TABLE IF NOT EXISTS public.schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  lead_id     uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title       text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  status      text DEFAULT 'scheduled',
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_leads_tenant     ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant     ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON public.schedules(tenant_id);
