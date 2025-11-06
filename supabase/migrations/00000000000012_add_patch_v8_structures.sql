-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_embeddings'
      AND column_name = 'embedding'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.knowledge_embeddings ALTER COLUMN embedding SET DATA TYPE vector';
    EXCEPTION
      WHEN undefined_column THEN
        RAISE NOTICE 'Skipping knowledge_embeddings.embedding type change because the column is missing.';
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipping knowledge_embeddings.embedding type change because the table is missing.';
      WHEN undefined_object THEN
        RAISE NOTICE 'Skipping knowledge_embeddings.embedding type change because type "vector" is unavailable.';
    END;
  ELSE
    RAISE NOTICE 'Skipping knowledge_embeddings.embedding type change because the column is missing.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "public"."ai_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "enabled" BOOLEAN DEFAULT true,
    "auto_reply" BOOLEAN DEFAULT false,
    "sentiment_analysis" BOOLEAN DEFAULT false,
    "suggestion_enabled" BOOLEAN DEFAULT false,
    "config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_configurations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."ai_auto_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "configuration_id" UUID,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "message_id" UUID,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokens_used" INTEGER DEFAULT 0,
    "confidence" DECIMAL(5,2),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_auto_replies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."scheduled_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "integration_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'scheduled',
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "messages_payload" JSONB NOT NULL DEFAULT '[]',
    "delay_seconds" INTEGER DEFAULT 5,
    "simulate_typing" BOOLEAN DEFAULT true,
    "simulate_recording" BOOLEAN DEFAULT false,
    "stats" JSONB DEFAULT '{}',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "contact_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER DEFAULT 60,
    "type" VARCHAR(50) DEFAULT 'other',
    "status" VARCHAR(50) DEFAULT 'pending',
    "location" TEXT,
    "assigned_to" UUID,
    "reminder_minutes" INTEGER DEFAULT 30,
    "reminder_sent" BOOLEAN DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "message_id" UUID,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_ai_configurations_provider" ON "public"."ai_configurations"("provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_configurations_user_id" ON "public"."ai_configurations"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_auto_replies_configuration_id" ON "public"."ai_auto_replies"("configuration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_auto_replies_conversation_id" ON "public"."ai_auto_replies"("conversation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_auto_replies_message_id" ON "public"."ai_auto_replies"("message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_auto_replies_user_id" ON "public"."ai_auto_replies"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_scheduled_campaigns_integration_id" ON "public"."scheduled_campaigns"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_scheduled_campaigns_scheduled_at" ON "public"."scheduled_campaigns"("scheduled_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_scheduled_campaigns_status" ON "public"."scheduled_campaigns"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_scheduled_campaigns_user_id" ON "public"."scheduled_campaigns"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_appointments_contact_id" ON "public"."appointments"("contact_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_appointments_scheduled_at" ON "public"."appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_appointments_status" ON "public"."appointments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_appointments_user_id" ON "public"."appointments"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_media_files_message_id" ON "public"."media_files"("message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_media_files_user_id" ON "public"."media_files"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_configurations'
  ) THEN
    RAISE NOTICE 'Skipping ai_configurations_user_id_fkey because table public.ai_configurations does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_configurations'
      AND constraint_name = 'ai_configurations_user_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping ai_configurations_user_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.ai_configurations ADD CONSTRAINT ai_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_auto_replies'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_configuration_id_fkey because table public.ai_auto_replies does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_auto_replies'
      AND constraint_name = 'ai_auto_replies_configuration_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_configuration_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.ai_auto_replies ADD CONSTRAINT ai_auto_replies_configuration_id_fkey FOREIGN KEY (configuration_id) REFERENCES public.ai_configurations(id) ON DELETE SET NULL ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_auto_replies'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_conversation_id_fkey because table public.ai_auto_replies does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_auto_replies'
      AND constraint_name = 'ai_auto_replies_conversation_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_conversation_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.ai_auto_replies ADD CONSTRAINT ai_auto_replies_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_auto_replies'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_message_id_fkey because table public.ai_auto_replies does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_auto_replies'
      AND constraint_name = 'ai_auto_replies_message_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_message_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.ai_auto_replies ADD CONSTRAINT ai_auto_replies_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_auto_replies'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_user_id_fkey because table public.ai_auto_replies does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_auto_replies'
      AND constraint_name = 'ai_auto_replies_user_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping ai_auto_replies_user_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.ai_auto_replies ADD CONSTRAINT ai_auto_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_campaigns'
  ) THEN
    RAISE NOTICE 'Skipping scheduled_campaigns_integration_id_fkey because table public.scheduled_campaigns does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'scheduled_campaigns'
      AND constraint_name = 'scheduled_campaigns_integration_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping scheduled_campaigns_integration_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.scheduled_campaigns ADD CONSTRAINT scheduled_campaigns_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_campaigns'
  ) THEN
    RAISE NOTICE 'Skipping scheduled_campaigns_user_id_fkey because table public.scheduled_campaigns does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'scheduled_campaigns'
      AND constraint_name = 'scheduled_campaigns_user_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping scheduled_campaigns_user_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.scheduled_campaigns ADD CONSTRAINT scheduled_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'appointments'
  ) THEN
    RAISE NOTICE 'Skipping appointments_contact_id_fkey because table public.appointments does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND constraint_name = 'appointments_contact_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping appointments_contact_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'appointments'
  ) THEN
    RAISE NOTICE 'Skipping appointments_user_id_fkey because table public.appointments does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND constraint_name = 'appointments_user_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping appointments_user_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'appointments'
  ) THEN
    RAISE NOTICE 'Skipping appointments_assigned_to_fkey because table public.appointments does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND constraint_name = 'appointments_assigned_to_fkey'
  ) THEN
    RAISE NOTICE 'Skipping appointments_assigned_to_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_files'
  ) THEN
    RAISE NOTICE 'Skipping media_files_message_id_fkey because table public.media_files does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'media_files'
      AND constraint_name = 'media_files_message_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping media_files_message_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.media_files ADD CONSTRAINT media_files_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_files'
  ) THEN
    RAISE NOTICE 'Skipping media_files_user_id_fkey because table public.media_files does not exist.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'media_files'
      AND constraint_name = 'media_files_user_id_fkey'
  ) THEN
    RAISE NOTICE 'Skipping media_files_user_id_fkey because it already exists.';
  ELSE
    EXECUTE 'ALTER TABLE public.media_files ADD CONSTRAINT media_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION';
  END IF;
END;
$$;
