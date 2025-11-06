-- ============================================
-- MIGRATION 003: AI Tables (Agents, Tools, Knowledge, Usage)
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google'
    api_key TEXT, -- encrypted
    model TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger TEXT NOT NULL, -- '@puxarCNPJ', '@buscarCEP'
    endpoint TEXT, -- external API endpoint
    parameters JSONB NOT NULL, -- function parameters schema
    response_schema JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'docx', 'txt', 'url'
    file_url TEXT,
    storage_path TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    chunk_count INTEGER DEFAULT 0,
    embedding_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_embeddings'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE 'Skipping public.knowledge_embeddings creation because the table already exists.';
  ELSE
    BEGIN
      EXECUTE $ddl$
        CREATE TABLE public.knowledge_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding vector(1536), -- OpenAI ada-002 dimensions
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      $ddl$;
    EXCEPTION
      WHEN undefined_object THEN
        RAISE NOTICE 'Skipping public.knowledge_embeddings creation because type "vector" is not available.';
    END;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    conversation_id UUID, -- will be linked later
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost DECIMAL(10,6) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.followup_cadences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_config JSONB NOT NULL, -- when to trigger
    steps JSONB NOT NULL, -- array of steps with delays
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_providers'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.ai_providers because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.ai_agents because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_tools'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.ai_tools because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_documents'
  ) THEN
    EXECUTE 'ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.knowledge_documents because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_embeddings'
  ) THEN
    EXECUTE 'ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.knowledge_embeddings because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_usage'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.ai_usage because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'followup_cadences'
  ) THEN
    EXECUTE 'ALTER TABLE public.followup_cadences ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.followup_cadences because the table does not exist.';
  END IF;
END;
$$;

-- ============================================
-- RLS POLICIES - TENANT ISOLATION
-- ============================================

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_providers'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_providers'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant providers" ON public.ai_providers';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant providers"
        ON public.ai_providers FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage providers" ON public.ai_providers';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage providers"
        ON public.ai_providers FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping ai_providers policies because column public.ai_providers.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping ai_providers policies because table public.ai_providers does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_agents'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_agents'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant agents" ON public.ai_agents';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant agents"
        ON public.ai_agents FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage agents" ON public.ai_agents';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage agents"
        ON public.ai_agents FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping ai_agents policies because column public.ai_agents.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping ai_agents policies because table public.ai_agents does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_tools'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_tools'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant tools" ON public.ai_tools';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant tools"
        ON public.ai_tools FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage tools" ON public.ai_tools';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage tools"
        ON public.ai_tools FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping ai_tools policies because column public.ai_tools.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping ai_tools policies because table public.ai_tools does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_documents'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_documents'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant documents" ON public.knowledge_documents';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant documents"
        ON public.knowledge_documents FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Users can upload documents" ON public.knowledge_documents';
      EXECUTE $policy$
        CREATE POLICY "Users can upload documents"
        ON public.knowledge_documents FOR INSERT
        TO authenticated
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage documents" ON public.knowledge_documents';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage documents"
        ON public.knowledge_documents FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping knowledge_documents policies because column public.knowledge_documents.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping knowledge_documents policies because table public.knowledge_documents does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_document_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_embeddings'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_embeddings'
      AND column_name = 'document_id'
  ) INTO has_document_id;

  IF has_table THEN
    IF has_document_id THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view embeddings" ON public.knowledge_embeddings';
      EXECUTE $policy$
        CREATE POLICY "Users can view embeddings"
        ON public.knowledge_embeddings FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.knowledge_documents kd
            WHERE kd.id = knowledge_embeddings.document_id
            AND kd.tenant_id = public.get_user_tenant_id(auth.uid())
          )
        )
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping knowledge_embeddings policies because column public.knowledge_embeddings.document_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping knowledge_embeddings policies because table public.knowledge_embeddings does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  tenant_data_type TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_usage'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_usage'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT data_type
  INTO tenant_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'ai_usage'
    AND column_name = 'tenant_id'
  LIMIT 1;

  IF has_table THEN
    IF has_tenant AND tenant_data_type = 'uuid' THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant usage" ON public.ai_usage';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant usage"
        ON public.ai_usage FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSIF has_tenant THEN
      RAISE NOTICE 'Skipping ai_usage select policy because public.ai_usage.tenant_id is type %, expected uuid.', tenant_data_type;
    ELSE
      RAISE NOTICE 'Skipping ai_usage select policy because column public.ai_usage.tenant_id does not exist.';
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "System can insert usage" ON public.ai_usage';
    EXECUTE $policy$
      CREATE POLICY "System can insert usage"
      ON public.ai_usage FOR INSERT
      TO authenticated
      WITH CHECK (true)
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping ai_usage policies because table public.ai_usage does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'followup_cadences'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'followup_cadences'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant cadences" ON public.followup_cadences';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant cadences"
        ON public.followup_cadences FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage cadences" ON public.followup_cadences';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage cadences"
        ON public.followup_cadences FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping followup_cadences policies because column public.followup_cadences.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping followup_cadences policies because table public.followup_cadences does not exist.';
  END IF;
