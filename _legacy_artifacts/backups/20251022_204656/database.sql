--
-- PostgreSQL database dump
--

\restrict HSAfV6rsBTqKn8VjrjD5x1OthWYaejDhbnWUbz8fJ8hHroeSKbl1ahbmECFTibg

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Ubuntu 17.6-2.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO postgres;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'agent',
    'viewer'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: connection_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.connection_status AS ENUM (
    'CONNECTED',
    'DISCONNECTED',
    'CONNECTING',
    'ERROR'
);


ALTER TYPE public.connection_status OWNER TO postgres;

--
-- Name: connection_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.connection_type AS ENUM (
    'WHATSAPP',
    'FACEBOOK',
    'INSTAGRAM',
    'WEBCHAT'
);


ALTER TYPE public.connection_type OWNER TO postgres;

--
-- Name: queue_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.queue_status AS ENUM (
    'active',
    'paused',
    'closed'
);


ALTER TYPE public.queue_status OWNER TO postgres;

--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT nullif(current_setting('app.current_user', true), '')::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO postgres;

--
-- Name: get_signed_url(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_signed_url(bucket_name text, file_path text, expires_in integer DEFAULT 3600) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  signed_url TEXT;
BEGIN
  -- This is a placeholder - actual implementation would use storage.sign_url()
  -- In practice, you'd call this from the application using the Supabase SDK
  RETURN format('https://%s/storage/v1/object/sign/%s/%s?token=...', 
    current_setting('app.supabase_url', true),
    bucket_name,
    file_path
  );
END;
$$;


ALTER FUNCTION public.get_signed_url(bucket_name text, file_path text, expires_in integer) OWNER TO postgres;

--
-- Name: get_user_tenant_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_tenant_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT tenant_id FROM public.users WHERE id = _user_id
$$;


ALTER FUNCTION public.get_user_tenant_id(_user_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Get or create default tenant
  SELECT id INTO default_tenant_id FROM public.tenants LIMIT 1;
  
  IF default_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, domain)
    VALUES ('Default Tenant', 'default.local')
    RETURNING id INTO default_tenant_id;
  END IF;

  -- Create user record
  INSERT INTO public.users (id, tenant_id, name, email, role)
  VALUES (
    NEW.id,
    default_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'agent'
  );

  -- Create profile
  INSERT INTO public.profiles (user_id, tenant_id, full_name)
  VALUES (
    NEW.id,
    default_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );

  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent');

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_conversation_last_message() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: postgres
--

CREATE FUNCTION storage.foldername(path text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT string_to_array(path, '/');
$$;


ALTER FUNCTION storage.foldername(path text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE auth.users OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: ai_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider_id uuid,
    name text NOT NULL,
    description text,
    system_prompt text NOT NULL,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 1000,
    is_active boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_agents OWNER TO postgres;

--
-- Name: ai_auto_replies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_auto_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    configuration_id uuid,
    user_id uuid NOT NULL,
    conversation_id uuid,
    message_id uuid,
    prompt text NOT NULL,
    response text NOT NULL,
    model text NOT NULL,
    tokens_used integer DEFAULT 0,
    confidence numeric(5,2),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_auto_replies OWNER TO postgres;

--
-- Name: ai_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    model text NOT NULL,
    api_key text NOT NULL,
    enabled boolean DEFAULT true,
    auto_reply boolean DEFAULT false,
    sentiment_analysis boolean DEFAULT false,
    suggestion_enabled boolean DEFAULT false,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_configurations OWNER TO postgres;

--
-- Name: ai_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    api_key text,
    model text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_providers OWNER TO postgres;

--
-- Name: ai_tools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    trigger text NOT NULL,
    endpoint text,
    parameters jsonb NOT NULL,
    response_schema jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_tools OWNER TO postgres;

--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    agent_id uuid,
    provider_id uuid,
    contact_id uuid,
    conversation_id uuid,
    model text NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer NOT NULL,
    cost numeric(10,6) DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_usage OWNER TO postgres;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    contact_id uuid,
    title character varying(255) NOT NULL,
    description text,
    scheduled_at timestamp(6) with time zone NOT NULL,
    duration_minutes integer DEFAULT 60,
    type character varying(50) DEFAULT 'other'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    location text,
    assigned_to uuid,
    reminder_minutes integer DEFAULT 30,
    reminder_sent boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: backlog_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backlog_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    sprint_id uuid,
    assigned_to uuid,
    title text NOT NULL,
    description text,
    item_type text DEFAULT 'story'::text,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'todo'::text,
    story_points integer,
    estimated_hours numeric(5,2),
    actual_hours numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.backlog_items OWNER TO postgres;

--
-- Name: broadcasts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broadcasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid,
    created_by uuid,
    name text NOT NULL,
    message_template text NOT NULL,
    target_filters jsonb,
    scheduled_at timestamp with time zone,
    status text DEFAULT 'draft'::text,
    total_contacts integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.broadcasts OWNER TO postgres;

--
-- Name: campaign_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    sequence_order integer NOT NULL,
    content text,
    type character varying(50) DEFAULT 'text'::character varying,
    media_url text,
    media_type character varying(100),
    delay_after integer DEFAULT 5,
    typing_duration integer,
    recording_duration integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_messages_type_check CHECK (((type)::text = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying])::text[])))
);


ALTER TABLE public.campaign_messages OWNER TO postgres;

--
-- Name: campaign_phrases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_phrases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text,
    tags text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.campaign_phrases OWNER TO postgres;

--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    contact_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_recipients_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'sent'::character varying, 'delivered'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.campaign_recipients OWNER TO postgres;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    integration_id uuid,
    name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    delay_between_messages integer DEFAULT 5,
    simulate_typing boolean DEFAULT true,
    simulate_recording boolean DEFAULT true,
    total_contacts integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaigns_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'scheduled'::character varying, 'running'::character varying, 'paused'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: ceremonies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ceremonies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    sprint_id uuid,
    ceremony_type text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ceremonies OWNER TO postgres;

--
-- Name: connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    type public.connection_type NOT NULL,
    status public.connection_status DEFAULT 'DISCONNECTED'::public.connection_status,
    config jsonb DEFAULT '{}'::jsonb,
    phone text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    access_token text,
    page_id text,
    instagram_account_id text,
    webhook_verified boolean DEFAULT false,
    last_sync_at timestamp(6) without time zone
);


ALTER TABLE public.connections OWNER TO postgres;

--
-- Name: contact_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    user_id uuid,
    type text,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.contact_activities OWNER TO postgres;

