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

-- Integrações
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- Contatos
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_integration_id ON contacts(integration_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp_id ON contacts(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_contacts_facebook_id ON contacts(facebook_id);
CREATE INDEX IF NOT EXISTS idx_contacts_instagram_id ON contacts(instagram_id);

-- Conversas
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_integration_id ON conversations(integration_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);

-- Mensagens
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id);

-- Campanhas
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);

-- Mensagens da campanha
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_sequence ON campaign_messages(campaign_id, sequence_order);

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

-- Triggers para updated_at
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Trigger para atualizar conversa ao inserir mensagem
CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- 10. DADOS INICIAIS (OPCIONAL)
-- ============================================================================

-- Inserir integração de exemplo (comentado)
-- INSERT INTO integrations (user_id, platform, name, status)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'whatsapp', 'WhatsApp Business', 'active');

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
