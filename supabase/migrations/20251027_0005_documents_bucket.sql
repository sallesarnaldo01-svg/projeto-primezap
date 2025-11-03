-- Create 'documents' bucket and apply basic RLS policies for Supabase Storage
-- Idempotent operations.

-- Ensure bucket exists
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Policies: select/insert/update/delete limited to documents bucket
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_select'
  ) then
    create policy "documents_select" on storage.objects for select to authenticated
    using (bucket_id = 'documents');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_insert'
  ) then
    create policy "documents_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'documents');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_update'
  ) then
    create policy "documents_update" on storage.objects for update to authenticated
    using (bucket_id = 'documents');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_delete'
  ) then
    create policy "documents_delete" on storage.objects for delete to authenticated
    using (bucket_id = 'documents');
  end if;
end $$;

-- TODO: Optionally refine with path-based or JWT claims scoping per tenant
