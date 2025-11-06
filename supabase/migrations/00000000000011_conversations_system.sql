-- ============================================================================
-- MIGRATION: Sistema Completo de Conversas e Conexões
-- Versão: 6.0.0
-- Data: 07 de Outubro de 2025
-- ============================================================================

-- ============================================================================
-- 1. TABELAS DE INTEGRAÇÕES
-- ============================================================================

-- Tabela de integrações (WhatsApp, Facebook, Instagram)
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('whatsapp', 'facebook', 'instagram')),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
    
    -- Credenciais (criptografadas)
    access_token TEXT,
    refresh_token TEXT,
    phone_number VARCHAR(50),
    phone_number_id VARCHAR(255),
    business_account_id VARCHAR(255),
    page_id VARCHAR(255),
    instagram_account_id VARCHAR(255),
    
    -- Configurações
    webhook_url TEXT,
    webhook_secret TEXT,
    api_version VARCHAR(20) DEFAULT 'v18.0',
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices e constraints
    UNIQUE(user_id, platform, phone_number)
);

-- ============================================================================
-- 2. TABELAS DE CONTATOS
-- ============================================================================

-- Tabela de contatos
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- Informações do contato
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    
    -- Identificadores externos
    whatsapp_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    
    -- Tags e segmentação
    tags TEXT[] DEFAULT '{}',
    labels TEXT[] DEFAULT '{}',
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    
    -- Status
    is_blocked BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_interaction_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 3. TABELAS DE CONVERSAS
-- ============================================================================

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- Status da conversa
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed', 'pending')),
    
    -- Atribuição
    assigned_to UUID,
    assigned_at TIMESTAMP WITH TIME ZONE,
    
    -- Última mensagem
    last_message_content TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_from VARCHAR(50),
    
    -- Contadores
    unread_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. TABELAS DE MENSAGENS
-- ============================================================================

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Conteúdo
    content TEXT,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact')),
    
    -- Remetente
    sender VARCHAR(50) NOT NULL CHECK (sender IN ('user', 'contact', 'system')),
    sender_id UUID,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    
    -- Mídia
    media_url TEXT,
    media_type VARCHAR(100),
    media_size INTEGER,
    thumbnail_url TEXT,
    
    -- Identificadores externos
    external_id VARCHAR(255),
    reply_to_id UUID REFERENCES messages(id),
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 5. TABELAS DE DISPAROS PROGRAMADOS
-- ============================================================================

-- Tabela de campanhas de disparo
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- Informações da campanha
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
    
    -- Agendamento
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Configurações
    delay_between_messages INTEGER DEFAULT 5, -- segundos
    simulate_typing BOOLEAN DEFAULT TRUE,
    simulate_recording BOOLEAN DEFAULT TRUE,
    
    -- Estatísticas
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de mensagens da campanha (template)
CREATE TABLE IF NOT EXISTS public.campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Ordem e conteúdo
    sequence_order INTEGER NOT NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'document')),
    
    -- Mídia
    media_url TEXT,
    media_type VARCHAR(100),
    
    -- Delay
    delay_after INTEGER DEFAULT 5, -- segundos após enviar esta mensagem
    
    -- Simulação
    typing_duration INTEGER, -- segundos de "digitando..."
    recording_duration INTEGER, -- segundos de "gravando áudio..."
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id, sequence_order)
);

-- Tabela de destinatários da campanha
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed')),
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id, contact_id)
);

-- ============================================================================
-- 6. TABELAS DE WEBHOOKS
-- ============================================================================

