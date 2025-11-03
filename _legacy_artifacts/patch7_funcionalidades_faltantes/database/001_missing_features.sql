-- ============================================================
-- Migration: Missing Features
-- Primeflow-Hub - Patch 7
-- Implementa todas as tabelas faltantes identificadas na análise
-- ============================================================

-- ============================================================
-- 1. DEALS (CRM)
-- ============================================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  value DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  stage VARCHAR(50) NOT NULL DEFAULT 'lead', -- lead, contact, proposal, negotiation, won, lost
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  actual_close_date DATE,
  lost_reason TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(100), -- website, referral, cold_call, etc
  tags TEXT[], -- Array de tags
  custom_fields JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0, -- Para ordenação no kanban
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deals_tenant ON deals(tenant_id);
CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_assigned ON deals(assigned_to);
CREATE INDEX idx_deals_created ON deals(created_at DESC);

-- ============================================================
-- 2. TAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color
  description TEXT,
  category VARCHAR(50), -- product, contact, conversation, etc
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name, category)
);

CREATE INDEX idx_tags_tenant ON tags(tenant_id);
CREATE INDEX idx_tags_category ON tags(category);

-- ============================================================
-- 3. COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  tax_id VARCHAR(50), -- CNPJ/CPF
  industry VARCHAR(100),
  size VARCHAR(50), -- small, medium, large, enterprise
  website VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address JSONB DEFAULT '{}', -- {street, city, state, zip, country}
  logo_url TEXT,
  description TEXT,
  custom_fields JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_tenant ON companies(tenant_id);
CREATE INDEX idx_companies_tax_id ON companies(tax_id);

-- Relacionamento Contatos <-> Empresas
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- ============================================================
-- 4. FINANCIAL (Faturas e Transações)
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, overdue, cancelled
  payment_method VARCHAR(50), -- credit_card, bank_transfer, pix, etc
  notes TEXT,
  items JSONB DEFAULT '[]', -- Array de items {description, quantity, price}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_contact ON invoices(contact_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- income, expense
  category VARCHAR(100),
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',
  date DATE NOT NULL,
  description TEXT,
  payment_method VARCHAR(50),
  reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date ON transactions(date DESC);

-- ============================================================
-- 5. SCRUM (Sprints e Items)
-- ============================================================

CREATE TABLE IF NOT EXISTS sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'planning', -- planning, active, completed, cancelled
  velocity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sprints_tenant ON sprints(tenant_id);
CREATE INDEX idx_sprints_status ON sprints(status);

CREATE TABLE IF NOT EXISTS sprint_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES sprints(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'task', -- task, bug, feature, improvement
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
  status VARCHAR(50) DEFAULT 'todo', -- todo, in_progress, review, done
  story_points INTEGER DEFAULT 0,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sprint_items_tenant ON sprint_items(tenant_id);
CREATE INDEX idx_sprint_items_sprint ON sprint_items(sprint_id);
CREATE INDEX idx_sprint_items_status ON sprint_items(status);
CREATE INDEX idx_sprint_items_assigned ON sprint_items(assigned_to);

-- ============================================================
-- 6. CONTACT LISTS (Listas de Contatos)
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'manual', -- manual, dynamic, imported
  filter_criteria JSONB DEFAULT '{}', -- Para listas dinâmicas
  contact_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_lists_tenant ON contact_lists(tenant_id);

CREATE TABLE IF NOT EXISTS contact_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, contact_id)
);

CREATE INDEX idx_contact_list_members_list ON contact_list_members(list_id);
CREATE INDEX idx_contact_list_members_contact ON contact_list_members(contact_id);

-- ============================================================
-- 7. FACEBOOK CAMPAIGNS
-- ============================================================

CREATE TABLE IF NOT EXISTS facebook_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facebook_campaign_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  objective VARCHAR(100), -- LEAD_GENERATION, CONVERSIONS, etc
  status VARCHAR(50) DEFAULT 'active', -- active, paused, deleted
  budget DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'BRL',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  metrics JSONB DEFAULT '{}', -- {impressions, clicks, conversions, cost_per_lead}
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_facebook_campaigns_tenant ON facebook_campaigns(tenant_id);
CREATE INDEX idx_facebook_campaigns_fb_id ON facebook_campaigns(facebook_campaign_id);

-- ============================================================
-- 8. DEAL ACTIVITIES (Histórico de atividades nos deals)
-- ============================================================

CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- note, call, email, meeting, stage_change
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX idx_deal_activities_created ON deal_activities(created_at DESC);

-- ============================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sprint_items_updated_at BEFORE UPDATE ON sprint_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON contact_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facebook_campaigns_updated_at BEFORE UPDATE ON facebook_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE deals IS 'Deals/Negócios do CRM';
COMMENT ON TABLE tags IS 'Tags para categorização de recursos';
COMMENT ON TABLE companies IS 'Empresas/Organizações';
COMMENT ON TABLE invoices IS 'Faturas e cobranças';
COMMENT ON TABLE transactions IS 'Transações financeiras';
COMMENT ON TABLE sprints IS 'Sprints do Scrum';
COMMENT ON TABLE sprint_items IS 'Items/Tarefas das sprints';
COMMENT ON TABLE contact_lists IS 'Listas de contatos';
COMMENT ON TABLE contact_list_members IS 'Membros das listas de contatos';
COMMENT ON TABLE facebook_campaigns IS 'Campanhas do Facebook Ads';
COMMENT ON TABLE deal_activities IS 'Histórico de atividades dos deals';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 001_missing_features.sql aplicada com sucesso!';
  RAISE NOTICE '   - Tabela deals criada';
  RAISE NOTICE '   - Tabela tags criada';
  RAISE NOTICE '   - Tabela companies criada';
  RAISE NOTICE '   - Tabelas invoices e transactions criadas';
  RAISE NOTICE '   - Tabelas sprints e sprint_items criadas';
  RAISE NOTICE '   - Tabelas contact_lists e contact_list_members criadas';
  RAISE NOTICE '   - Tabela facebook_campaigns criada';
  RAISE NOTICE '   - Tabela deal_activities criada';
END $$;

