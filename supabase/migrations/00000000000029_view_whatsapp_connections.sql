-- Provide compatibility view for legacy code querying public.whatsapp_connections
-- The worker's scheduler expects table whatsapp_connections with columns id, tenant_id, status, updated_at
-- Create a view mapping to public.connections filtered by type 'WHATSAPP'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_connections'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='whatsapp_connections'
  ) THEN
    CREATE VIEW public.whatsapp_connections AS
      SELECT id, tenant_id, status, updated_at
      FROM public.connections
      WHERE type = 'WHATSAPP';
  END IF;
END$$;

