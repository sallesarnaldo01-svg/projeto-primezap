-- Migration: Add missing CRM tables (leads, lead_status_history, lead_messages, schedules, tag_links)
-- Based on patches 01_crm_core.sql and 02_segmentation.sql

-- Create leads table (from 01_crm_core.sql)
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

-- History of lead status changes
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ DEFAULT now()
);

-- Messages associated with a lead (timeline or internal notes)
CREATE TABLE IF NOT EXISTS public.lead_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id   UUID,
  role        TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Schedules table for visits or callbacks
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

-- Tag links for classification (from 02_segmentation.sql)
CREATE TABLE IF NOT EXISTS public.tag_links (
  tag_id      UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  contact_id  UUID,
  lead_id     UUID,
  deal_id     UUID,
  PRIMARY KEY (tag_id, contact_id, lead_id, deal_id)
);

-- Indexes to speed up tenant-specific lookups
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON public.schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON public.lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead ON public.lead_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_tag ON public.tag_links(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_contact ON public.tag_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_lead ON public.tag_links(lead_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_deal ON public.tag_links(deal_id);
