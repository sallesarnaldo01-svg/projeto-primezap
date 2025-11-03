-- Minimal tables to support frontend Supabase queries for contact_lists and campaigns
create extension if not exists pgcrypto;

-- CONTACT LISTS
create table if not exists public.contact_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  name text not null,
  description text,
  type text default 'manual',
  filter_criteria jsonb default '{}'::jsonb,
  contact_count integer default 0,
  created_by uuid,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contact_lists_tenant on public.contact_lists(tenant_id);

alter table public.contact_lists enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_lists' and policyname='tenant_select_contact_lists') then
    create policy tenant_select_contact_lists on public.contact_lists for select using (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_lists' and policyname='tenant_manage_contact_lists') then
    create policy tenant_manage_contact_lists on public.contact_lists for all using (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    ) with check (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
end $$;

-- CAMPAIGNS
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  user_id uuid not null,
  integration_id uuid,
  name text not null,
  description text,
  status text default 'draft' check (status in ('draft','scheduled','running','paused','completed','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  delay_between_messages integer default 5,
  simulate_typing boolean default true,
  simulate_recording boolean default true,
  total_contacts integer default 0,
  sent_count integer default 0,
  delivered_count integer default 0,
  failed_count integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_campaigns_tenant on public.campaigns(tenant_id);

alter table public.campaigns enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='tenant_select_campaigns') then
    create policy tenant_select_campaigns on public.campaigns for select using (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='tenant_manage_campaigns') then
    create policy tenant_manage_campaigns on public.campaigns for all using (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    ) with check (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
end $$;