-- Tabela de eventos de webhook
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- Evento
    event_type VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    
    -- Payload
    payload JSONB NOT NULL,
    headers JSONB,
    
    -- Processamento
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. ÍNDICES
-- ============================================================================

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'integrations'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'user_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_integrations_user_id because column user_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'platform'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_integrations_platform ON public.integrations(platform)';
    ELSE
      RAISE NOTICE 'Skipping idx_integrations_platform because column platform is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'status'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(status)';
    ELSE
      RAISE NOTICE 'Skipping idx_integrations_status because column status is missing.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping integrations indexes because table public.integrations does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contacts'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_contacts_user_id because column user_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'integration_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_integration_id ON public.contacts(integration_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_contacts_integration_id because column integration_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'phone'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone)';
    ELSE
      RAISE NOTICE 'Skipping idx_contacts_phone because column phone is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'whatsapp_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp_id ON public.contacts(whatsapp_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_contacts_whatsapp_id because column whatsapp_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'facebook_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_facebook_id ON public.contacts(facebook_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_contacts_facebook_id because column facebook_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'instagram_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_instagram_id ON public.contacts(instagram_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_contacts_instagram_id because column instagram_id is missing.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping contacts indexes because table public.contacts does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'user_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_conversations_user_id because column user_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'contact_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON public.conversations(contact_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_conversations_contact_id because column contact_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'integration_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_integration_id ON public.conversations(integration_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_conversations_integration_id because column integration_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'status'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status)';
    ELSE
      RAISE NOTICE 'Skipping idx_conversations_status because column status is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'updated_at'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC)';
    ELSE
      RAISE NOTICE 'Skipping idx_conversations_updated_at because column updated_at is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'assigned_to'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations(assigned_to)';
    ELSE
      RAISE NOTICE 'Skipping idx_conversations_assigned_to because column assigned_to is missing.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping conversations indexes because table public.conversations does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_messages_conversation_id because column conversation_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender)';
    ELSE
      RAISE NOTICE 'Skipping idx_messages_sender because column sender is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'status'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status)';
    ELSE
      RAISE NOTICE 'Skipping idx_messages_status because column status is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'created_at'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC)';
    ELSE
      RAISE NOTICE 'Skipping idx_messages_created_at because column created_at is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'external_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_messages_external_id because column external_id is missing.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping messages indexes because table public.messages does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'user_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_campaigns_user_id because column user_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'status'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status)';
    ELSE
      RAISE NOTICE 'Skipping idx_campaigns_status because column status is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'scheduled_at'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON public.campaigns(scheduled_at)';
    ELSE
      RAISE NOTICE 'Skipping idx_campaigns_scheduled_at because column scheduled_at is missing.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping campaigns indexes because table public.campaigns does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_messages'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_messages' AND column_name = 'campaign_id'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON public.campaign_messages(campaign_id)';
    ELSE
      RAISE NOTICE 'Skipping idx_campaign_messages_campaign_id because column campaign_id is missing.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_messages' AND column_name = 'sequence_order'
    ) INTO col_exists;
    IF col_exists THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campaign_messages_sequence ON public.campaign_messages(campaign_id, sequence_order)';
    ELSE
      RAISE NOTICE 'Skipping idx_campaign_messages_sequence because column sequence_order is missing.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping campaign_messages indexes because table public.campaign_messages does not exist.';
  END IF;
END;
$$;

-- Destinatários da campanha
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_contact_id ON campaign_recipients(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);

-- Webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_events_integration_id ON webhook_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (permitir tudo para usuários autenticados)
CREATE POLICY "Allow all for authenticated users" ON integrations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON contacts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON conversations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON campaigns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON campaign_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON campaign_recipients
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON webhook_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'integrations'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations';
    EXECUTE 'CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_integrations_updated_at because table public.integrations does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contacts'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts';
    EXECUTE 'CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_contacts_updated_at because table public.contacts does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations';
    EXECUTE 'CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_conversations_updated_at because table public.conversations does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages';
    EXECUTE 'CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_messages_updated_at because table public.messages does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns';
    EXECUTE 'CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_campaigns_updated_at because table public.campaigns does not exist.';
  END IF;
END;
$$;

-- Função para atualizar contadores de conversa
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        last_message_content = NEW.content,
        last_message_at = NEW.created_at,
        last_message_from = NEW.sender,
        message_count = message_count + 1,
        unread_count = CASE 
            WHEN NEW.sender = 'contact' THEN unread_count + 1 
            ELSE unread_count 
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_conversation_on_new_message ON public.messages';
    EXECUTE 'CREATE TRIGGER update_conversation_on_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_conversation_on_new_message because table public.messages does not exist.';
  END IF;
END;
$$;

-- ============================================================================
-- 10. DADOS INICIAIS (OPCIONAL)
-- ============================================================================

-- Inserir integração de exemplo (comentado)
-- INSERT INTO integrations (user_id, platform, name, status)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'whatsapp', 'WhatsApp Business', 'active');

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
