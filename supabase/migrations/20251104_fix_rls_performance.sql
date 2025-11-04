-- =====================================================
-- FIX RLS PERFORMANCE ISSUES
-- =====================================================
-- This migration fixes auth_rls_initplan warnings by wrapping
-- auth.uid() and auth.jwt() calls in SELECT subqueries.
-- This prevents unnecessary re-evaluation for each row.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- =====================================================

-- Disable RLS temporarily to recreate policies
SET session_replication_role = 'replica';

-- =====================================================
-- TABLE: profiles
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- TABLE: user_roles
-- =====================================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role = 'admin'
    )
  );

-- =====================================================
-- TABLE: conversations
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
CREATE POLICY "Users can create their own conversations" ON public.conversations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations" ON public.conversations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
CREATE POLICY "Users can delete their own conversations" ON public.conversations
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: messages
-- =====================================================

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
CREATE POLICY "Users can view messages from their conversations" ON public.messages
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;
CREATE POLICY "Users can create messages in their conversations" ON public.messages
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: conversation_events
-- =====================================================

DROP POLICY IF EXISTS "Users can view events from their conversations" ON public.conversation_events;
CREATE POLICY "Users can view events from their conversations" ON public.conversation_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create events in their conversations" ON public.conversation_events;
CREATE POLICY "Users can create events in their conversations" ON public.conversation_events
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: integrations
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own integrations" ON public.integrations;
CREATE POLICY "Users can view their own integrations" ON public.integrations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create their own integrations" ON public.integrations;
CREATE POLICY "Users can create their own integrations" ON public.integrations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own integrations" ON public.integrations;
CREATE POLICY "Users can update their own integrations" ON public.integrations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.integrations;
CREATE POLICY "Users can delete their own integrations" ON public.integrations
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: contacts
-- =====================================================

DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts;
CREATE POLICY "Users can view contacts" ON public.contacts
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;
CREATE POLICY "Users can create contacts" ON public.contacts
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
CREATE POLICY "Users can update contacts" ON public.contacts
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete contacts" ON public.contacts;
CREATE POLICY "Users can delete contacts" ON public.contacts
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: deals
-- =====================================================

DROP POLICY IF EXISTS "Users can view deals" ON public.deals;
CREATE POLICY "Users can view deals" ON public.deals
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create deals" ON public.deals;
CREATE POLICY "Users can create deals" ON public.deals
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update deals" ON public.deals;
CREATE POLICY "Users can update deals" ON public.deals
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete deals" ON public.deals;
CREATE POLICY "Users can delete deals" ON public.deals
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: campaigns
-- =====================================================

DROP POLICY IF EXISTS "Users can view campaigns" ON public.campaigns;
CREATE POLICY "Users can view campaigns" ON public.campaigns
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create campaigns" ON public.campaigns;
CREATE POLICY "Users can create campaigns" ON public.campaigns
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update campaigns" ON public.campaigns;
CREATE POLICY "Users can update campaigns" ON public.campaigns
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete campaigns" ON public.campaigns;
CREATE POLICY "Users can delete campaigns" ON public.campaigns
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: workflows
-- =====================================================

DROP POLICY IF EXISTS "Users can view workflows" ON public.workflows;
CREATE POLICY "Users can view workflows" ON public.workflows
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create workflows" ON public.workflows;
CREATE POLICY "Users can create workflows" ON public.workflows
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update workflows" ON public.workflows;
CREATE POLICY "Users can update workflows" ON public.workflows
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete workflows" ON public.workflows;
CREATE POLICY "Users can delete workflows" ON public.workflows
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: workflow_runs
-- =====================================================

DROP POLICY IF EXISTS "Users can view workflow runs" ON public.workflow_runs;
CREATE POLICY "Users can view workflow runs" ON public.workflow_runs
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: workflow_logs
-- =====================================================

DROP POLICY IF EXISTS "Users can view workflow logs" ON public.workflow_logs;
CREATE POLICY "Users can view workflow logs" ON public.workflow_logs
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: broadcasts
-- =====================================================

DROP POLICY IF EXISTS "Users can view broadcasts" ON public.broadcasts;
CREATE POLICY "Users can view broadcasts" ON public.broadcasts
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create broadcasts" ON public.broadcasts;
CREATE POLICY "Users can create broadcasts" ON public.broadcasts
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update broadcasts" ON public.broadcasts;
CREATE POLICY "Users can update broadcasts" ON public.broadcasts
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete broadcasts" ON public.broadcasts;
CREATE POLICY "Users can delete broadcasts" ON public.broadcasts
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: message_templates
-- =====================================================

