-- ============================================
-- MIGRATION 001: Core Tables (Multi-tenancy + Users)
-- ============================================

-- 0. GUARANTEE EXTENSIONS AND AUTH SCHEMA (for self-hosted environments)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS storage';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage schema creation due to missing privileges.';
  END;
END;
$$;

DO $$
BEGIN
  IF has_schema_privilege('storage', 'CREATE') THEN
    EXECUTE $ddl$
      CREATE TABLE IF NOT EXISTS storage.buckets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner UUID,
          public BOOLEAN DEFAULT false,
          file_size_limit BIGINT,
          allowed_mime_types TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping storage.buckets creation due to missing CREATE privilege on storage schema.';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.buckets creation due to insufficient privileges.';
END;
$$;

DO $$
BEGIN
  IF has_schema_privilege('storage', 'CREATE') THEN
    EXECUTE $ddl$
      CREATE TABLE IF NOT EXISTS storage.objects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          owner UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping storage.objects creation due to missing CREATE privilege on storage schema.';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects creation due to insufficient privileges.';
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_foldername(path TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(path, '/');
$$;
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS auth';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping auth schema creation due to missing privileges.';
  END;
END;
$$;

DO $$
BEGIN
  IF has_schema_privilege('auth', 'CREATE') THEN
    EXECUTE $ddl$
      CREATE TABLE IF NOT EXISTS auth.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE,
          raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
          raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping auth.users creation due to missing CREATE privilege on auth schema.';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping auth.users creation due to insufficient privileges.';
END;
$$;

DO $$
BEGIN
  IF has_schema_privilege('auth', 'CREATE') THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $fn$
        SELECT nullif(current_setting('app.current_user', true), '')::uuid
      $fn$
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping auth.uid() definition due to missing CREATE privilege on auth schema.';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping auth.uid() definition due to insufficient privileges.';
END;
$$;

-- 1. CREATE ENUMS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'app_role'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent', 'viewer');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'queue_status'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.queue_status AS ENUM ('active', 'paused', 'closed');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'connection_type'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.connection_type AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'WEBCHAT');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'connection_status'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.connection_status AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          domain TEXT,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.tenants creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          avatar TEXT,
          role app_role DEFAULT 'agent',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.users creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          role app_role NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE (user_id, role)
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.user_roles creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          full_name TEXT,
          phone TEXT,
          bio TEXT,
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.profiles creation because the table already exists.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'queues'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.queues (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          status queue_status DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.queues creation because the table already exists.';
  END IF;
END;
$$;

-- 7. CONNECTIONS TABLE (WhatsApp, Facebook, Instagram)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'connections'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type connection_type NOT NULL,
          status connection_status DEFAULT 'DISCONNECTED',
          config JSONB DEFAULT '{}',
          phone TEXT,
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.connections creation because the table already exists.';
  END IF;
END;
$$;

-- 8. TAGS TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tags'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.tags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#3b82f6',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE (tenant_id, name)
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.tags creation because the table already exists.';
  END IF;
END;
$$;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTION (for role checks)
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = _user_id
$$;

-- ============================================
-- RLS POLICIES - TENANT ISOLATION
-- ============================================

-- USERS: View own tenant
DROP POLICY IF EXISTS "Users can view own tenant users" ON public.users;
CREATE POLICY "Users can view own tenant users"
ON public.users FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- USER_ROLES: View own roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES: Full access to own profile
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles';
    EXECUTE $policy$
      CREATE POLICY "Users can manage own profile"
      ON public.profiles FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping policy "Users can manage own profile" because column public.profiles.user_id does not exist.';
  END IF;
END;
$$;

-- QUEUES: Tenant isolation
DROP POLICY IF EXISTS "Users can view own tenant queues" ON public.queues;
CREATE POLICY "Users can view own tenant queues"
ON public.queues FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage queues" ON public.queues;
CREATE POLICY "Admins can manage queues"
ON public.queues FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- CONNECTIONS: Tenant isolation
DROP POLICY IF EXISTS "Users can view own tenant connections" ON public.connections;
CREATE POLICY "Users can view own tenant connections"
ON public.connections FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage connections" ON public.connections;
CREATE POLICY "Admins can manage connections"
ON public.connections FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- TAGS: Tenant isolation
DROP POLICY IF EXISTS "Users can view own tenant tags" ON public.tags;
CREATE POLICY "Users can view own tenant tags"
ON public.tags FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create tags" ON public.tags;
CREATE POLICY "Users can create tags"
ON public.tags FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ============================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_queues_updated_at ON public.queues;
CREATE TRIGGER update_queues_updated_at
BEFORE UPDATE ON public.queues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_connections_updated_at ON public.connections;
CREATE TRIGGER update_connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