--
-- Name: contact_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_tags (
    contact_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.contact_tags OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    avatar text,
    source text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: conversation_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    event_type text NOT NULL,
    actor text NOT NULL,
    actor_id uuid,
    actor_name text,
    title text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    rating integer,
    feedback text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conversation_events OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid,
    connection_id uuid,
    agent_id uuid,
    assigned_to uuid,
    queue_id uuid,
    status text DEFAULT 'open'::text,
    channel text NOT NULL,
    last_message_at timestamp with time zone DEFAULT now(),
    ai_enabled boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type text NOT NULL,
    field_name text NOT NULL,
    field_type text NOT NULL,
    options jsonb,
    is_required boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.custom_fields OWNER TO postgres;

--
-- Name: deal_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_tags (
    deal_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.deal_tags OWNER TO postgres;

--
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid,
    stage_id uuid,
    owner_id uuid,
    title text NOT NULL,
    value numeric(15,2),
    currency text DEFAULT 'BRL'::text,
    probability integer DEFAULT 0,
    expected_close_date date,
    notes text,
    custom_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- Name: flow_edges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flow_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid NOT NULL,
    source_node_id uuid NOT NULL,
    target_node_id uuid NOT NULL,
    label text,
    condition jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.flow_edges OWNER TO postgres;

--
-- Name: flow_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flow_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid NOT NULL,
    contact_id uuid,
    conversation_id uuid,
    status text DEFAULT 'running'::text,
    current_node_id uuid,
    variables jsonb DEFAULT '{}'::jsonb,
    error_message text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


ALTER TABLE public.flow_executions OWNER TO postgres;

--
-- Name: flow_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flow_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid NOT NULL,
    node_type text NOT NULL,
    label text NOT NULL,
    position_x numeric(10,2) NOT NULL,
    position_y numeric(10,2) NOT NULL,
    config jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.flow_nodes OWNER TO postgres;

--
-- Name: flows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT false,
    version integer DEFAULT 1,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.flows OWNER TO postgres;

--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid,
    cadence_id uuid,
    assigned_to uuid,
    title text NOT NULL,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.follow_ups OWNER TO postgres;

--
-- Name: followup_cadences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.followup_cadences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    agent_id uuid,
    name text NOT NULL,
    description text,
    trigger_config jsonb NOT NULL,
    steps jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.followup_cadences OWNER TO postgres;

--
-- Name: integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    access_token text,
    refresh_token text,
    phone_number character varying(50),
    phone_number_id character varying(255),
    business_account_id character varying(255),
    page_id character varying(255),
    instagram_account_id character varying(255),
    webhook_url text,
    webhook_secret text,
    api_version character varying(20) DEFAULT 'v18.0'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT integrations_platform_check CHECK (((platform)::text = ANY ((ARRAY['whatsapp'::character varying, 'facebook'::character varying, 'instagram'::character varying])::text[]))),
    CONSTRAINT integrations_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'error'::character varying, 'pending'::character varying])::text[])))
);


ALTER TABLE public.integrations OWNER TO postgres;

--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    agent_id uuid,
    name text NOT NULL,
    file_type text NOT NULL,
    file_url text,
    storage_path text,
    content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    chunk_count integer DEFAULT 0,
    embedding_status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_documents OWNER TO postgres;

--
-- Name: knowledge_embeddings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding public.vector,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_embeddings OWNER TO postgres;

--
-- Name: media_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    message_id uuid,
    filename character varying(255) NOT NULL,
    mime_type character varying(100) NOT NULL,
    size_bytes integer,
    url text NOT NULL,
    thumbnail_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.media_files OWNER TO postgres;

--
-- Name: message_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broadcast_id uuid,
    conversation_id uuid,
    contact_id uuid,
    status text DEFAULT 'pending'::text,
    error_message text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.message_logs OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_type text NOT NULL,
    sender_id uuid,
    content text NOT NULL,
    message_type text DEFAULT 'text'::text,
    media_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    external_id text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    url text NOT NULL,
    storage_path text NOT NULL,
    alt_text text,
    display_order integer DEFAULT 0,
    ai_tags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_images OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    sku text,
    price numeric(15,2),
    stock integer DEFAULT 0,
    category text,
    is_active boolean DEFAULT true,
    ai_tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    full_name text,
    phone text,
    bio text,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: queues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.queues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    status public.queue_status DEFAULT 'active'::public.queue_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.queues OWNER TO postgres;

--
-- Name: scheduled_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    integration_id uuid,
    name character varying(255) NOT NULL,
    description text,
    scheduled_at timestamp(6) with time zone NOT NULL,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    contacts jsonb DEFAULT '[]'::jsonb NOT NULL,
    messages_payload jsonb DEFAULT '[]'::jsonb NOT NULL,
    delay_seconds integer DEFAULT 5,
    simulate_typing boolean DEFAULT true,
    simulate_recording boolean DEFAULT false,
    stats jsonb DEFAULT '{}'::jsonb,
    archived_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.scheduled_campaigns OWNER TO postgres;

--
-- Name: scheduled_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    job_type text NOT NULL,
    job_data jsonb NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.scheduled_jobs OWNER TO postgres;

--
-- Name: scrum_teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scrum_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.scrum_teams OWNER TO postgres;

--
-- Name: sprints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    name text NOT NULL,
    goal text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'planning'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sprints OWNER TO postgres;

--
-- Name: stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3b82f6'::text,
    display_order integer DEFAULT 0,
    is_final boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stages OWNER TO postgres;

--
-- Name: tag_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#4A90E2'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tag_categories OWNER TO postgres;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3b82f6'::text,
    created_at timestamp with time zone DEFAULT now(),
    category_id uuid,
    description text,
    category text,
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text,
    joined_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    domain text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'OPEN'::text,
    priority text DEFAULT 'MEDIUM'::text,
    category text,
    resolution text,
    contact_id uuid,
    assigned_to_id uuid,
    created_by_id uuid NOT NULL,
    conversation_id uuid,
    due_date timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    resolution_time_hours double precision,
    tags text[] DEFAULT '{}'::text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    avatar text,
    role public.app_role DEFAULT 'agent'::public.app_role,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    password_hash text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: video_calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    room_name text NOT NULL,
    host_id uuid,
    title text,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    status text DEFAULT 'scheduled'::text,
    participants jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.video_calls OWNER TO postgres;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid,
    event_type character varying(100) NOT NULL,
    platform character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    headers jsonb,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.webhook_events OWNER TO postgres;

--
-- Name: whatsapp_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatsapp_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    integration_id uuid,
    name text,
    phone text,
    qr_code text,
    status character varying(50) DEFAULT 'CONNECTING'::character varying,
    device text,
    connected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.whatsapp_connections OWNER TO postgres;

--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: postgres
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    public boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE storage.buckets OWNER TO postgres;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: postgres
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE storage.objects OWNER TO postgres;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: postgres
--