DROP POLICY IF EXISTS "Users can view message templates" ON public.message_templates;
CREATE POLICY "Users can view message templates" ON public.message_templates
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create message templates" ON public.message_templates;
CREATE POLICY "Users can create message templates" ON public.message_templates
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update message templates" ON public.message_templates;
CREATE POLICY "Users can update message templates" ON public.message_templates
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete message templates" ON public.message_templates;
CREATE POLICY "Users can delete message templates" ON public.message_templates
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: message_attachments
-- =====================================================

DROP POLICY IF EXISTS "Users can view message attachments" ON public.message_attachments;
CREATE POLICY "Users can view message attachments" ON public.message_attachments
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: contact_lists
-- =====================================================

DROP POLICY IF EXISTS "Users can view contact lists" ON public.contact_lists;
CREATE POLICY "Users can view contact lists" ON public.contact_lists
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create contact lists" ON public.contact_lists;
CREATE POLICY "Users can create contact lists" ON public.contact_lists
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update contact lists" ON public.contact_lists;
CREATE POLICY "Users can update contact lists" ON public.contact_lists
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete contact lists" ON public.contact_lists;
CREATE POLICY "Users can delete contact lists" ON public.contact_lists
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: ai_agent_configs
-- =====================================================

DROP POLICY IF EXISTS "Users can view AI agent configs" ON public.ai_agent_configs;
CREATE POLICY "Users can view AI agent configs" ON public.ai_agent_configs
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create AI agent configs" ON public.ai_agent_configs;
CREATE POLICY "Users can create AI agent configs" ON public.ai_agent_configs
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update AI agent configs" ON public.ai_agent_configs;
CREATE POLICY "Users can update AI agent configs" ON public.ai_agent_configs
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete AI agent configs" ON public.ai_agent_configs;
CREATE POLICY "Users can delete AI agent configs" ON public.ai_agent_configs
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: ai_usage
-- =====================================================

DROP POLICY IF EXISTS "Users can view AI usage" ON public.ai_usage;
CREATE POLICY "Users can view AI usage" ON public.ai_usage
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: knowledge_items
-- =====================================================

DROP POLICY IF EXISTS "Users can view knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can view knowledge items" ON public.knowledge_items
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can create knowledge items" ON public.knowledge_items
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can update knowledge items" ON public.knowledge_items
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete knowledge items" ON public.knowledge_items;
CREATE POLICY "Users can delete knowledge items" ON public.knowledge_items
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: internal_chats
-- =====================================================

DROP POLICY IF EXISTS "Users can view internal chats" ON public.internal_chats;
CREATE POLICY "Users can view internal chats" ON public.internal_chats
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create internal chats" ON public.internal_chats;
CREATE POLICY "Users can create internal chats" ON public.internal_chats
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: internal_messages
-- =====================================================

DROP POLICY IF EXISTS "Users can view internal messages" ON public.internal_messages;
CREATE POLICY "Users can view internal messages" ON public.internal_messages
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create internal messages" ON public.internal_messages;
CREATE POLICY "Users can create internal messages" ON public.internal_messages
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: notification_preferences
-- =====================================================

DROP POLICY IF EXISTS "Users can view notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view notification preferences" ON public.notification_preferences
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update notification preferences" ON public.notification_preferences
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- TABLE: whatsapp_connections
-- =====================================================

DROP POLICY IF EXISTS "Users can view WhatsApp connections" ON public.whatsapp_connections;
CREATE POLICY "Users can view WhatsApp connections" ON public.whatsapp_connections
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create WhatsApp connections" ON public.whatsapp_connections;
CREATE POLICY "Users can create WhatsApp connections" ON public.whatsapp_connections
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update WhatsApp connections" ON public.whatsapp_connections;
CREATE POLICY "Users can update WhatsApp connections" ON public.whatsapp_connections
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete WhatsApp connections" ON public.whatsapp_connections;
CREATE POLICY "Users can delete WhatsApp connections" ON public.whatsapp_connections
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: facebook_connections
-- =====================================================

DROP POLICY IF EXISTS "Users can view Facebook connections" ON public.facebook_connections;
CREATE POLICY "Users can view Facebook connections" ON public.facebook_connections
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create Facebook connections" ON public.facebook_connections;
CREATE POLICY "Users can create Facebook connections" ON public.facebook_connections
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update Facebook connections" ON public.facebook_connections;
CREATE POLICY "Users can update Facebook connections" ON public.facebook_connections
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete Facebook connections" ON public.facebook_connections;
CREATE POLICY "Users can delete Facebook connections" ON public.facebook_connections
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: instagram_connections
-- =====================================================

DROP POLICY IF EXISTS "Users can view Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can view Instagram connections" ON public.instagram_connections
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can create Instagram connections" ON public.instagram_connections
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can update Instagram connections" ON public.instagram_connections
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can delete Instagram connections" ON public.instagram_connections
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: properties
-- =====================================================

