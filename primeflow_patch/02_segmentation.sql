-- Segmentação: listas e tags (idempotente)

CREATE TABLE IF NOT EXISTS public.contact_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_list_members (
  list_id     uuid NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id  uuid,
  lead_id     uuid,
  added_at    timestamptz DEFAULT now(),
  PRIMARY KEY (list_id, contact_id, lead_id)
);

CREATE TABLE IF NOT EXISTS public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.tag_links (
  tag_id      uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  contact_id  uuid,
  lead_id     uuid,
  deal_id     uuid,
  PRIMARY KEY (tag_id, contact_id, lead_id, deal_id)
);