COPY auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) FROM stdin;
c36ad310-bdaa-4074-bab3-bc7f641504be	admin@primezapia.com	{}	{}	2025-10-22 15:24:09.471+00	2025-10-22 15:24:09.471+00
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
3c8a4c44-60d2-49d9-93cc-b59d93d586e1	4bb3e58a9c83eeb87e6ecbd244ee75ba2056f03301b05dd03d86a9d5ad9748e5	\N	202510041715_add_backlog_items	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 202510041715_add_backlog_items\n\nDatabase error code: 42P01\n\nDatabase error:\nERROR: relation "tenants" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \\"tenants\\" does not exist", detail: None, hint: None, position: None, where_: Some("SQL statement \\"ALTER TABLE \\"backlog_items\\"\\n      ADD CONSTRAINT backlog_items_tenant_fkey\\n      FOREIGN KEY (\\"tenantId\\") REFERENCES \\"tenants\\"(\\"id\\") ON DELETE CASCADE\\"\\nPL/pgSQL function inline_code_block line 7 at SQL statement"), schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(434), routine: Some("RangeVarGetRelidExtended") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="202510041715_add_backlog_items"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="202510041715_add_backlog_items"\n             at schema-engine/commands/src/commands/apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:244	2025-10-22 15:23:16.816249+00	2025-10-22 15:20:40.538372+00	0
d33bcb9f-158a-4073-ae8d-249c0e5bbbdf	4bb3e58a9c83eeb87e6ecbd244ee75ba2056f03301b05dd03d86a9d5ad9748e5	2025-10-22 15:23:16.8244+00	202510041715_add_backlog_items		\N	2025-10-22 15:23:16.8244+00	0
74f80063-2ef3-4717-a5d8-af271b479290	b2c830e3cd2414cdc4554e0c42b971a2167955ab85f8e174a6efe63bdb7877b5	2025-10-22 15:23:25.447806+00	202510041730_adjust_backlog_items		\N	2025-10-22 15:23:25.447806+00	0
651e7420-258a-4330-a9ff-3b1786c4c322	9f1c883f2464586d244a577114a68b1f2ed6c5169691d9cc2bcc0d5d1e35ed96	\N	20251009112839_conversations_system	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251009112839_conversations_system\n\nDatabase error code: 42703\n\nDatabase error:\nERROR: column "user_id" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42703), message: "column \\"user_id\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("indexcmds.c"), line: Some(1891), routine: Some("ComputeIndexAttrs") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251009112839_conversations_system"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20251009112839_conversations_system"\n             at schema-engine/commands/src/commands/apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:244	2025-10-22 15:26:50.209314+00	2025-10-22 15:23:44.132812+00	0
eea6b1b4-0790-4baf-bbf5-02cb63de2edc	9f1c883f2464586d244a577114a68b1f2ed6c5169691d9cc2bcc0d5d1e35ed96	2025-10-22 15:26:50.219419+00	20251009112839_conversations_system		\N	2025-10-22 15:26:50.219419+00	0
c5f2c21b-4782-4977-9ec1-750df8aef991	951873ac702fafa97d8b31319dda1466ddd2d34576f6a8ccb41353d1d7da4220	\N	202510101100_sync_core_schema	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 202510101100_sync_core_schema\n\nDatabase error code: 42703\n\nDatabase error:\nERROR: column "sprintId" of relation "backlog_items" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42703), message: "column \\"sprintId\\" of relation \\"backlog_items\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("parse_utilcmd.c"), line: Some(3441), routine: Some("transformAlterTableStmt") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="202510101100_sync_core_schema"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="202510101100_sync_core_schema"\n             at schema-engine/commands/src/commands/apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:244	2025-10-22 15:27:51.277357+00	2025-10-22 15:27:07.447456+00	0
67b6be13-8b83-481c-8f42-206e91c5a432	951873ac702fafa97d8b31319dda1466ddd2d34576f6a8ccb41353d1d7da4220	2025-10-22 15:27:51.282324+00	202510101100_sync_core_schema		\N	2025-10-22 15:27:51.282324+00	0
64c8523d-8521-456f-8f93-d90f54b0984a	c8639c697244ac22b337e705c2333266c752109a2d67119eb4997c29de000cca	2025-10-22 15:28:00.357483+00	202510101230_patch7_core_structures		\N	2025-10-22 15:28:00.357483+00	0
\.


