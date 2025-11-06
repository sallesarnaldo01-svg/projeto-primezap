-- ============================================
-- MIGRATION 004: Conversation Tables (Messages, Events, Timeline)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
          connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
          agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
          assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
          queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
          status TEXT DEFAULT 'open',
          channel TEXT NOT NULL,
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ai_enabled BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.conversations creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
          sender_type TEXT NOT NULL,
          sender_id UUID,
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          media_url TEXT,
          metadata JSONB DEFAULT '{}',
          external_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.messages creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversation_events'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.conversation_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          actor TEXT NOT NULL,
          actor_id UUID,
          actor_name TEXT,
          title TEXT NOT NULL,
          description TEXT,
          metadata JSONB DEFAULT '{}',
          rating INTEGER,
          feedback TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.conversation_events creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'broadcasts'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.broadcasts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
          created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          message_template TEXT NOT NULL,
          target_filters JSONB,
          scheduled_at TIMESTAMP WITH TIME ZONE,
          status TEXT DEFAULT 'draft',
          total_contacts INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.broadcasts creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'message_logs'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.message_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE CASCADE,
          conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
          contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          sent_at TIMESTAMP WITH TIME ZONE,
          delivered_at TIMESTAMP WITH TIME ZONE,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.message_logs creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'campaign_phrases'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.campaign_phrases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT,
          tags TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.campaign_phrases creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.conversations because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.messages because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_events'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.conversation_events because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcasts'
  ) THEN
    EXECUTE 'ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.broadcasts because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.message_logs because the table does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_phrases'
  ) THEN
    EXECUTE 'ALTER TABLE public.campaign_phrases ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.campaign_phrases because the table does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_assigned BOOLEAN;
  tenant_data_type TEXT;
  assigned_data_type TEXT;
  tenant_condition TEXT;
  assigned_condition TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'assigned_to'
  ) INTO has_assigned;

  SELECT data_type
  INTO tenant_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'tenant_id'
  LIMIT 1;

  SELECT data_type
  INTO assigned_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'assigned_to'
  LIMIT 1;

  IF tenant_data_type = 'uuid' THEN
    tenant_condition := 'tenant_id = public.get_user_tenant_id(auth.uid())';
  ELSIF tenant_data_type = 'text' THEN
    tenant_condition := 'tenant_id = public.get_user_tenant_id(auth.uid())::text';
  ELSE
    tenant_condition := NULL;
  END IF;

  IF assigned_data_type = 'uuid' THEN
    assigned_condition := 'assigned_to = auth.uid()';
  ELSIF assigned_data_type = 'text' THEN
    assigned_condition := 'assigned_to = auth.uid()::text';
  ELSE
    assigned_condition := NULL;
  END IF;

  IF has_table THEN
    IF has_tenant AND tenant_condition IS NOT NULL THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant conversations" ON public.conversations';
      EXECUTE format(
        'CREATE POLICY "Users can view own tenant conversations"
         ON public.conversations FOR SELECT
         TO authenticated
         USING (%s)',
        tenant_condition
      );

      EXECUTE 'DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations';
      EXECUTE format(
        'CREATE POLICY "Users can create conversations"
         ON public.conversations FOR INSERT
         TO authenticated
         WITH CHECK (%s)',
        tenant_condition
      );

      IF has_assigned AND assigned_condition IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations';
        EXECUTE format(
          'CREATE POLICY "Users can update own conversations"
           ON public.conversations FOR UPDATE
           TO authenticated
           USING (
             %s AND
             (%s OR assigned_to IS NULL OR public.has_role(auth.uid(), ''admin''))
           )',
          tenant_condition,
          assigned_condition
        );
      ELSE
        RAISE NOTICE 'Skipping update policy on public.conversations because column assigned_to is missing or unsupported data type.';
      END IF;
    ELSE
      RAISE NOTICE 'Skipping conversation policies because column public.conversations.tenant_id is missing or unsupported data type.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping conversation policies because table public.conversations does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_messages BOOLEAN;
  has_conversation_fk BOOLEAN;
  has_conversations BOOLEAN;
  has_conversation_tenant BOOLEAN;
  tenant_data_type TEXT;
  tenant_condition TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) INTO has_messages;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id'
  ) INTO has_conversation_fk;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) INTO has_conversations;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'tenant_id'
  ) INTO has_conversation_tenant;

  SELECT data_type
  INTO tenant_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'tenant_id'
  LIMIT 1;

  IF tenant_data_type = 'uuid' THEN
    tenant_condition := 'c.tenant_id = public.get_user_tenant_id(auth.uid())';
  ELSIF tenant_data_type = 'text' THEN
    tenant_condition := 'c.tenant_id = public.get_user_tenant_id(auth.uid())::text';
  ELSE
    tenant_condition := NULL;
  END IF;

  IF has_messages AND has_conversation_fk AND has_conversations AND has_conversation_tenant AND tenant_condition IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view messages" ON public.messages';
    EXECUTE format(
      'CREATE POLICY "Users can view messages"
       ON public.messages FOR SELECT
       TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.conversations c
           WHERE c.id = messages.conversation_id
             AND %s
         )
       )',
      tenant_condition
    );

    EXECUTE 'DROP POLICY IF EXISTS "Users can send messages" ON public.messages';
    EXECUTE format(
      'CREATE POLICY "Users can send messages"
       ON public.messages FOR INSERT
       TO authenticated
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.conversations c
           WHERE c.id = messages.conversation_id
             AND %s
         )
       )',
      tenant_condition
    );
  ELSE
    RAISE NOTICE 'Skipping messages policies because required tables or columns are missing or unsupported.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_events'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_events' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table AND has_tenant THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant events" ON public.conversation_events';
    EXECUTE $policy$
      CREATE POLICY "Users can view own tenant events"
      ON public.conversation_events FOR SELECT
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Users can create events" ON public.conversation_events';
    EXECUTE $policy$
      CREATE POLICY "Users can create events"
      ON public.conversation_events FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Users can rate AI responses" ON public.conversation_events';
    EXECUTE $policy$
      CREATE POLICY "Users can rate AI responses"
      ON public.conversation_events FOR UPDATE
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping conversation_events policies because required columns or table do not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcasts'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'broadcasts' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table AND has_tenant THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant broadcasts" ON public.broadcasts';
    EXECUTE $policy$
      CREATE POLICY "Users can view own tenant broadcasts"
      ON public.broadcasts FOR SELECT
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Users can create broadcasts" ON public.broadcasts';
    EXECUTE $policy$
      CREATE POLICY "Users can create broadcasts"
      ON public.broadcasts FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage broadcasts" ON public.broadcasts';
    EXECUTE $policy$
      CREATE POLICY "Admins can manage broadcasts"
      ON public.broadcasts FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), ''admin''))
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping broadcast policies because required columns or table do not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_logs BOOLEAN;
  has_broadcast_fk BOOLEAN;
  has_broadcasts BOOLEAN;
  has_broadcast_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_logs'
  ) INTO has_logs;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'message_logs' AND column_name = 'broadcast_id'
  ) INTO has_broadcast_fk;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcasts'
  ) INTO has_broadcasts;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'broadcasts' AND column_name = 'tenant_id'
  ) INTO has_broadcast_tenant;

  IF has_logs AND has_broadcast_fk AND has_broadcasts AND has_broadcast_tenant THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view message logs" ON public.message_logs';
    EXECUTE $policy$
      CREATE POLICY "Users can view message logs"
      ON public.message_logs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.broadcasts b
          WHERE b.id = message_logs.broadcast_id
            AND b.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping message_logs policy because required tables or columns are missing.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_phrases'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaign_phrases' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table AND has_tenant THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant phrases" ON public.campaign_phrases';
    EXECUTE $policy$
      CREATE POLICY "Users can view own tenant phrases"
      ON public.campaign_phrases FOR SELECT
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Users can manage phrases" ON public.campaign_phrases';
    EXECUTE $policy$
      CREATE POLICY "Users can manage phrases"
      ON public.campaign_phrases FOR ALL
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping campaign_phrases policies because required columns or table do not exist.';
  END IF;