DROP POLICY IF EXISTS "Users can view properties" ON public.properties;
CREATE POLICY "Users can view properties" ON public.properties
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create properties" ON public.properties;
CREATE POLICY "Users can create properties" ON public.properties
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update properties" ON public.properties;
CREATE POLICY "Users can update properties" ON public.properties
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete properties" ON public.properties;
CREATE POLICY "Users can delete properties" ON public.properties
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: property_visits
-- =====================================================

DROP POLICY IF EXISTS "Users can view property visits" ON public.property_visits;
CREATE POLICY "Users can view property visits" ON public.property_visits
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create property visits" ON public.property_visits;
CREATE POLICY "Users can create property visits" ON public.property_visits
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update property visits" ON public.property_visits;
CREATE POLICY "Users can update property visits" ON public.property_visits
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete property visits" ON public.property_visits;
CREATE POLICY "Users can delete property visits" ON public.property_visits
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: empreendimentos
-- =====================================================

DROP POLICY IF EXISTS "Users can view empreendimentos" ON public.empreendimentos;
CREATE POLICY "Users can view empreendimentos" ON public.empreendimentos
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create empreendimentos" ON public.empreendimentos;
CREATE POLICY "Users can create empreendimentos" ON public.empreendimentos
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update empreendimentos" ON public.empreendimentos;
CREATE POLICY "Users can update empreendimentos" ON public.empreendimentos
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete empreendimentos" ON public.empreendimentos;
CREATE POLICY "Users can delete empreendimentos" ON public.empreendimentos
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: pre_cadastros
-- =====================================================

DROP POLICY IF EXISTS "Users can view pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Users can view pre_cadastros" ON public.pre_cadastros
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Users can create pre_cadastros" ON public.pre_cadastros
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Users can update pre_cadastros" ON public.pre_cadastros
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Users can delete pre_cadastros" ON public.pre_cadastros
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: documentos_pre_cadastro
-- =====================================================

DROP POLICY IF EXISTS "Users can view documentos_pre_cadastro" ON public.documentos_pre_cadastro;
CREATE POLICY "Users can view documentos_pre_cadastro" ON public.documentos_pre_cadastro
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create documentos_pre_cadastro" ON public.documentos_pre_cadastro;
CREATE POLICY "Users can create documentos_pre_cadastro" ON public.documentos_pre_cadastro
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update documentos_pre_cadastro" ON public.documentos_pre_cadastro;
CREATE POLICY "Users can update documentos_pre_cadastro" ON public.documentos_pre_cadastro
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete documentos_pre_cadastro" ON public.documentos_pre_cadastro;
CREATE POLICY "Users can delete documentos_pre_cadastro" ON public.documentos_pre_cadastro
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: correspondentes
-- =====================================================

DROP POLICY IF EXISTS "Users can view correspondentes" ON public.correspondentes;
CREATE POLICY "Users can view correspondentes" ON public.correspondentes
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create correspondentes" ON public.correspondentes;
CREATE POLICY "Users can create correspondentes" ON public.correspondentes
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update correspondentes" ON public.correspondentes;
CREATE POLICY "Users can update correspondentes" ON public.correspondentes
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete correspondentes" ON public.correspondentes;
CREATE POLICY "Users can delete correspondentes" ON public.correspondentes
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: correspondentes_usuarios
-- =====================================================

DROP POLICY IF EXISTS "Users can view correspondentes_usuarios" ON public.correspondentes_usuarios;
CREATE POLICY "Users can view correspondentes_usuarios" ON public.correspondentes_usuarios
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create correspondentes_usuarios" ON public.correspondentes_usuarios;
CREATE POLICY "Users can create correspondentes_usuarios" ON public.correspondentes_usuarios
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update correspondentes_usuarios" ON public.correspondentes_usuarios;
CREATE POLICY "Users can update correspondentes_usuarios" ON public.correspondentes_usuarios
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete correspondentes_usuarios" ON public.correspondentes_usuarios;
CREATE POLICY "Users can delete correspondentes_usuarios" ON public.correspondentes_usuarios
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: commissions
-- =====================================================

DROP POLICY IF EXISTS "Users can view commissions" ON public.commissions;
CREATE POLICY "Users can view commissions" ON public.commissions
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create commissions" ON public.commissions;
CREATE POLICY "Users can create commissions" ON public.commissions
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update commissions" ON public.commissions;
CREATE POLICY "Users can update commissions" ON public.commissions
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete commissions" ON public.commissions;
CREATE POLICY "Users can delete commissions" ON public.commissions
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- Re-enable RLS
SET session_replication_role = 'origin';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- DONE
-- =====================================================
-- All RLS policies have been optimized for performance.
-- auth.uid() and auth.jwt() are now wrapped in SELECT subqueries.
-- This prevents unnecessary re-evaluation for each row.
-- =====================================================
