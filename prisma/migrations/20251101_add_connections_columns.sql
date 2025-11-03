-- Add missing columns to public.connections to unblock /api/integrations
-- Idempotent: uses IF NOT EXISTS and default values

ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS page_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_account_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Optional indexes to speed up lookups by page/instagram ids
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_connections_page_id' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_connections_page_id ON public.connections (page_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_connections_instagram_account_id' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_connections_instagram_account_id ON public.connections (instagram_account_id);
  END IF;
END$$;

