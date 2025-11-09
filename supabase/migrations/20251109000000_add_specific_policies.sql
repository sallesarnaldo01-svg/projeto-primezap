-- Reinstate/define RLS policies for tables that previously had none configured
-- (based on tenant memberships or ownership).

-- ai_configurations: user-scoped settings
DO $policy$
BEGIN
  IF to_regclass('public.ai_configurations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ai_configurations_owner_select ON public.ai_configurations';
    EXECUTE 'DROP POLICY IF EXISTS ai_configurations_owner_write ON public.ai_configurations';
    EXECUTE 'DROP POLICY IF EXISTS ai_configurations_service_all ON public.ai_configurations';

    EXECUTE $sql$
      CREATE POLICY ai_configurations_owner_select
      ON public.ai_configurations FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())
    $sql$;

    EXECUTE $sql$
      CREATE POLICY ai_configurations_owner_write
      ON public.ai_configurations FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $sql$;

    EXECUTE $sql$
      CREATE POLICY ai_configurations_service_all
      ON public.ai_configurations FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)
    $sql$;
  END IF;
END;
$policy$;

-- Helper function: returns TRUE when a scrum_team belongs to caller tenant
CREATE OR REPLACE FUNCTION public.__scrum_team_access(team uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = public, extensions
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.scrum_teams st
    WHERE st.id = team
      AND st.tenant_id = public.get_user_tenant_id(auth.uid())
  );
$f$;