END;
$$;

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations';
    EXECUTE 'CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_conversations_updated_at because table public.conversations does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcasts'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_broadcasts_updated_at ON public.broadcasts';
    EXECUTE 'CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_broadcasts_updated_at because table public.broadcasts does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_phrases'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_campaign_phrases_updated_at ON public.campaign_phrases';
    EXECUTE 'CREATE TRIGGER update_campaign_phrases_updated_at BEFORE UPDATE ON public.campaign_phrases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_campaign_phrases_updated_at because table public.campaign_phrases does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages';
    EXECUTE 'CREATE TRIGGER update_conversation_last_message_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_conversation_last_message_trigger because table public.messages does not exist.';
  END IF;
END;
$$;

-- ============================================
-- INDEXES for performance
-- ============================================

DO $$
DECLARE
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) INTO has_table;

  IF has_table THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'tenant_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversations_tenant_id because column public.conversations.tenant_id does not exist.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'contact_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON public.conversations(contact_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversations_contact_id because column public.conversations.contact_id does not exist.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'assigned_to') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations(assigned_to)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversations_assigned_to because column public.conversations.assigned_to does not exist.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'status') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversations_status because column public.conversations.status does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping conversation indexes because table public.conversations does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) INTO has_table;

  IF has_table THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_messages_conversation_id because column public.messages.conversation_id does not exist.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'created_at') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC)';
    ELSE
      RAISE NOTICE 'Skipping index idx_messages_created_at because column public.messages.created_at does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping messages indexes because table public.messages does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_events'
  ) INTO has_table;

  IF has_table THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_events' AND column_name = 'tenant_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversation_events_tenant_id ON public.conversation_events(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversation_events_tenant_id because column public.conversation_events.tenant_id does not exist.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_events' AND column_name = 'conversation_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation_id ON public.conversation_events(conversation_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversation_events_conversation_id because column public.conversation_events.conversation_id does not exist.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_events' AND column_name = 'created_at') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversation_events_created_at ON public.conversation_events(created_at DESC)';
    ELSE
      RAISE NOTICE 'Skipping index idx_conversation_events_created_at because column public.conversation_events.created_at does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping conversation_events indexes because table public.conversation_events does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcasts'
  ) INTO has_table;

  IF has_table THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'broadcasts' AND column_name = 'tenant_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant_id ON public.broadcasts(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_broadcasts_tenant_id because column public.broadcasts.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping broadcasts indexes because table public.broadcasts does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_logs'
  ) INTO has_table;

  IF has_table THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message_logs' AND column_name = 'broadcast_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_message_logs_broadcast_id ON public.message_logs(broadcast_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_message_logs_broadcast_id because column public.message_logs.broadcast_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping message_logs indexes because table public.message_logs does not exist.';
  END IF;
END;
$$;

-- ============================================
-- REALTIME PUBLICATION SETUP
-- ============================================

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Table public.conversations already in publication supabase_realtime.';
    WHEN undefined_object THEN
      RAISE NOTICE 'Skipping publication update for public.conversations because the publication or table does not exist.';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Table public.messages already in publication supabase_realtime.';
    WHEN undefined_object THEN
      RAISE NOTICE 'Skipping publication update for public.messages because the publication or table does not exist.';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_events';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Table public.conversation_events already in publication supabase_realtime.';
    WHEN undefined_object THEN
      RAISE NOTICE 'Skipping publication update for public.conversation_events because the publication or table does not exist.';
  END;
END;
$$;
