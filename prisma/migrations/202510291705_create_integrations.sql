-- Create minimal integrations table required by seeds and WhatsApp flows
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('WHATSAPP','FACEBOOK','INSTAGRAM')),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','inactive','error','pending')),
    access_token TEXT,
    refresh_token TEXT,
    phone_number VARCHAR(50),
    phone_number_id VARCHAR(255),
    business_account_id VARCHAR(255),
    page_id VARCHAR(255),
    instagram_account_id VARCHAR(255),
    webhook_url TEXT,
    webhook_secret TEXT,
    api_version VARCHAR(20) DEFAULT 'v18.0',
    metadata JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, phone_number)
);

