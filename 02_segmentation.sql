-- Tables for segmenting contacts and leads via lists and tags

-- contact_lists hold named lists of contacts/leads per tenant
CREATE TABLE IF NOT EXISTS public.contact_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- members of each list can reference contacts or leads
CREATE TABLE IF NOT EXISTS public.contact_list_members (
  list_id     UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id  UUID,
  lead_id     UUID,
  added_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (list_id, contact_id, lead_id)
);

-- tags for classification
CREATE TABLE IF NOT EXISTS public.tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL UNIQUE
);

-- relationships between tags and entities
CREATE TABLE IF NOT EXISTS public.tag_links (
  tag_id      UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  contact_id  UUID,
  lead_id     UUID,
  deal_id     UUID,
  PRIMARY KEY (tag_id, contact_id, lead_id, deal_id)
);