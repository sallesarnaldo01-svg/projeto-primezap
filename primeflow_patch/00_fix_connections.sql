-- Tabela connections mínima para a API funcionar (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.connections (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid,
  provider                 text,        -- ex.: whatsapp|facebook|instagram
  channel                  text,        -- ex.: inbox|bot etc (se usado)
  phone                    text,        -- se aplicável
  access_token             text,
  page_id                  text,
  instagram_account_id     text,
  webhook_verified         boolean DEFAULT false,
  last_sync_at             timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- Garante colunas exigidas pela API (idempotente)
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS access_token         text,
  ADD COLUMN IF NOT EXISTS page_id              text,
  ADD COLUMN IF NOT EXISTS instagram_account_id text,
  ADD COLUMN IF NOT EXISTS webhook_verified     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at         timestamptz;

CREATE INDEX IF NOT EXISTS idx_connections_provider
  ON public.connections (provider);

CREATE INDEX IF NOT EXISTS idx_connections_page_id
  ON public.connections (page_id);

CREATE INDEX IF NOT EXISTS idx_connections_instagram_account_id
  ON public.connections (instagram_account_id);
