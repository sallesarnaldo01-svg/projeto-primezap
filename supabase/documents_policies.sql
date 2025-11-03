-- Supabase Storage: bucket 'documents' travado (acesso só via API/service-role)
-- Este script é idempotente e só deve ser executado em um projeto Supabase (schema 'storage').

-- 1) Cria bucket privado se não existir
select storage.create_bucket('documents', public:=false);

-- 2) Garante RLS habilitado na tabela de objetos
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='storage' and table_name='objects') then
    execute 'alter table storage.objects enable row level security';
  end if;
end $$;

-- 3) Remove políticas permissivas antigas (se existirem)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated can read documents') then
    execute 'drop policy "Authenticated can read documents" on storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated can insert documents') then
    execute 'drop policy "Authenticated can insert documents" on storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated can update own documents') then
    execute 'drop policy "Authenticated can update own documents" on storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated can delete own documents') then
    execute 'drop policy "Authenticated can delete own documents" on storage.objects';
  end if;
end $$;

-- 4) Não criar nenhuma policy para 'anon' ou 'authenticated'.
--    Resultado: somente a service role (API) pode acessar/burlar RLS.
--    Se no futuro desejar abrir por tenant/usuário, criar policies específicas filtrando bucket_id = 'documents' e claims JWT.
