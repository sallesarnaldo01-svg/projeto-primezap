-- Lock down 'documents' bucket so only service role can access via API
-- Remove permissive policies for authenticated users on storage.objects for documents bucket

do $blk$
begin
  if exists (select 1 from information_schema.tables where table_schema='storage' and table_name='objects') then
    begin
      execute 'alter table storage.objects enable row level security';
    exception when insufficient_privilege then
      -- ignore if not owner
      null;
    end;
  end if;
end
$blk$ language plpgsql;

do $blk$
begin
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_select') then
    begin
      execute 'drop policy "documents_select" on storage.objects';
    exception when insufficient_privilege then null; end;
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_insert') then
    begin
      execute 'drop policy "documents_insert" on storage.objects';
    exception when insufficient_privilege then null; end;
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_update') then
    begin
      execute 'drop policy "documents_update" on storage.objects';
    exception when insufficient_privilege then null; end;
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_delete') then
    begin
      execute 'drop policy "documents_delete" on storage.objects';
    exception when insufficient_privilege then null; end;
  end if;
end
$blk$ language plpgsql;

-- Intentionally not adding new policies: only service role (API key) can bypass RLS
