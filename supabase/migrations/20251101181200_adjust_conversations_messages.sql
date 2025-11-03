-- Adjust conversations/messages schema for app compatibility

-- Conversations: add contact/integration/tenant/assignee
alter table if exists public.conversations
  add column if not exists contact_id uuid,
  add column if not exists integration_id uuid,
  add column if not exists tenant_id text,
  add column if not exists assigned_to_id uuid;

do $blk$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='contacts') then
    begin
      alter table public.conversations
        add constraint conversations_contact_id_fkey foreign key (contact_id) references public.contacts(id) on delete set null;
    exception when duplicate_object then
      -- constraint already exists; ignore
      null;
    end;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='integrations') then
    begin
      alter table public.conversations
        add constraint conversations_integration_id_fkey foreign key (integration_id) references public.integrations(id) on delete set null;
    exception when duplicate_object then
      null;
    end;
  end if;
  begin
    alter table public.conversations
      add constraint conversations_assigned_to_id_fkey foreign key (assigned_to_id) references auth.users(id) on delete set null;
  exception when duplicate_object then
    null;
  end;
end
$blk$ language plpgsql;

-- Expand status allowed values if check exists
do $$ begin
  if exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='conversations' and constraint_type='CHECK' and constraint_name='conversations_status_check'
  ) then
    alter table public.conversations drop constraint conversations_status_check;
  end if;
  alter table public.conversations
    add constraint conversations_status_check check (status in ('open','closed','pending','active','archived'));
end $$;

-- Indexes
create index if not exists idx_conversations_contact on public.conversations(contact_id);
create index if not exists idx_conversations_integration on public.conversations(integration_id);
create index if not exists idx_conversations_assigned on public.conversations(assigned_to_id);

-- Messages: optional columns for future use
alter table if exists public.messages
  add column if not exists status text,
  add column if not exists metadata jsonb default '{}'::jsonb;
