-- This migration adds missing columns to the connections table.
-- It is idempotent: if the column already exists, nothing will happen.

ALTER TABLE IF EXISTS public.connections
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS page_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_account_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- add indexes for the new columns to speed up lookups
CREATE INDEX IF NOT EXISTS idx_connections_page_id ON public.connections(page_id);
CREATE INDEX IF NOT EXISTS idx_connections_instagram_account_id ON public.connections(instagram_account_id);