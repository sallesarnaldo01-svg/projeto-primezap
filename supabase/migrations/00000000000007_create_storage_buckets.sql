-- ============================================
-- MIGRATION 007: Supabase Storage Buckets
-- ============================================

-- 1. CREATE OR UPSERT STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('knowledge-docs', 'knowledge-docs', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  ('product-images', 'product-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('profile-avatars', 'profile-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('message-media', 'message-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- Helper to drop/create a policy with graceful fallback
DO $$
DECLARE
  policy_name TEXT;
  policy_sql TEXT;
BEGIN
  FOR policy_name, policy_sql IN
    SELECT * FROM (
      VALUES
        ('Authenticated users can upload knowledge docs', 'CREATE POLICY "Authenticated users can upload knowledge docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''knowledge-docs'' AND auth.uid() IS NOT NULL)'),
        ('Users can view own tenant knowledge docs', 'CREATE POLICY "Users can view own tenant knowledge docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''knowledge-docs'' AND auth.uid() IS NOT NULL)'),
        ('Users can delete own knowledge docs', 'CREATE POLICY "Users can delete own knowledge docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''knowledge-docs'' AND auth.uid() IS NOT NULL)'),
        ('Authenticated users can upload product images', 'CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''product-images'' AND auth.uid() IS NOT NULL)'),
        ('Anyone can view product images', 'CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT TO public USING (bucket_id = ''product-images'')'),
        ('Admins can delete product images', 'CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''product-images'' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ''admin''))'),
        ('Users can upload own avatar', 'CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''profile-avatars'' AND (public.storage_foldername(name))[1] = auth.uid()::text)'),
        ('Anyone can view avatars', 'CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = ''profile-avatars'')'),
        ('Users can update own avatar', 'CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''profile-avatars'' AND (public.storage_foldername(name))[1] = auth.uid()::text)'),
        ('Users can delete own avatar', 'CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''profile-avatars'' AND (public.storage_foldername(name))[1] = auth.uid()::text)'),
        ('Authenticated users can upload message media', 'CREATE POLICY "Authenticated users can upload message media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''message-media'' AND auth.uid() IS NOT NULL)'),
        ('Users can view message media', 'CREATE POLICY "Users can view message media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''message-media'' AND auth.uid() IS NOT NULL)')
    ) AS policies(name, sql_text)
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "%s" ON storage.objects', policy_name);
      EXECUTE policy_sql;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping policy % due to insufficient privileges.', policy_name;
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipping policy % because storage.objects is unavailable.', policy_name;
      WHEN dependent_objects_still_exist THEN
        RAISE NOTICE 'Skipping policy % because dependent objects prevent changes.', policy_name;
    END;
  END LOOP;
END;
$$;

-- ============================================
-- HELPER FUNCTION: Get signed URL for private files
-- ============================================

CREATE OR REPLACE FUNCTION public.get_signed_url(
  bucket_name TEXT,
  file_path TEXT,
  expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN format('https://%s/storage/v1/object/sign/%s/%s?token=...', 
    current_setting('app.supabase_url', true),
    bucket_name,
    file_path
  );
END;
$$;

-- ============================================
-- INDEXES for storage
-- ============================================

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON storage.objects(bucket_id)';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping index idx_objects_bucket_id due to insufficient privileges.';
    WHEN undefined_table THEN
      RAISE NOTICE 'Skipping index idx_objects_bucket_id because storage.objects is unavailable.';
  END;

  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_objects_name ON storage.objects(name)';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping index idx_objects_name due to insufficient privileges.';
    WHEN undefined_table THEN
      RAISE NOTICE 'Skipping index idx_objects_name because storage.objects is unavailable.';
  END;
END;
$$;
