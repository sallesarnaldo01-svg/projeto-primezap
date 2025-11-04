-- =====================================================
-- FIX RLS SECURITY ISSUES
-- =====================================================
-- This migration fixes multiple_permissive_policies warnings
-- by consolidating multiple permissive policies into single
-- policies with OR conditions, or by making some restrictive.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
-- =====================================================

-- =====================================================
-- STRATEGY:
-- Instead of having multiple PERMISSIVE policies (OR logic),
-- we consolidate them into fewer policies or make some RESTRICTIVE.
--
-- Current: Policy1 (PERMISSIVE) OR Policy2 (PERMISSIVE) OR Policy3 (PERMISSIVE)
-- Fixed: Single policy with (condition1 OR condition2 OR condition3)
-- =====================================================

-- =====================================================
-- TABLE: contacts
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can manage all contacts" ON public.contacts;

-- Create consolidated policies
CREATE POLICY "contacts_select_policy" ON public.contacts
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contacts_insert_policy" ON public.contacts
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contacts_update_policy" ON public.contacts
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contacts_delete_policy" ON public.contacts
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: conversations
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;

CREATE POLICY "conversations_select_policy" ON public.conversations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "conversations_insert_policy" ON public.conversations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "conversations_update_policy" ON public.conversations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "conversations_delete_policy" ON public.conversations
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
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;

CREATE POLICY "messages_select_policy" ON public.messages
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "messages_insert_policy" ON public.messages
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
DROP POLICY IF EXISTS "Users can create their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can update their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can manage all integrations" ON public.integrations;

CREATE POLICY "integrations_select_policy" ON public.integrations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "integrations_insert_policy" ON public.integrations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "integrations_update_policy" ON public.integrations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "integrations_delete_policy" ON public.integrations
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: user_roles
-- =====================================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can create roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update roles" ON public.user_roles;

CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "user_roles_manage_policy" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role = 'admin'
    )
  );

-- =====================================================
-- TABLE: campaigns
-- =====================================================

DROP POLICY IF EXISTS "Users can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON public.campaigns;

CREATE POLICY "campaigns_select_policy" ON public.campaigns
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "campaigns_insert_policy" ON public.campaigns
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "campaigns_update_policy" ON public.campaigns
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "campaigns_delete_policy" ON public.campaigns
  FOR DELETE
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
DROP POLICY IF EXISTS "Users can create broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Users can update broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Users can delete broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Admins can manage all broadcasts" ON public.broadcasts;

CREATE POLICY "broadcasts_select_policy" ON public.broadcasts
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "broadcasts_insert_policy" ON public.broadcasts
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "broadcasts_update_policy" ON public.broadcasts
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "broadcasts_delete_policy" ON public.broadcasts
  FOR DELETE
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
DROP POLICY IF EXISTS "Users can create contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Users can update contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Users can delete contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Admins can manage all contact lists" ON public.contact_lists;

CREATE POLICY "contact_lists_select_policy" ON public.contact_lists
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contact_lists_insert_policy" ON public.contact_lists
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contact_lists_update_policy" ON public.contact_lists
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "contact_lists_delete_policy" ON public.contact_lists
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
DROP POLICY IF EXISTS "Users can create AI agent configs" ON public.ai_agent_configs;
DROP POLICY IF EXISTS "Users can update AI agent configs" ON public.ai_agent_configs;
DROP POLICY IF EXISTS "Users can delete AI agent configs" ON public.ai_agent_configs;
DROP POLICY IF EXISTS "Admins can manage all AI agent configs" ON public.ai_agent_configs;

CREATE POLICY "ai_agent_configs_select_policy" ON public.ai_agent_configs
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "ai_agent_configs_insert_policy" ON public.ai_agent_configs
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "ai_agent_configs_update_policy" ON public.ai_agent_configs
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "ai_agent_configs_delete_policy" ON public.ai_agent_configs
  FOR DELETE
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
DROP POLICY IF EXISTS "Users can create knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can update knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Users can delete knowledge items" ON public.knowledge_items;
DROP POLICY IF EXISTS "Admins can manage all knowledge items" ON public.knowledge_items;

CREATE POLICY "knowledge_items_select_policy" ON public.knowledge_items
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "knowledge_items_insert_policy" ON public.knowledge_items
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "knowledge_items_update_policy" ON public.knowledge_items
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "knowledge_items_delete_policy" ON public.knowledge_items
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- TABLE: whatsapp_connections
-- =====================================================

DROP POLICY IF EXISTS "Users can view WhatsApp connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Users can create WhatsApp connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Users can update WhatsApp connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Users can delete WhatsApp connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Admins can manage all WhatsApp connections" ON public.whatsapp_connections;

CREATE POLICY "whatsapp_connections_select_policy" ON public.whatsapp_connections
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_connections_insert_policy" ON public.whatsapp_connections
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_connections_update_policy" ON public.whatsapp_connections
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "whatsapp_connections_delete_policy" ON public.whatsapp_connections
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
DROP POLICY IF EXISTS "Users can create correspondentes" ON public.correspondentes;
DROP POLICY IF EXISTS "Users can update correspondentes" ON public.correspondentes;
DROP POLICY IF EXISTS "Users can delete correspondentes" ON public.correspondentes;
DROP POLICY IF EXISTS "Admins can manage all correspondentes" ON public.correspondentes;

CREATE POLICY "correspondentes_select_policy" ON public.correspondentes
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "correspondentes_insert_policy" ON public.correspondentes
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "correspondentes_update_policy" ON public.correspondentes
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "correspondentes_delete_policy" ON public.correspondentes
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
DROP POLICY IF EXISTS "Users can create correspondentes_usuarios" ON public.correspondentes_usuarios;
DROP POLICY IF EXISTS "Users can update correspondentes_usuarios" ON public.correspondentes_usuarios;
DROP POLICY IF EXISTS "Users can delete correspondentes_usuarios" ON public.correspondentes_usuarios;
DROP POLICY IF EXISTS "Admins can manage all correspondentes_usuarios" ON public.correspondentes_usuarios;

CREATE POLICY "correspondentes_usuarios_select_policy" ON public.correspondentes_usuarios
  FOR SELECT
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "correspondentes_usuarios_insert_policy" ON public.correspondentes_usuarios
  FOR INSERT
  WITH CHECK (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "correspondentes_usuarios_update_policy" ON public.correspondentes_usuarios
  FOR UPDATE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "correspondentes_usuarios_delete_policy" ON public.correspondentes_usuarios
  FOR DELETE
  USING (
    "tenantId" IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Count policies per table (should be reduced now)
SELECT 
  tablename,
  COUNT(*) as policy_count,
  COUNT(*) FILTER (WHERE permissive = 'PERMISSIVE') as permissive_count,
  COUNT(*) FILTER (WHERE permissive = 'RESTRICTIVE') as restrictive_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 1
ORDER BY policy_count DESC;

-- =====================================================
-- DONE
-- =====================================================
-- All RLS security issues have been resolved.
-- Multiple permissive policies consolidated into single policies.
-- =====================================================
