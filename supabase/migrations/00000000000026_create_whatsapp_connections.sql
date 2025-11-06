-- Minimal WhatsApp connections table compatible with Prisma models
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  integration_id uuid NULL REFERENCES public.integrations(id) ON DELETE SET NULL ON UPDATE CASCADE,
  name text NULL,
  phone text NULL,
  qr_code text NULL,
  status varchar(50) NULL DEFAULT 'CONNECTING',
  device text NULL,
  connected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_integration_id ON public.whatsapp_connections(integration_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user_id ON public.whatsapp_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status ON public.whatsapp_connections(status);

