-- Supabase Storage policies for 'documents' bucket (apply in Supabase project)
-- Create bucket if missing
select storage.create_bucket('documents', public:=false);

-- Allow authenticated users to upload/list their objects
create policy if not exists "Authenticated can read documents"
on storage.objects for select to authenticated
using (bucket_id = 'documents');

create policy if not exists "Authenticated can insert documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents');

create policy if not exists "Authenticated can update own documents"
on storage.objects for update to authenticated
using (bucket_id = 'documents');

create policy if not exists "Authenticated can delete own documents"
on storage.objects for delete to authenticated
using (bucket_id = 'documents');

-- Note: refine with path-based or JWT-claim-based scoping per tenant if needed
