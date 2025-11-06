DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'app_role'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'CREATE TYPE public.app_role AS ENUM (''admin'', ''manager'', ''agent'', ''viewer'')';
  ELSE
    RAISE NOTICE 'Skipping enum public.app_role because it already exists.';
  END IF;
END;
$$;

-- Criar tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE 'Skipping RLS enable on public.user_roles because the table does not exist.';
  END IF;
END;
$$;

-- Criar função security definer para verificar roles
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles';
    EXECUTE $policy$
      CREATE POLICY "Users can view own roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles';
    EXECUTE $policy$
      CREATE POLICY "Admins can manage all roles"
      ON public.user_roles
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'))
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping user_roles policies because the table does not exist.';
  END IF;
END;
$$;

-- Inserir role admin para o primeiro usuário (ajustar UUID conforme necessário)
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('YOUR-USER-UUID-HERE', 'admin');