--
-- Data for Name: ai_agents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_agents (id, tenant_id, provider_id, name, description, system_prompt, temperature, max_tokens, is_active, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_auto_replies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_auto_replies (id, configuration_id, user_id, conversation_id, message_id, prompt, response, model, tokens_used, confidence, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_configurations (id, user_id, provider, model, api_key, enabled, auto_reply, sentiment_analysis, suggestion_enabled, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_providers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_providers (id, tenant_id, name, provider, api_key, model, config, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_tools; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_tools (id, tenant_id, name, description, trigger, endpoint, parameters, response_schema, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_usage (id, tenant_id, agent_id, provider_id, contact_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, cost, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointments (id, user_id, contact_id, title, description, scheduled_at, duration_minutes, type, status, location, assigned_to, reminder_minutes, reminder_sent, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: backlog_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backlog_items (id, team_id, sprint_id, assigned_to, title, description, item_type, priority, status, story_points, estimated_hours, actual_hours, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: broadcasts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broadcasts (id, tenant_id, connection_id, created_by, name, message_template, target_filters, scheduled_at, status, total_contacts, sent_count, failed_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: campaign_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaign_messages (id, campaign_id, sequence_order, content, type, media_url, media_type, delay_after, typing_duration, recording_duration, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: campaign_phrases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaign_phrases (id, tenant_id, title, content, category, tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: campaign_recipients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaign_recipients (id, campaign_id, contact_id, status, sent_at, delivered_at, failed_at, error_message, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (id, user_id, integration_id, name, description, status, scheduled_at, started_at, completed_at, delay_between_messages, simulate_typing, simulate_recording, total_contacts, sent_count, delivered_count, failed_count, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ceremonies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ceremonies (id, team_id, sprint_id, ceremony_type, scheduled_at, duration_minutes, notes, created_at) FROM stdin;
\.


--
-- Data for Name: connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.connections (id, tenant_id, name, type, status, config, phone, is_default, created_at, updated_at, access_token, page_id, instagram_account_id, webhook_verified, last_sync_at) FROM stdin;
0edf64a1-3f55-490c-97db-74fb222091ef	00000000-0000-0000-0000-000000000001	default	WHATSAPP	ERROR	{"phone": "5511999999999", "provider": "venom", "tenantId": "00000000-0000-0000-0000-000000000001", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T15:48:39.699Z", "sessionName": "default"}	5511999999999	f	2025-10-22 15:48:39.704+00	2025-10-22 15:48:40.90492+00	\N	\N	\N	f	\N
d2f855cc-7cd4-42c6-9030-26f5573f9dae	00000000-0000-0000-0000-000000000001	default2	WHATSAPP	ERROR	{"phone": "5511988887777", "provider": "venom", "tenantId": "00000000-0000-0000-0000-000000000001", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T15:50:29.959Z", "sessionName": "default2"}	5511988887777	f	2025-10-22 15:50:29.974+00	2025-10-22 15:50:30.135974+00	\N	\N	\N	f	\N
5aa87482-c816-4b66-bb2e-79b9b7f659be	00000000-0000-0000-0000-000000000001	default3	WHATSAPP	CONNECTING	{"phone": "5511977776666", "provider": "venom", "tenantId": "00000000-0000-0000-0000-000000000001", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T15:58:37.880Z", "sessionName": "default3"}	5511977776666	f	2025-10-22 15:58:37.915+00	2025-10-22 15:58:37.915+00	\N	\N	\N	f	\N
3a122d06-0aa2-4473-b92b-48817ef98e47	00000000-0000-0000-0000-000000000001	default4	WHATSAPP	CONNECTING	{"phone": "5511966665555", "provider": "venom", "tenantId": "00000000-0000-0000-0000-000000000001", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T16:13:39.088Z", "sessionName": "default4"}	5511966665555	f	2025-10-22 16:13:39.12+00	2025-10-22 16:13:39.12+00	\N	\N	\N	f	\N
aa043d08-aca7-4e95-98d6-5f9eaeea0c97	00000000-0000-0000-0000-000000000001	QR Test 1	WHATSAPP	ERROR	{"provider": "venom", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T21:57:41.932Z"}	\N	f	2025-10-22 21:57:41.934+00	2025-10-22 22:00:46.021718+00	\N	\N	\N	f	\N
89fa4b08-45b8-40cf-a877-b7babf5569e5	00000000-0000-0000-0000-000000000001	QR Test 2	WHATSAPP	ERROR	{"provider": "venom", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T22:14:12.660Z"}	\N	f	2025-10-22 22:14:12.662+00	2025-10-22 22:17:15.669294+00	\N	\N	\N	f	\N
1a28953e-ea2e-491f-93b3-dc21b0995047	00000000-0000-0000-0000-000000000001	sess8650	WHATSAPP	ERROR	{"provider": "venom", "createdBy": "c36ad310-bdaa-4074-bab3-bc7f641504be", "requestedAt": "2025-10-22T22:54:35.308Z"}	\N	f	2025-10-22 22:54:35.31+00	2025-10-22 22:57:38.508666+00	\N	\N	\N	f	\N
\.


--
-- Data for Name: contact_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_activities (id, contact_id, user_id, type, description, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: contact_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_tags (contact_id, tag_id) FROM stdin;
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contacts (id, tenant_id, name, email, phone, avatar, source, notes, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: conversation_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversation_events (id, tenant_id, conversation_id, event_type, actor, actor_id, actor_name, title, description, metadata, rating, feedback, created_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, tenant_id, contact_id, connection_id, agent_id, assigned_to, queue_id, status, channel, last_message_at, ai_enabled, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_fields (id, tenant_id, entity_type, field_name, field_type, options, is_required, display_order, created_at) FROM stdin;
\.


--
-- Data for Name: deal_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_tags (deal_id, tag_id) FROM stdin;
\.


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, tenant_id, contact_id, stage_id, owner_id, title, value, currency, probability, expected_close_date, notes, custom_data, created_at, updated_at, closed_at) FROM stdin;
\.


--
-- Data for Name: flow_edges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flow_edges (id, flow_id, source_node_id, target_node_id, label, condition, created_at) FROM stdin;
\.


--
-- Data for Name: flow_executions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flow_executions (id, flow_id, contact_id, conversation_id, status, current_node_id, variables, error_message, started_at, completed_at) FROM stdin;
\.


--
-- Data for Name: flow_nodes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flow_nodes (id, flow_id, node_type, label, position_x, position_y, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: flows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flows (id, tenant_id, name, description, trigger_type, trigger_config, is_active, version, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: follow_ups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.follow_ups (id, tenant_id, contact_id, cadence_id, assigned_to, title, description, scheduled_at, status, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: followup_cadences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.followup_cadences (id, tenant_id, agent_id, name, description, trigger_config, steps, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: integrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.integrations (id, user_id, platform, name, status, access_token, refresh_token, phone_number, phone_number_id, business_account_id, page_id, instagram_account_id, webhook_url, webhook_secret, api_version, metadata, last_sync_at, created_at, updated_at) FROM stdin;
44b68db5-564b-467e-9f98-db913661d83d	c36ad310-bdaa-4074-bab3-bc7f641504be	whatsapp	WhatsApp Default	active	\N	\N	\N	\N	\N	\N	\N	\N	\N	v18.0	{}	\N	2025-10-22 21:17:29.465811+00	2025-10-22 21:17:29.465811+00
\.


--
-- Data for Name: knowledge_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.knowledge_documents (id, tenant_id, agent_id, name, file_type, file_url, storage_path, content, metadata, chunk_count, embedding_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: knowledge_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.knowledge_embeddings (id, document_id, chunk_index, content, embedding, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: media_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media_files (id, user_id, message_id, filename, mime_type, size_bytes, url, thumbnail_url, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: message_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_logs (id, broadcast_id, conversation_id, contact_id, status, error_message, sent_at, delivered_at, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, sender_type, sender_id, content, message_type, media_url, metadata, external_id, created_at) FROM stdin;
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_images (id, product_id, url, storage_path, alt_text, display_order, ai_tags, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, tenant_id, name, description, sku, price, stock, category, is_active, ai_tags, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, user_id, tenant_id, full_name, phone, bio, preferences, created_at, updated_at) FROM stdin;
79fe9f9b-1025-41a4-b8f8-a29137e67cc7	c36ad310-bdaa-4074-bab3-bc7f641504be	00000000-0000-0000-0000-000000000001	admin	\N	\N	{}	2025-10-22 15:24:09.473407+00	2025-10-22 15:24:09.473407+00
\.


--
-- Data for Name: queues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.queues (id, tenant_id, name, description, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: scheduled_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scheduled_campaigns (id, user_id, integration_id, name, description, scheduled_at, status, contacts, messages_payload, delay_seconds, simulate_typing, simulate_recording, stats, archived_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: scheduled_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scheduled_jobs (id, tenant_id, job_type, job_data, scheduled_at, status, attempts, max_attempts, error_message, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: scrum_teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scrum_teams (id, tenant_id, name, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sprints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sprints (id, team_id, name, goal, start_date, end_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stages (id, tenant_id, name, description, color, display_order, is_final, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tag_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tag_categories (id, tenant_id, name, color, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tags (id, tenant_id, name, color, created_at, category_id, description, category, usage_count, is_active, updated_at) FROM stdin;
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_members (team_id, user_id, role, joined_at) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, name, domain, settings, created_at, updated_at) FROM stdin;
00000000-0000-0000-0000-000000000001	PrimeZapAI	\N	{}	2025-10-22 15:24:09.438+00	2025-10-22 21:16:31.113285+00
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets (id, tenant_id, title, description, status, priority, category, resolution, contact_id, assigned_to_id, created_by_id, conversation_id, due_date, resolved_at, closed_at, resolution_time_hours, tags, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role, created_at) FROM stdin;
361b96dd-d980-4a79-9dc3-dbaa4adc4602	c36ad310-bdaa-4074-bab3-bc7f641504be	agent	2025-10-22 15:24:09.473407+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, tenant_id, name, email, avatar, role, is_active, created_at, updated_at, password_hash) FROM stdin;
c36ad310-bdaa-4074-bab3-bc7f641504be	00000000-0000-0000-0000-000000000001	Administrador Supremo	admin@primezapia.com	\N	admin	t	2025-10-22 15:24:09.473407+00	2025-10-22 21:16:31.13281+00	$2b$10$JcF3n98dtL0/f2Kvz0qRke06FMhrn/gdCr9VeyGovdR34kN5FIkNe
\.


--
-- Data for Name: video_calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_calls (id, tenant_id, room_name, host_id, title, scheduled_at, started_at, ended_at, status, participants, created_at) FROM stdin;
\.


--
-- Data for Name: webhook_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhook_events (id, integration_id, event_type, platform, payload, headers, processed, processed_at, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: whatsapp_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatsapp_connections (id, user_id, integration_id, name, phone, qr_code, status, device, connected_at, created_at, updated_at) FROM stdin;
30f56832-d13c-45ac-8ad8-301bf8d6ac31	c36ad310-bdaa-4074-bab3-bc7f641504be	44b68db5-564b-467e-9f98-db913661d83d	WhatsApp Default	\N	\N	CONNECTING	\N	\N	2025-10-22 21:17:29.691325+00	2025-10-22 21:17:29.691325+00
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: postgres
--

COPY storage.buckets (id, name, owner, public, file_size_limit, allowed_mime_types, created_at, updated_at) FROM stdin;
knowledge-docs	knowledge-docs	\N	f	52428800	{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain}	2025-10-22 15:21:39.401352+00	2025-10-22 15:21:39.401352+00
product-images	product-images	\N	t	10485760	{image/jpeg,image/png,image/webp,image/gif}	2025-10-22 15:21:39.401352+00	2025-10-22 15:21:39.401352+00
profile-avatars	profile-avatars	\N	t	5242880	{image/jpeg,image/png,image/webp}	2025-10-22 15:21:39.401352+00	2025-10-22 15:21:39.401352+00
message-media	message-media	\N	f	52428800	{image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/ogg}	2025-10-22 15:21:39.401352+00	2025-10-22 15:21:39.401352+00
media	media	\N	t	\N	\N	2025-10-22 21:12:40.539071+00	2025-10-22 21:12:40.539071+00
knowledge	knowledge	\N	f	\N	\N	2025-10-22 21:12:40.545865+00	2025-10-22 21:12:40.545865+00
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: postgres
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata) FROM stdin;
\.


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_agents ai_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_pkey PRIMARY KEY (id);


--
-- Name: ai_auto_replies ai_auto_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_auto_replies
    ADD CONSTRAINT ai_auto_replies_pkey PRIMARY KEY (id);


--
-- Name: ai_configurations ai_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_configurations
    ADD CONSTRAINT ai_configurations_pkey PRIMARY KEY (id);


--
-- Name: ai_providers ai_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_pkey PRIMARY KEY (id);


--
-- Name: ai_tools ai_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_tools
    ADD CONSTRAINT ai_tools_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: backlog_items backlog_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlog_items
    ADD CONSTRAINT backlog_items_pkey PRIMARY KEY (id);


--
-- Name: broadcasts broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_pkey PRIMARY KEY (id);


--
-- Name: campaign_messages campaign_messages_campaign_id_sequence_order_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_campaign_id_sequence_order_key UNIQUE (campaign_id, sequence_order);


--
-- Name: campaign_messages campaign_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_pkey PRIMARY KEY (id);


--
-- Name: campaign_phrases campaign_phrases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_phrases
    ADD CONSTRAINT campaign_phrases_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: ceremonies ceremonies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ceremonies
    ADD CONSTRAINT ceremonies_pkey PRIMARY KEY (id);


--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (id);


--
-- Name: contact_activities contact_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activities
    ADD CONSTRAINT contact_activities_pkey PRIMARY KEY (id);


--
-- Name: contact_tags contact_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_pkey PRIMARY KEY (contact_id, tag_id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: conversation_events conversation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_events
    ADD CONSTRAINT conversation_events_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: deal_tags deal_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_tags
    ADD CONSTRAINT deal_tags_pkey PRIMARY KEY (deal_id, tag_id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: flow_edges flow_edges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_edges
    ADD CONSTRAINT flow_edges_pkey PRIMARY KEY (id);


--
-- Name: flow_executions flow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_executions
    ADD CONSTRAINT flow_executions_pkey PRIMARY KEY (id);


--
-- Name: flow_nodes flow_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_nodes
    ADD CONSTRAINT flow_nodes_pkey PRIMARY KEY (id);


--
-- Name: flows flows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flows
    ADD CONSTRAINT flows_pkey PRIMARY KEY (id);


--
-- Name: follow_ups follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_pkey PRIMARY KEY (id);


--
-- Name: followup_cadences followup_cadences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.followup_cadences
    ADD CONSTRAINT followup_cadences_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_user_id_platform_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_platform_phone_number_key UNIQUE (user_id, platform, phone_number);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_embeddings knowledge_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_embeddings
    ADD CONSTRAINT knowledge_embeddings_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: message_logs message_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: queues queues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_pkey PRIMARY KEY (id);


--
-- Name: scheduled_campaigns scheduled_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_campaigns
    ADD CONSTRAINT scheduled_campaigns_pkey PRIMARY KEY (id);


--
-- Name: scheduled_jobs scheduled_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_pkey PRIMARY KEY (id);


--
-- Name: scrum_teams scrum_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrum_teams
    ADD CONSTRAINT scrum_teams_pkey PRIMARY KEY (id);


--
-- Name: sprints sprints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprints
    ADD CONSTRAINT sprints_pkey PRIMARY KEY (id);


--
-- Name: stages stages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_pkey PRIMARY KEY (id);


--
-- Name: tag_categories tag_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_categories
    ADD CONSTRAINT tag_categories_pkey PRIMARY KEY (id);


--
-- Name: tag_categories tag_categories_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_categories
    ADD CONSTRAINT tag_categories_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_calls video_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_calls
    ADD CONSTRAINT video_calls_pkey PRIMARY KEY (id);


--
-- Name: video_calls video_calls_room_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_calls
    ADD CONSTRAINT video_calls_room_name_key UNIQUE (room_name);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_connections whatsapp_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: postgres
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: postgres
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_agents_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_agents_tenant_id ON public.ai_agents USING btree (tenant_id);


--
-- Name: idx_ai_auto_replies_configuration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_auto_replies_configuration_id ON public.ai_auto_replies USING btree (configuration_id);


--
-- Name: idx_ai_auto_replies_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_auto_replies_conversation_id ON public.ai_auto_replies USING btree (conversation_id);


--
-- Name: idx_ai_auto_replies_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_auto_replies_message_id ON public.ai_auto_replies USING btree (message_id);


--
-- Name: idx_ai_auto_replies_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_auto_replies_user_id ON public.ai_auto_replies USING btree (user_id);


--
-- Name: idx_ai_configurations_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_configurations_provider ON public.ai_configurations USING btree (provider);


--
-- Name: idx_ai_configurations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_configurations_user_id ON public.ai_configurations USING btree (user_id);


--
-- Name: idx_ai_tools_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_tools_tenant_id ON public.ai_tools USING btree (tenant_id);


--
-- Name: idx_ai_tools_trigger; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_tools_trigger ON public.ai_tools USING btree (trigger);


--
-- Name: idx_ai_usage_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_usage_created_at ON public.ai_usage USING btree (created_at DESC);


--
-- Name: idx_ai_usage_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_usage_tenant_id ON public.ai_usage USING btree (tenant_id);


--
-- Name: idx_appointments_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_contact_id ON public.appointments USING btree (contact_id);


--
-- Name: idx_appointments_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_scheduled_at ON public.appointments USING btree (scheduled_at);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_appointments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_user_id ON public.appointments USING btree (user_id);


--
-- Name: idx_backlog_items_sprint_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backlog_items_sprint_id ON public.backlog_items USING btree (sprint_id);


--
-- Name: idx_backlog_items_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backlog_items_team_id ON public.backlog_items USING btree (team_id);


--
-- Name: idx_broadcasts_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_broadcasts_tenant_id ON public.broadcasts USING btree (tenant_id);


--
-- Name: idx_ceremonies_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ceremonies_team_id ON public.ceremonies USING btree (team_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_phone ON public.contacts USING btree (phone);


--
-- Name: idx_contacts_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_tenant_id ON public.contacts USING btree (tenant_id);


--
-- Name: idx_conversation_events_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_events_conversation_id ON public.conversation_events USING btree (conversation_id);


--
-- Name: idx_conversation_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_events_created_at ON public.conversation_events USING btree (created_at DESC);


--
-- Name: idx_conversation_events_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_events_tenant_id ON public.conversation_events USING btree (tenant_id);


--
-- Name: idx_conversations_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_assigned_to ON public.conversations USING btree (assigned_to);


--
-- Name: idx_conversations_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_contact_id ON public.conversations USING btree (contact_id);


--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);


--
-- Name: idx_conversations_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_tenant_id ON public.conversations USING btree (tenant_id);


--
-- Name: idx_deals_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_owner_id ON public.deals USING btree (owner_id);


--
-- Name: idx_deals_stage_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_stage_id ON public.deals USING btree (stage_id);


--
-- Name: idx_deals_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_tenant_id ON public.deals USING btree (tenant_id);


--
-- Name: idx_flow_edges_flow_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flow_edges_flow_id ON public.flow_edges USING btree (flow_id);


--
-- Name: idx_flow_edges_source_node; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flow_edges_source_node ON public.flow_edges USING btree (source_node_id);


--
-- Name: idx_flow_edges_target_node; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flow_edges_target_node ON public.flow_edges USING btree (target_node_id);


--
-- Name: idx_flow_executions_flow_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flow_executions_flow_id ON public.flow_executions USING btree (flow_id);


--
-- Name: idx_flow_executions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flow_executions_status ON public.flow_executions USING btree (status);


--
-- Name: idx_flow_nodes_flow_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flow_nodes_flow_id ON public.flow_nodes USING btree (flow_id);


--
-- Name: idx_flows_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flows_is_active ON public.flows USING btree (is_active);


--
-- Name: idx_flows_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flows_tenant_id ON public.flows USING btree (tenant_id);


--
-- Name: idx_follow_ups_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_follow_ups_scheduled_at ON public.follow_ups USING btree (scheduled_at);


--
-- Name: idx_follow_ups_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_follow_ups_tenant_id ON public.follow_ups USING btree (tenant_id);


--
-- Name: idx_integrations_platform; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_platform ON public.integrations USING btree (platform);


--
-- Name: idx_integrations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_status ON public.integrations USING btree (status);


--
-- Name: idx_integrations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_user_id ON public.integrations USING btree (user_id);


--
-- Name: idx_knowledge_docs_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_docs_agent_id ON public.knowledge_documents USING btree (agent_id);


--
-- Name: idx_knowledge_docs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_docs_tenant_id ON public.knowledge_documents USING btree (tenant_id);


--
-- Name: idx_media_files_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_files_message_id ON public.media_files USING btree (message_id);


--
-- Name: idx_media_files_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_files_user_id ON public.media_files USING btree (user_id);


--
-- Name: idx_message_logs_broadcast_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_logs_broadcast_id ON public.message_logs USING btree (broadcast_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_products_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_tenant_id ON public.products USING btree (tenant_id);


--
-- Name: idx_scheduled_campaigns_integration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_campaigns_integration_id ON public.scheduled_campaigns USING btree (integration_id);


--
-- Name: idx_scheduled_campaigns_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_campaigns_scheduled_at ON public.scheduled_campaigns USING btree (scheduled_at);


--
-- Name: idx_scheduled_campaigns_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_campaigns_status ON public.scheduled_campaigns USING btree (status);


--
-- Name: idx_scheduled_campaigns_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_campaigns_user_id ON public.scheduled_campaigns USING btree (user_id);


--
-- Name: idx_scheduled_jobs_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_jobs_scheduled_at ON public.scheduled_jobs USING btree (scheduled_at);


--
-- Name: idx_scheduled_jobs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_jobs_tenant_id ON public.scheduled_jobs USING btree (tenant_id);


--
-- Name: idx_scrum_teams_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrum_teams_tenant_id ON public.scrum_teams USING btree (tenant_id);


--
-- Name: idx_sprints_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sprints_team_id ON public.sprints USING btree (team_id);


--
-- Name: idx_tags_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tags_category_id ON public.tags USING btree (category_id);


--
-- Name: idx_tickets_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_assigned_to ON public.tickets USING btree (assigned_to_id);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_tickets_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_tenant_id ON public.tickets USING btree (tenant_id);


--
-- Name: idx_video_calls_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_calls_tenant_id ON public.video_calls USING btree (tenant_id);


--
-- Name: idx_whatsapp_connections_integration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_whatsapp_connections_integration_id ON public.whatsapp_connections USING btree (integration_id);


--
-- Name: idx_whatsapp_connections_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_whatsapp_connections_status ON public.whatsapp_connections USING btree (status);


--
-- Name: idx_whatsapp_connections_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_whatsapp_connections_user_id ON public.whatsapp_connections USING btree (user_id);


--
-- Name: idx_objects_bucket_id; Type: INDEX; Schema: storage; Owner: postgres
--

CREATE INDEX idx_objects_bucket_id ON storage.objects USING btree (bucket_id);


--
-- Name: idx_objects_name; Type: INDEX; Schema: storage; Owner: postgres
--

CREATE INDEX idx_objects_name ON storage.objects USING btree (name);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: postgres
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: ai_agents update_ai_agents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_providers update_ai_providers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_ai_providers_updated_at BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_tools update_ai_tools_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_ai_tools_updated_at BEFORE UPDATE ON public.ai_tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: backlog_items update_backlog_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_backlog_items_updated_at BEFORE UPDATE ON public.backlog_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: broadcasts update_broadcasts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_phrases update_campaign_phrases_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_campaign_phrases_updated_at BEFORE UPDATE ON public.campaign_phrases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: connections update_connections_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_conversation_last_message_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conversation_last_message_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deals update_deals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: flow_nodes update_flow_nodes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_flow_nodes_updated_at BEFORE UPDATE ON public.flow_nodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: flows update_flows_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: follow_ups update_follow_ups_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: followup_cadences update_followup_cadences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_followup_cadences_updated_at BEFORE UPDATE ON public.followup_cadences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_documents update_knowledge_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: queues update_queues_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scheduled_jobs update_scheduled_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_scheduled_jobs_updated_at BEFORE UPDATE ON public.scheduled_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scrum_teams update_scrum_teams_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_scrum_teams_updated_at BEFORE UPDATE ON public.scrum_teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sprints update_sprints_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON public.sprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stages update_stages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_stages_updated_at BEFORE UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_agents ai_agents_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id) ON DELETE SET NULL;


--
-- Name: ai_agents ai_agents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ai_auto_replies ai_auto_replies_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_auto_replies
    ADD CONSTRAINT ai_auto_replies_configuration_id_fkey FOREIGN KEY (configuration_id) REFERENCES public.ai_configurations(id) ON DELETE SET NULL;


--
-- Name: ai_auto_replies ai_auto_replies_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_auto_replies
    ADD CONSTRAINT ai_auto_replies_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: ai_auto_replies ai_auto_replies_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_auto_replies
    ADD CONSTRAINT ai_auto_replies_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: ai_auto_replies ai_auto_replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_auto_replies
    ADD CONSTRAINT ai_auto_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_configurations ai_configurations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_configurations
    ADD CONSTRAINT ai_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_providers ai_providers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ai_tools ai_tools_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_tools
    ADD CONSTRAINT ai_tools_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: ai_usage ai_usage_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: ai_usage ai_usage_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id) ON DELETE SET NULL;


--
-- Name: ai_usage ai_usage_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: backlog_items backlog_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlog_items
    ADD CONSTRAINT backlog_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: backlog_items backlog_items_sprint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlog_items
    ADD CONSTRAINT backlog_items_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE SET NULL;


--
-- Name: backlog_items backlog_items_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backlog_items
    ADD CONSTRAINT backlog_items_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.scrum_teams(id) ON DELETE CASCADE;


--
-- Name: broadcasts broadcasts_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE SET NULL;


--
-- Name: broadcasts broadcasts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: broadcasts broadcasts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_phrases campaign_phrases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_phrases
    ADD CONSTRAINT campaign_phrases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: ceremonies ceremonies_sprint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ceremonies
    ADD CONSTRAINT ceremonies_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE SET NULL;


--
-- Name: ceremonies ceremonies_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ceremonies
    ADD CONSTRAINT ceremonies_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.scrum_teams(id) ON DELETE CASCADE;


--
-- Name: connections connections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contact_activities contact_activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activities
    ADD CONSTRAINT contact_activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_activities contact_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activities
    ADD CONSTRAINT contact_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contact_tags contact_tags_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_tags contact_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversation_events conversation_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_events
    ADD CONSTRAINT conversation_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_events conversation_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_events
    ADD CONSTRAINT conversation_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.queues(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: custom_fields custom_fields_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: deal_tags deal_tags_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_tags
    ADD CONSTRAINT deal_tags_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_tags deal_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_tags
    ADD CONSTRAINT deal_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: deals deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: deals deals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deals deals_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE SET NULL;


--
-- Name: deals deals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: flow_edges flow_edges_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_edges
    ADD CONSTRAINT flow_edges_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;


--
-- Name: flow_edges flow_edges_source_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_edges
    ADD CONSTRAINT flow_edges_source_node_id_fkey FOREIGN KEY (source_node_id) REFERENCES public.flow_nodes(id) ON DELETE CASCADE;


--
-- Name: flow_edges flow_edges_target_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_edges
    ADD CONSTRAINT flow_edges_target_node_id_fkey FOREIGN KEY (target_node_id) REFERENCES public.flow_nodes(id) ON DELETE CASCADE;


--
-- Name: flow_executions flow_executions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_executions
    ADD CONSTRAINT flow_executions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: flow_executions flow_executions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_executions
    ADD CONSTRAINT flow_executions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: flow_executions flow_executions_current_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_executions
    ADD CONSTRAINT flow_executions_current_node_id_fkey FOREIGN KEY (current_node_id) REFERENCES public.flow_nodes(id) ON DELETE SET NULL;


--
-- Name: flow_executions flow_executions_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_executions
    ADD CONSTRAINT flow_executions_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;


--
-- Name: flow_nodes flow_nodes_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flow_nodes
    ADD CONSTRAINT flow_nodes_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;


--
-- Name: flows flows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flows
    ADD CONSTRAINT flows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: flows flows_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flows
    ADD CONSTRAINT flows_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: follow_ups follow_ups_cadence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_cadence_id_fkey FOREIGN KEY (cadence_id) REFERENCES public.followup_cadences(id) ON DELETE SET NULL;


--
-- Name: follow_ups follow_ups_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: followup_cadences followup_cadences_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.followup_cadences
    ADD CONSTRAINT followup_cadences_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: followup_cadences followup_cadences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.followup_cadences
    ADD CONSTRAINT followup_cadences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: knowledge_documents knowledge_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: knowledge_embeddings knowledge_embeddings_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_embeddings
    ADD CONSTRAINT knowledge_embeddings_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: message_logs message_logs_broadcast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.broadcasts(id) ON DELETE CASCADE;


--
-- Name: message_logs message_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: message_logs message_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_logs
    ADD CONSTRAINT message_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: queues queues_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: scheduled_jobs scheduled_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: scrum_teams scrum_teams_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scrum_teams
    ADD CONSTRAINT scrum_teams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: sprints sprints_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprints
    ADD CONSTRAINT sprints_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.scrum_teams(id) ON DELETE CASCADE;


--
-- Name: stages stages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tag_categories tag_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_categories
    ADD CONSTRAINT tag_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tags tags_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tag_categories(id) ON DELETE SET NULL;


--
-- Name: tags tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.scrum_teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: video_calls video_calls_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_calls
    ADD CONSTRAINT video_calls_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: video_calls video_calls_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_calls
    ADD CONSTRAINT video_calls_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: webhook_events webhook_events_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_connections whatsapp_connections_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: whatsapp_connections whatsapp_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: postgres
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE;


--
-- Name: flows Admins can delete flows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete flows" ON public.flows FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ai_agents Admins can manage agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage agents" ON public.ai_agents TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: broadcasts Admins can manage broadcasts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage broadcasts" ON public.broadcasts TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: followup_cadences Admins can manage cadences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage cadences" ON public.followup_cadences TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: connections Admins can manage connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage connections" ON public.connections TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: custom_fields Admins can manage custom fields; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage custom fields" ON public.custom_fields TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: knowledge_documents Admins can manage documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage documents" ON public.knowledge_documents TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_images Admins can manage product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage product images" ON public.product_images TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_images.product_id) AND (p.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: products Admins can manage products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage products" ON public.products TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_providers Admins can manage providers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage providers" ON public.ai_providers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: queues Admins can manage queues; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage queues" ON public.queues TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: stages Admins can manage stages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage stages" ON public.stages TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: scrum_teams Admins can manage teams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage teams" ON public.scrum_teams TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_tools Admins can manage tools; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage tools" ON public.ai_tools TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_usage System can insert usage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert usage" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: scheduled_jobs System can manage jobs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can manage jobs" ON public.scheduled_jobs TO authenticated WITH CHECK (true);


--
-- Name: backlog_items Team members can update items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Team members can update items" ON public.backlog_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.team_members tm
  WHERE ((tm.team_id = backlog_items.team_id) AND (tm.user_id = auth.uid())))));


--
-- Name: broadcasts Users can create broadcasts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create broadcasts" ON public.broadcasts FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contacts Users can create contacts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversations Users can create conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: deals Users can create deals; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create deals" ON public.deals FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversation_events Users can create events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create events" ON public.conversation_events FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: flows Users can create flows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create flows" ON public.flows FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: follow_ups Users can create follow-ups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create follow-ups" ON public.follow_ups FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: tags Users can create tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create tags" ON public.tags FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: video_calls Users can create video calls; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create video calls" ON public.video_calls FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: flow_edges Users can manage flow edges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage flow edges" ON public.flow_edges TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: flow_nodes Users can manage flow nodes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage flow nodes" ON public.flow_nodes TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: profiles Users can manage own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own profile" ON public.profiles TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: campaign_phrases Users can manage phrases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage phrases" ON public.campaign_phrases TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversation_events Users can rate AI responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can rate AI responses" ON public.conversation_events FOR UPDATE TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: messages Users can send messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: follow_ups Users can update assigned follow-ups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update assigned follow-ups" ON public.follow_ups FOR UPDATE TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND ((assigned_to = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: contacts Users can update contacts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND ((assigned_to = auth.uid()) OR (assigned_to IS NULL) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: deals Users can update own deals; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own deals" ON public.deals FOR UPDATE TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND ((owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: flows Users can update own flows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own flows" ON public.flows FOR UPDATE TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND ((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: knowledge_documents Users can upload documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upload documents" ON public.knowledge_documents FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: backlog_items Users can view backlog items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view backlog items" ON public.backlog_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.scrum_teams st
  WHERE ((st.id = backlog_items.team_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: knowledge_embeddings Users can view embeddings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view embeddings" ON public.knowledge_embeddings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.knowledge_documents kd
  WHERE ((kd.id = knowledge_embeddings.document_id) AND (kd.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: flow_edges Users can view flow edges; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view flow edges" ON public.flow_edges FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_edges.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: flow_executions Users can view flow executions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view flow executions" ON public.flow_executions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_executions.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: flow_nodes Users can view flow nodes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view flow nodes" ON public.flow_nodes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.flows f
  WHERE ((f.id = flow_nodes.flow_id) AND (f.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: message_logs Users can view message logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view message logs" ON public.message_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.broadcasts b
  WHERE ((b.id = message_logs.broadcast_id) AND (b.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: messages Users can view messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view messages" ON public.messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: ai_agents Users can view own tenant agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant agents" ON public.ai_agents FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: broadcasts Users can view own tenant broadcasts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant broadcasts" ON public.broadcasts FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: followup_cadences Users can view own tenant cadences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant cadences" ON public.followup_cadences FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: connections Users can view own tenant connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant connections" ON public.connections FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contacts Users can view own tenant contacts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant contacts" ON public.contacts FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversations Users can view own tenant conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant conversations" ON public.conversations FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: custom_fields Users can view own tenant custom fields; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant custom fields" ON public.custom_fields FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: deals Users can view own tenant deals; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant deals" ON public.deals FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: knowledge_documents Users can view own tenant documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant documents" ON public.knowledge_documents FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversation_events Users can view own tenant events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant events" ON public.conversation_events FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: flows Users can view own tenant flows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant flows" ON public.flows FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: follow_ups Users can view own tenant follow-ups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant follow-ups" ON public.follow_ups FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: scheduled_jobs Users can view own tenant jobs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant jobs" ON public.scheduled_jobs FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: campaign_phrases Users can view own tenant phrases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant phrases" ON public.campaign_phrases FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: products Users can view own tenant products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant products" ON public.products FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_providers Users can view own tenant providers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant providers" ON public.ai_providers FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: queues Users can view own tenant queues; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant queues" ON public.queues FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: stages Users can view own tenant stages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant stages" ON public.stages FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: tags Users can view own tenant tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant tags" ON public.tags FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: scrum_teams Users can view own tenant teams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant teams" ON public.scrum_teams FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_tools Users can view own tenant tools; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant tools" ON public.ai_tools FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_usage Users can view own tenant usage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant usage" ON public.ai_usage FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: users Users can view own tenant users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant users" ON public.users FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: video_calls Users can view own tenant video calls; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tenant video calls" ON public.video_calls FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_images Users can view product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view product images" ON public.product_images FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_images.product_id) AND (p.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: sprints Users can view sprints; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view sprints" ON public.sprints FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.scrum_teams st
  WHERE ((st.id = sprints.team_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: team_members Users can view team members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view team members" ON public.team_members FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.scrum_teams st
  WHERE ((st.id = team_members.team_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: ai_agents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_providers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_tools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: backlog_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;

--
-- Name: broadcasts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_phrases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaign_phrases ENABLE ROW LEVEL SECURITY;

--
-- Name: ceremonies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ceremonies ENABLE ROW LEVEL SECURITY;

--
-- Name: connections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_fields; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: deal_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: deals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_edges; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_executions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_nodes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: flows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_ups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: followup_cadences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.followup_cadences ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_embeddings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

--
-- Name: message_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: queues; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: scrum_teams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.scrum_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: sprints; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

--
-- Name: stages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations tenant_select_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_select_conversations ON public.conversations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users u_cur
  WHERE ((u_cur.id = auth.uid()) AND (u_cur.tenant_id = conversations.tenant_id)))));


--
-- Name: messages tenant_select_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_select_messages ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.users u_cur
     JOIN public.conversations c ON ((c.id = messages.conversation_id)))
  WHERE ((u_cur.id = auth.uid()) AND (u_cur.tenant_id = c.tenant_id)))));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: video_calls; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Admins can delete product images; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'product-images'::text) AND (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role))))));


--
-- Name: objects Anyone can view avatars; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING ((bucket_id = 'profile-avatars'::text));


--
-- Name: objects Anyone can view product images; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING ((bucket_id = 'product-images'::text));


--
-- Name: objects Authenticated users can upload knowledge docs; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Authenticated users can upload knowledge docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'knowledge-docs'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: objects Authenticated users can upload message media; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Authenticated users can upload message media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'message-media'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: objects Authenticated users can upload product images; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'product-images'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: objects Users can delete own avatar; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects Users can delete own knowledge docs; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Users can delete own knowledge docs" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'knowledge-docs'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: objects Users can update own avatar; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects Users can upload own avatar; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects Users can view message media; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Users can view message media" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'message-media'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: objects Users can view own tenant knowledge docs; Type: POLICY; Schema: storage; Owner: postgres
--

CREATE POLICY "Users can view own tenant knowledge docs" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'knowledge-docs'::text) AND (auth.uid() IS NOT NULL)));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: supabase_realtime conversation_events; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.conversation_events;


--
-- Name: supabase_realtime conversations; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.conversations;


--
-- Name: supabase_realtime messages; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.messages;


--
-- PostgreSQL database dump complete
--

\unrestrict HSAfV6rsBTqKn8VjrjD5x1OthWYaejDhbnWUbz8fJ8hHroeSKbl1ahbmECFTibg

