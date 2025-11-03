-- Add core tables missing for Supabase usage: contacts, ai_usage, knowledge_items
create extension if not exists pgcrypto;

-- CONTACTS
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  avatar_url text,
  custom_fields jsonb default '{}'::jsonb,
  lifecycle_stage text default 'lead' check (lifecycle_stage in ('lead','opportunity','customer','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_user on public.contacts(user_id);
create index if not exists idx_contacts_phone on public.contacts(phone);
create index if not exists idx_contacts_email on public.contacts(email);

alter table public.contacts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='owner_select_contacts'
  ) then
    create policy owner_select_contacts on public.contacts for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='owner_modify_contacts'
  ) then
    create policy owner_modify_contacts on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- AI USAGE
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tenant_id text,
  function_name text not null,
  tokens_used integer default 0,
  cost_brl numeric(10,6) default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user on public.ai_usage(user_id, created_at desc);
create index if not exists idx_ai_usage_tenant on public.ai_usage(tenant_id, created_at desc);

alter table public.ai_usage enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ai_usage' and policyname='owner_or_tenant_select_ai_usage'
  ) then
    create policy owner_or_tenant_select_ai_usage on public.ai_usage for select using (
      (user_id is not null and auth.uid() = user_id)
      or coalesce(tenant_id,'') = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ai_usage' and policyname='insert_any_ai_usage'
  ) then
    create policy insert_any_ai_usage on public.ai_usage for insert with check (true);
  end if;
end $$;

-- KNOWLEDGE ITEMS (snippets/docs)
create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  type text not null check (type in ('snippet','doc')),
  title text,
  content text,
  tags text[] default array[]::text[],
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_items_tenant on public.knowledge_items(tenant_id);
create index if not exists idx_knowledge_items_type on public.knowledge_items(type);
create index if not exists idx_knowledge_items_tags on public.knowledge_items using gin(tags);

alter table public.knowledge_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='knowledge_items' and policyname='tenant_select_knowledge_items'
  ) then
    create policy tenant_select_knowledge_items on public.knowledge_items for select using (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='knowledge_items' and policyname='tenant_modify_knowledge_items'
  ) then
    create policy tenant_modify_knowledge_items on public.knowledge_items for all using (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    ) with check (
      tenant_id = coalesce((auth.jwt() ->> 'tenantId'),'')
    );
  end if;
end $$;

-- updated_at trigger for contacts and knowledge_items
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger update_contacts_updated_at
  before update on public.contacts
  for each row execute function public.update_updated_at_column();

create trigger update_knowledge_items_updated_at
  before update on public.knowledge_items
  for each row execute function public.update_updated_at_column();

-- Enable realtime on contacts (optional)
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    execute 'alter publication supabase_realtime add table public.contacts';
  end if;
end $$;

