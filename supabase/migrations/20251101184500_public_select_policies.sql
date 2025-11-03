-- Open read-only (SELECT) access for anon role on specific tables used by the frontend via Supabase REST
-- Note: This exposes data publicly. Use only if your UX requires reading without Supabase Auth login.

-- CONTACTS
alter table if exists public.contacts enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='anon_select_contacts'
  ) then
    create policy anon_select_contacts on public.contacts for select to anon using (true);
  end if;
end $$;

-- CONTACT LISTS
alter table if exists public.contact_lists enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='contact_lists' and policyname='anon_select_contact_lists'
  ) then
    create policy anon_select_contact_lists on public.contact_lists for select to anon using (true);
  end if;
end $$;

-- CAMPAIGNS
alter table if exists public.campaigns enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='anon_select_campaigns'
  ) then
    create policy anon_select_campaigns on public.campaigns for select to anon using (true);
  end if;
end $$;

