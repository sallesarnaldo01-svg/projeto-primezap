-- =============================================================================
-- Security Hardening: Enable RLS and harden function search_path
-- =============================================================================

-- Enable RLS (idempotent) and add permissive policies matching previous behaviour.
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'appointments',
    'seq_pre_cadastros',
    'notifications',
    'deal_interactions',
    'lead_actions',
    'simulacoes_financiamento',
    'lead_interactions',
    'aprovacoes',
    'documento_tipos',
    'facebook_campaigns',
    'transactions',
    'invoices',
    'ai_auto_replies',
    'tag_categories',
    'companies',
    'contact_list_members',
    'knowledge_embeddings',
    'deal_history',
    'contact_activities',
    'deal_activities',
    'scheduled_campaigns',
    'media_files'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = tbl || '_auth_rw'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
          tbl || '_auth_rw', tbl
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = tbl || '_service_rw'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
          tbl || '_service_rw', tbl
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Harden search_path on security sensitive functions.
ALTER FUNCTION public.notify_internal_message_mentions() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.get_signed_url(text, text, integer) SET search_path = public;
ALTER FUNCTION public.generate_pre_cadastro_numero(uuid) SET search_path = public;
ALTER FUNCTION public.update_conversation_on_message() SET search_path = public;
ALTER FUNCTION public.update_conversation_last_message() SET search_path = public;
ALTER FUNCTION public.storage_foldername(text) SET search_path = public;
ALTER FUNCTION public.calcular_percentual_documentos(uuid) SET search_path = public;
