-- Create buckets and basic RLS for Supabase Storage
create schema if not exists storage;

-- Buckets
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;

-- Policies: allow read public files in 'media'
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_read_media'
  ) then
    create policy public_read_media on storage.objects
      for select using (bucket_id = 'media');
  end if;
end $$;

-- Tenant-based access for private buckets (knowledge) via JWT tenantId claim
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_read_knowledge'
  ) then
    create policy tenant_read_knowledge on storage.objects
      for select using (
        bucket_id = 'knowledge' and coalesce(objects.metadata->>'tenantId','') = coalesce((auth.jwt() ->> 'tenantId'),'')
      );
  end if;
end $$;
