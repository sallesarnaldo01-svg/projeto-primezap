CREATE TABLE IF NOT EXISTS public.deal_interactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  type text NOT NULL,
  content text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_interactions_tenant_idx ON public.deal_interactions(tenant_id);
