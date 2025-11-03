-- Lead actions (kanban) for detailed lead management
CREATE TABLE IF NOT EXISTS public.lead_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | EM_ANDAMENTO | CONCLUIDO
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_actions_tenant_idx ON public.lead_actions(tenant_id);
