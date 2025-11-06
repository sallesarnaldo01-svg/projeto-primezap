-- Migration: Add missing CRM tables for PrimeZap
-- Data: 03/11/2025
-- Aplicar via Supabase SQL Editor

-- =============================================================================
-- TABELA: leads
-- Descrição: Tabela principal de leads do CRM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  contact_id        UUID,
  name              TEXT,
  email             TEXT,
  phone             TEXT,
  source            TEXT,
  status            TEXT,
  stage             TEXT,
  score             NUMERIC(10, 2),
  owner_user_id     UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_leads_tenant FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_leads_contact FOREIGN KEY (contact_id) 
    REFERENCES public.contacts(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_owner FOREIGN KEY (owner_user_id) 
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON public.leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON public.leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);

-- Comentários
COMMENT ON TABLE public.leads IS 'Tabela de leads do CRM';
COMMENT ON COLUMN public.leads.score IS 'Score de qualificação do lead (0-100)';

-- =============================================================================
-- TABELA: lead_status_history
-- Descrição: Histórico de mudanças de status dos leads
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL,
  old_status  TEXT,
  new_status  TEXT,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_lead_status_history_lead FOREIGN KEY (lead_id) 
    REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_status_history_user FOREIGN KEY (changed_by) 
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON public.lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON public.lead_status_history(changed_at DESC);

-- Comentários
COMMENT ON TABLE public.lead_status_history IS 'Histórico de mudanças de status dos leads';

-- =============================================================================
-- TABELA: lead_messages
-- Descrição: Mensagens e notas associadas aos leads
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lead_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL,
  author_id   UUID,
  role        TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_lead_messages_lead FOREIGN KEY (lead_id) 
    REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_messages_author FOREIGN KEY (author_id) 
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead ON public.lead_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_messages_created_at ON public.lead_messages(created_at DESC);

-- Comentários
COMMENT ON TABLE public.lead_messages IS 'Mensagens e notas internas dos leads';

-- =============================================================================
-- TABELA: schedules
-- Descrição: Agendamentos de visitas e callbacks
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  lead_id     UUID,
  title       TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ,
  status      TEXT DEFAULT 'scheduled',
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_schedules_tenant FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedules_lead FOREIGN KEY (lead_id) 
    REFERENCES public.leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_schedules_creator FOREIGN KEY (created_by) 
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON public.schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_lead ON public.schedules(lead_id);
CREATE INDEX IF NOT EXISTS idx_schedules_starts_at ON public.schedules(starts_at);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON public.schedules(status);

-- Comentários
COMMENT ON TABLE public.schedules IS 'Agendamentos de visitas e callbacks';

-- =============================================================================
-- TABELA: tag_links
-- Descrição: Links flexíveis de tags para contacts, leads e deals
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tag_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      UUID NOT NULL,
  contact_id  UUID,
  lead_id     UUID,
  deal_id     UUID,

  -- Foreign keys
  CONSTRAINT fk_tag_links_tag FOREIGN KEY (tag_id) 
    REFERENCES public.tags(id) ON DELETE CASCADE,
  CONSTRAINT fk_tag_links_contact FOREIGN KEY (contact_id) 
    REFERENCES public.contacts(id) ON DELETE CASCADE,
  CONSTRAINT fk_tag_links_lead FOREIGN KEY (lead_id) 
    REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_tag_links_deal FOREIGN KEY (deal_id) 
    REFERENCES public.deals(id) ON DELETE CASCADE,
    
  -- Constraint: pelo menos um ID deve estar presente
  CONSTRAINT chk_tag_links_at_least_one CHECK (
    contact_id IS NOT NULL OR lead_id IS NOT NULL OR deal_id IS NOT NULL
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tag_links_tag ON public.tag_links(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_contact ON public.tag_links(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tag_links_lead ON public.tag_links(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tag_links_deal ON public.tag_links(deal_id) WHERE deal_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE public.tag_links IS 'Sistema flexível de tags para contacts, leads e deals';

-- =============================================================================
-- TRIGGERS: Updated_at automático
-- =============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para leads
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_links ENABLE ROW LEVEL SECURITY;

-- Policies para leads (usuários só veem leads do seu tenant)
CREATE POLICY "Users can view leads from their tenant"
  ON public.leads FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert leads in their tenant"
  ON public.leads FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update leads in their tenant"
  ON public.leads FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete leads in their tenant"
  ON public.leads FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid()
    )
  );

-- Policies para lead_status_history
CREATE POLICY "Users can view lead history from their tenant"
  ON public.lead_status_history FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert lead history in their tenant"
  ON public.lead_status_history FOR INSERT
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Policies para lead_messages
CREATE POLICY "Users can view lead messages from their tenant"
  ON public.lead_messages FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert lead messages in their tenant"
  ON public.lead_messages FOR INSERT
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Policies para schedules
CREATE POLICY "Users can view schedules from their tenant"
  ON public.schedules FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert schedules in their tenant"
  ON public.schedules FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update schedules in their tenant"
  ON public.schedules FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete schedules in their tenant"
  ON public.schedules FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policies para tag_links (herda permissões das entidades linkadas)
CREATE POLICY "Users can view tag links from their tenant"
  ON public.tag_links FOR SELECT
  USING (
    (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())))
    OR (lead_id IN (SELECT id FROM public.leads WHERE tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())))
    OR (deal_id IN (SELECT id FROM public.deals WHERE tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())))
  );

CREATE POLICY "Users can insert tag links in their tenant"
  ON public.tag_links FOR INSERT
  WITH CHECK (
    (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())))
    OR (lead_id IN (SELECT id FROM public.leads WHERE tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())))
    OR (deal_id IN (SELECT id FROM public.deals WHERE tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())))
  );

-- =============================================================================
-- GRANTS: Permissões para authenticated users
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT ON public.lead_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.tag_links TO authenticated;

-- =============================================================================
-- VERIFICAÇÃO: Confirmar que as tabelas foram criadas
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration concluída com sucesso!';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  - public.leads';
  RAISE NOTICE '  - public.lead_status_history';
  RAISE NOTICE '  - public.lead_messages';
  RAISE NOTICE '  - public.schedules';
  RAISE NOTICE '  - public.tag_links';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Atualizar schema.prisma com os novos modelos';
  RAISE NOTICE '  2. Executar: pnpm exec prisma db pull';
  RAISE NOTICE '  3. Executar: pnpm exec prisma generate';
END $$;
