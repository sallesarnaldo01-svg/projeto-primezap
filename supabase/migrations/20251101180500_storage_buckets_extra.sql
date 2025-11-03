-- Create additional buckets expected by the app
create schema if not exists storage;

insert into storage.buckets (id, name, public)
values ('knowledge-docs','knowledge-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images','product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('profile-avatars','profile-avatars', true)
on conflict (id) do nothing;

-- Public read policies for public buckets
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public_read_product_images'
  ) then
    create policy public_read_product_images on storage.objects
      for select using (bucket_id = 'product-images');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public_read_profile_avatars'
  ) then
    create policy public_read_profile_avatars on storage.objects
      for select using (bucket_id = 'profile-avatars');
  end if;
end $$;