END;
$$;

-- TRIGGERS: Update updated_at
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_providers'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_ai_providers_updated_at ON public.ai_providers';
    EXECUTE 'CREATE TRIGGER update_ai_providers_updated_at BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_ai_providers_updated_at because table public.ai_providers does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_ai_agents_updated_at ON public.ai_agents';
    EXECUTE 'CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_ai_agents_updated_at because table public.ai_agents does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_tools'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_ai_tools_updated_at ON public.ai_tools';
    EXECUTE 'CREATE TRIGGER update_ai_tools_updated_at BEFORE UPDATE ON public.ai_tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_ai_tools_updated_at because table public.ai_tools does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_documents'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_knowledge_documents_updated_at ON public.knowledge_documents';
    EXECUTE 'CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_knowledge_documents_updated_at because table public.knowledge_documents does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'followup_cadences'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_followup_cadences_updated_at ON public.followup_cadences';
    EXECUTE 'CREATE TRIGGER update_followup_cadences_updated_at BEFORE UPDATE ON public.followup_cadences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_followup_cadences_updated_at because table public.followup_cadences does not exist.';
  END IF;
END;
$$;

-- ============================================
-- INDEXES for performance
-- ============================================

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_agents' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_id ON public.ai_agents(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_ai_agents_tenant_id because column public.ai_agents.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping ai_agents indexes because table public.ai_agents does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_trigger_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_tools'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_tools' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_tools' AND column_name = 'trigger'
  ) INTO has_trigger_col;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_tools_tenant_id ON public.ai_tools(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_ai_tools_tenant_id because column public.ai_tools.tenant_id does not exist.';
    END IF;

    IF has_trigger_col THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_tools_trigger ON public.ai_tools("trigger")';
    ELSE
      RAISE NOTICE 'Skipping index idx_ai_tools_trigger because column public.ai_tools.trigger does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping ai_tools indexes because table public.ai_tools does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_agent BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_documents'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'agent_id'
  ) INTO has_agent;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant_id ON public.knowledge_documents(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_knowledge_docs_tenant_id because column public.knowledge_documents.tenant_id does not exist.';
    END IF;

    IF has_agent THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent_id ON public.knowledge_documents(agent_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_knowledge_docs_agent_id because column public.knowledge_documents.agent_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping knowledge_documents indexes because table public.knowledge_documents does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_created BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_usage'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_usage' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_usage' AND column_name = 'created_at'
  ) INTO has_created;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_id ON public.ai_usage(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_ai_usage_tenant_id because column public.ai_usage.tenant_id does not exist.';
    END IF;

    IF has_created THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at DESC)';
    ELSE
      RAISE NOTICE 'Skipping index idx_ai_usage_created_at because column public.ai_usage.created_at does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping ai_usage indexes because table public.ai_usage does not exist.';
  END IF;
END;
$$;
