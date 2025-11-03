-- Drop temporary compatibility columns once official schema is applied
-- Safe guards: only drop if columns exist

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='connections' AND column_name='access_token'
  ) THEN
    ALTER TABLE public.connections DROP COLUMN access_token;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='connections' AND column_name='page_id'
  ) THEN
    ALTER TABLE public.connections DROP COLUMN page_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='connections' AND column_name='instagram_account_id'
  ) THEN
    ALTER TABLE public.connections DROP COLUMN instagram_account_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='connections' AND column_name='webhook_verified'
  ) THEN
    ALTER TABLE public.connections DROP COLUMN webhook_verified;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='connections' AND column_name='last_sync_at'
  ) THEN
    ALTER TABLE public.connections DROP COLUMN last_sync_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='password_hash'
  ) THEN
    ALTER TABLE public.users DROP COLUMN password_hash;
  END IF;
END $$;

