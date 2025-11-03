-- Ensure RLS enabled and basic policies for integrations and broadcasts

create extension if not exists pgcrypto;

-- Minimal shape guards (skip if already exist)
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform varchar(50) not null,
  name varchar(255) not null,
  status varchar(50) default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Align FK with Supabase Auth users table
  constraint integrations_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- RLS for integrations
alter table if exists public.integrations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'integrations' and policyname = 'owner_or_tenant_select_integrations'
  ) then
    create policy owner_or_tenant_select_integrations on public.integrations
      for select
      using (
        exists (
          select 1
          from auth.users u_cur
          where u_cur.id = auth.uid() and coalesce(u_cur.raw_user_meta_data->>'tenantId','') = (
            select coalesce(u_owner.raw_user_meta_data->>'tenantId','') from auth.users u_owner where u_owner.id = integrations.user_id
          )
        )
      );
  end if;
end $$;

-- RLS for broadcasts (supports current schema with user_id)
alter table if exists public.broadcasts enable row level security;

do $blk$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'broadcasts' and policyname = 'tenant_select_broadcasts'
  ) then
    if exists (
      select 1 from information_schema.columns where table_schema='public' and table_name='broadcasts' and column_name='user_id'
    ) then
      execute $policy$
        create policy tenant_select_broadcasts on public.broadcasts
        for select
        using (
          exists (
            select 1
            from auth.users u_cur
            join auth.users u_owner on u_owner.id = broadcasts.user_id
            where u_cur.id = auth.uid()
              and coalesce(u_cur.raw_user_meta_data->>'tenantId','') = coalesce(u_owner.raw_user_meta_data->>'tenantId','')
          )
        )
      $policy$;
    elsif exists (
      select 1 from information_schema.columns where table_schema='public' and table_name='broadcasts' and column_name='tenant_id'
    ) then
      execute $policy$
        create policy tenant_select_broadcasts on public.broadcasts
        for select
        using (
          exists (
            select 1 from auth.users u_cur where u_cur.id = auth.uid() and (u_cur.raw_user_meta_data->>'tenantId')::text = broadcasts.tenant_id::text
          )
        )
      $policy$;
    end if;
  end if;
end
$blk$ language plpgsql;
