-- Enable RLS and set baseline policies for conversations and messages
-- Goal: Allow users within the same tenant to read conversation/message rows

-- Conversations
alter table if exists public.conversations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'tenant_select_conversations'
  ) then
    create policy tenant_select_conversations on public.conversations
      for select
      using (
        exists (
          select 1
          from auth.users u_owner
          join auth.users u_cur on u_cur.id = auth.uid()
          where u_owner.id = conversations.user_id
            and coalesce(u_owner.raw_user_meta_data->>'tenantId','') = coalesce(u_cur.raw_user_meta_data->>'tenantId','')
        )
      );
  end if;
end $$;

-- Messages
alter table if exists public.messages enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'tenant_select_messages'
  ) then
    create policy tenant_select_messages on public.messages
      for select
      using (
        exists (
          select 1
          from public.conversations c
          join auth.users u_owner on u_owner.id = c.user_id
          join auth.users u_cur on u_cur.id = auth.uid()
          where c.id = messages.conversation_id
            and coalesce(u_owner.raw_user_meta_data->>'tenantId','') = coalesce(u_cur.raw_user_meta_data->>'tenantId','')
        )
      );
  end if;
end $$;

-- Note: write policies intentionally omitted; writes should go via backend API.

