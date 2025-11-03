-- Create table: public.whatsapp_connections
-- Purpose: Track WhatsApp connection status/QR for each integration/user
-- Idempotent: uses IF NOT EXISTS where supported

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  integration_id uuid null,
  name text null,
  phone text null,
  qr_code text null,
  status varchar(50) null default 'CONNECTING',
  device text null,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_connections_integration_id_fkey foreign key (integration_id) references public.integrations(id) on delete set null on update cascade,
  -- Note: original FK to public.public_users; align with Supabase Auth users
  constraint whatsapp_connections_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade on update cascade
);

create index if not exists idx_whatsapp_connections_integration_id on public.whatsapp_connections(integration_id);
create index if not exists idx_whatsapp_connections_user_id on public.whatsapp_connections(user_id);
create index if not exists idx_whatsapp_connections_status on public.whatsapp_connections(status);

-- Row Level Security
alter table public.whatsapp_connections enable row level security;

-- Allow owners full access
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_connections' and policyname = 'owner_all'
  ) then
    create policy owner_all on public.whatsapp_connections
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Allow any user in the same tenant (as integration owner) to select rows
-- Uses auth.users raw_user_meta_data->>'tenantId' to infer tenancy
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_connections' and policyname = 'tenant_select'
  ) then
    create policy tenant_select on public.whatsapp_connections
      for select
      using (
        exists (
          select 1
          from public.integrations i
          join auth.users u_int on u_int.id = i.user_id
          join auth.users u_cur on u_cur.id = auth.uid()
          where i.id = whatsapp_connections.integration_id
            and coalesce(u_int.raw_user_meta_data->>'tenantId','') = coalesce(u_cur.raw_user_meta_data->>'tenantId','')
        )
      );
  end if;
end $$;

