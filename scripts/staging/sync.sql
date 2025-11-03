-- Idempotent schema sync to align DB with prisma/schema.prisma for core modules.
-- Run on staging first; then production after backup.

-- users (ensure columns exist)
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- tag categories and tags extras
CREATE TABLE IF NOT EXISTS public.tag_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4A90E2',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE IF EXISTS public.tags
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tags_category_id ON public.tags(category_id);
ALTER TABLE IF EXISTS public.tags
  DROP CONSTRAINT IF EXISTS tags_category_id_fkey;
ALTER TABLE IF EXISTS public.tags
  ADD CONSTRAINT tags_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tag_categories(id) ON DELETE SET NULL;

-- whatsapp_connections (align with current schema)
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  integration_id uuid null,
  name text null,
  phone text null,
  qr_code text null,
  status varchar(50) null default 'CONNECTING',
  device text null,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_integration_id ON public.whatsapp_connections(integration_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user_id ON public.whatsapp_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status ON public.whatsapp_connections(status);

-- contact_activities (dashboard/recent-activity)
CREATE TABLE IF NOT EXISTS public.contact_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text,
  description text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- tickets (matches Prisma model)
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text not null,
  description text not null,
  status text default 'OPEN',
  priority text default 'MEDIUM',
  category text,
  resolution text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_id uuid not null REFERENCES public.users(id) ON DELETE NO ACTION,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  due_date timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_time_hours double precision,
  tags text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON public.tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to_id);

-- RLS adjustments for conversations/messages by tenant
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'tenant_select_conversations')
  THEN
    CREATE POLICY tenant_select_conversations ON public.conversations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.users u_cur WHERE u_cur.id = auth.uid() AND u_cur.tenant_id = conversations.tenant_id));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'tenant_select_messages')
  THEN
    CREATE POLICY tenant_select_messages ON public.messages FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.conversations c JOIN public.users u_cur ON u_cur.id = auth.uid()
      WHERE c.id = messages.conversation_id AND u_cur.tenant_id = c.tenant_id));
  END IF;
END $$;