-- backlog_items policies (team-scoped)
DO $policy$
BEGIN
  IF to_regclass('public.backlog_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS backlog_items_view ON public.backlog_items';
    EXECUTE 'DROP POLICY IF EXISTS backlog_items_manage ON public.backlog_items';

    EXECUTE $sql$
      CREATE POLICY backlog_items_view
      ON public.backlog_items FOR SELECT
      TO authenticated
      USING (public.__scrum_team_access(backlog_items.team_id))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY backlog_items_manage
      ON public.backlog_items FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = backlog_items.team_id
            AND tm.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = backlog_items.team_id
            AND tm.user_id = auth.uid()
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- team_members + sprints + ceremonies share tenant through scrum_teams
DO $policy$
BEGIN
  IF to_regclass('public.team_members') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS team_members_access ON public.team_members';
    EXECUTE $sql$
      CREATE POLICY team_members_access
      ON public.team_members FOR ALL
      TO authenticated
      USING (public.__scrum_team_access(team_members.team_id))
      WITH CHECK (public.__scrum_team_access(team_members.team_id))
    $sql$;
  END IF;

  IF to_regclass('public.sprints') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sprints_access ON public.sprints';
    EXECUTE $sql$
      CREATE POLICY sprints_access
      ON public.sprints FOR ALL
      TO authenticated
      USING (public.__scrum_team_access(sprints.team_id))
      WITH CHECK (public.__scrum_team_access(sprints.team_id))
    $sql$;
  END IF;

  IF to_regclass('public.ceremonies') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ceremonies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ceremonies_access ON public.ceremonies';
    EXECUTE $sql$
      CREATE POLICY ceremonies_access
      ON public.ceremonies FOR ALL
      TO authenticated
      USING (public.__scrum_team_access(ceremonies.team_id))
      WITH CHECK (public.__scrum_team_access(ceremonies.team_id))
    $sql$;
  END IF;
END;
$policy$;

-- campaign_messages / campaign_recipients via campaign -> user -> tenant
DO $policy$
BEGIN
  IF to_regclass('public.campaign_messages') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS campaign_messages_access ON public.campaign_messages';
    EXECUTE $sql$
      CREATE POLICY campaign_messages_access
      ON public.campaign_messages FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.campaigns c
          JOIN public.users u ON u.id = c.user_id
          WHERE c.id = campaign_messages.campaign_id
            AND u.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.campaigns c
          JOIN public.users u ON u.id = c.user_id
          WHERE c.id = campaign_messages.campaign_id
            AND u.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;

  IF to_regclass('public.campaign_recipients') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS campaign_recipients_access ON public.campaign_recipients';
    EXECUTE $sql$
      CREATE POLICY campaign_recipients_access
      ON public.campaign_recipients FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.campaigns c
          JOIN public.users u ON u.id = c.user_id
          WHERE c.id = campaign_recipients.campaign_id
            AND u.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.campaigns c
          JOIN public.users u ON u.id = c.user_id
          WHERE c.id = campaign_recipients.campaign_id
            AND u.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- contact_tags / deal_tags referencing contact/deal tenant
DO $policy$
BEGIN
  IF to_regclass('public.contact_tags') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS contact_tags_access ON public.contact_tags';
    EXECUTE $sql$
      CREATE POLICY contact_tags_access
      ON public.contact_tags FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.contacts c
          WHERE c.id = contact_tags.contact_id
            AND c.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.contacts c
          WHERE c.id = contact_tags.contact_id
            AND c.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;

  IF to_regclass('public.deal_tags') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS deal_tags_access ON public.deal_tags';
    EXECUTE $sql$
      CREATE POLICY deal_tags_access
      ON public.deal_tags FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.deals d
          WHERE d.id = deal_tags.deal_id
            AND d.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.deals d
          WHERE d.id = deal_tags.deal_id
            AND d.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- flow_nodes / flow_edges / flow_executions via parent flow tenant
DO $policy$
BEGIN
  IF to_regclass('public.flow_nodes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS flow_nodes_access ON public.flow_nodes';
    EXECUTE $sql$
      CREATE POLICY flow_nodes_access
      ON public.flow_nodes FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.flows f
          WHERE f.id = flow_nodes.flow_id
            AND f.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.flows f
          WHERE f.id = flow_nodes.flow_id
            AND f.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;

  IF to_regclass('public.flow_edges') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS flow_edges_access ON public.flow_edges';
    EXECUTE $sql$
      CREATE POLICY flow_edges_access
      ON public.flow_edges FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.flows f
          WHERE f.id = flow_edges.flow_id
            AND f.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.flows f
          WHERE f.id = flow_edges.flow_id
            AND f.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;

  IF to_regclass('public.flow_executions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS flow_executions_access ON public.flow_executions';
    EXECUTE $sql$
      CREATE POLICY flow_executions_access
      ON public.flow_executions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.flows f
          WHERE f.id = flow_executions.flow_id
            AND f.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- lead_status_history / lead_messages share tenant via leads
DO $policy$
BEGIN
  IF to_regclass('public.lead_status_history') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS lead_status_history_access ON public.lead_status_history';
    EXECUTE $sql$
      CREATE POLICY lead_status_history_access
      ON public.lead_status_history FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = lead_status_history.lead_id
            AND l.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = lead_status_history.lead_id
            AND l.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;

  IF to_regclass('public.lead_messages') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS lead_messages_access ON public.lead_messages';
    EXECUTE $sql$
      CREATE POLICY lead_messages_access
      ON public.lead_messages FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = lead_messages.lead_id
            AND l.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = lead_messages.lead_id
            AND l.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- message_logs via broadcasts.user_id
DO $policy$
BEGIN
  IF to_regclass('public.message_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS message_logs_access ON public.message_logs';
    EXECUTE $sql$
      CREATE POLICY message_logs_access
      ON public.message_logs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.broadcasts b
          JOIN public.users u ON u.id = b.user_id
          WHERE b.id = message_logs.broadcast_id
            AND u.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- messageTemplate table (camel-case, tenantId column)
DO $policy$
BEGIN
  IF to_regclass('public."messageTemplate"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."messageTemplate" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS messageTemplate_select ON public."messageTemplate"';
    EXECUTE 'DROP POLICY IF EXISTS messageTemplate_write ON public."messageTemplate"';

    EXECUTE $sql$
      CREATE POLICY messageTemplate_select
      ON public."messageTemplate" FOR SELECT
      TO authenticated
      USING ("tenantId" = public.get_user_tenant_id(auth.uid())::text)
    $sql$;

    EXECUTE $sql$
      CREATE POLICY messageTemplate_write
      ON public."messageTemplate" FOR ALL
      TO authenticated
      USING ("tenantId" = public.get_user_tenant_id(auth.uid())::text)
      WITH CHECK ("tenantId" = public.get_user_tenant_id(auth.uid())::text)
    $sql$;
  END IF;
END;
$policy$;

-- product_images join products
DO $policy$
BEGIN
  IF to_regclass('public.product_images') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS product_images_access ON public.product_images';
    EXECUTE $sql$
      CREATE POLICY product_images_access
      ON public.product_images FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_images.product_id
            AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_images.product_id
            AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- team_members already handled above but ensure service_role
DO $policy$
BEGIN
  IF to_regclass('public.team_members') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS team_members_service ON public.team_members';
    EXECUTE $sql$
      CREATE POLICY team_members_service
      ON public.team_members FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)
    $sql$;
  END IF;
END;
$policy$;

-- tenants table: restrict to admins; allow service role full
DO $policy$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenants_admin_select ON public.tenants';
    EXECUTE 'DROP POLICY IF EXISTS tenants_admin_write ON public.tenants';
    EXECUTE 'DROP POLICY IF EXISTS tenants_service_all ON public.tenants';

    EXECUTE $sql$
      CREATE POLICY tenants_admin_select
      ON public.tenants FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY tenants_admin_write
      ON public.tenants FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY tenants_service_all
      ON public.tenants FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)
    $sql$;
  END IF;
END;
$policy$;

-- webhook_events via integration ownership
DO $policy$
BEGIN
  IF to_regclass('public.webhook_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS webhook_events_access ON public.webhook_events';
    EXECUTE $sql$
      CREATE POLICY webhook_events_access
      ON public.webhook_events FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.integrations i
          JOIN public.users u ON u.id = i.user_id
          WHERE i.id = webhook_events.integration_id
            AND u.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- workflow_logs / workflow_runs via workflows
DO $policy$
BEGIN
  IF to_regclass('public.workflow_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS workflow_logs_access ON public.workflow_logs';
    EXECUTE $sql$
      CREATE POLICY workflow_logs_access
      ON public.workflow_logs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.workflow_runs wr
          JOIN public.workflows w ON w.id = wr.workflow_id
          WHERE wr.id = workflow_logs.run_id
            AND w.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;

  IF to_regclass('public.workflow_runs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS workflow_runs_access ON public.workflow_runs';
    EXECUTE $sql$
      CREATE POLICY workflow_runs_access
      ON public.workflow_runs FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.workflows w
          WHERE w.id = workflow_runs.workflow_id
            AND w.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.workflows w
          WHERE w.id = workflow_runs.workflow_id
            AND w.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;

-- tag_links: tenant via tags table
DO $policy$
BEGIN
  IF to_regclass('public.tag_links') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tag_links ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tag_links_select ON public.tag_links';
    EXECUTE 'DROP POLICY IF EXISTS tag_links_write ON public.tag_links';

    EXECUTE $sql$
      CREATE POLICY tag_links_select
      ON public.tag_links FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tags t
          WHERE t.id = tag_links.tag_id
            AND t.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY tag_links_write
      ON public.tag_links FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tags t
          WHERE t.id = tag_links.tag_id
            AND t.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.tags t
          WHERE t.id = tag_links.tag_id
            AND t.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    $sql$;
  END IF;
END;
$policy$;
