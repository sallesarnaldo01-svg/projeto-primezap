-- ============================================
-- MIGRATION 002: CRM Tables (Leads, Deals, Contacts)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          avatar TEXT,
          source TEXT,
          notes TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.contacts creation because the table already exists.';
  END IF;
END;
$$;

-- 2. CONTACT_TAGS (many-to-many)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contact_tags'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.contact_tags (
          contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
          tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
          PRIMARY KEY (contact_id, tag_id)
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.contact_tags creation because the table already exists.';
  END IF;
END;
$$;

-- 3. CUSTOM_FIELDS (dynamic fields for leads/contacts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'custom_fields'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.custom_fields (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL, -- 'lead', 'contact', 'deal'
          field_name TEXT NOT NULL,
          field_type TEXT NOT NULL, -- 'text', 'number', 'date', 'select'
          options JSONB, -- for select type
          is_required BOOLEAN DEFAULT false,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.custom_fields creation because the table already exists.';
  END IF;
END;
$$;

-- 4. STAGES (pipeline stages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stages'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.stages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#3b82f6',
          display_order INTEGER DEFAULT 0,
          is_final BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.stages creation because the table already exists.';
  END IF;
END;
$$;

-- 5. DEALS (opportunities)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'deals'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.deals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
          stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
          owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          value DECIMAL(15,2),
          currency TEXT DEFAULT 'BRL',
          probability INTEGER DEFAULT 0,
          expected_close_date DATE,
          notes TEXT,
          custom_data JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          closed_at TIMESTAMP WITH TIME ZONE
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.deals creation because the table already exists.';
  END IF;
END;
$$;

-- 6. DEAL_TAGS (many-to-many)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'deal_tags'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.deal_tags (
          deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
          tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
          PRIMARY KEY (deal_id, tag_id)
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.deal_tags creation because the table already exists.';
  END IF;
END;
$$;

-- 7. PRODUCTS TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          sku TEXT,
          price DECIMAL(15,2),
          stock INTEGER DEFAULT 0,
          category TEXT,
          is_active BOOLEAN DEFAULT true,
          ai_tags JSONB DEFAULT '[]', -- ["foto frontal", "interior", "close-up"]
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.products creation because the table already exists.';
  END IF;
END;
$$;

-- 8. PRODUCT_IMAGES TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
  ) THEN
    EXECUTE $ddl$
      CREATE TABLE public.product_images (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          alt_text TEXT,
          display_order INTEGER DEFAULT 0,
          ai_tags JSONB DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    $ddl$;
  ELSE
    RAISE NOTICE 'Skipping public.product_images creation because the table already exists.';
  END IF;
END;
$$;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

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
      AND table_name = 'contacts'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant contacts" ON public.contacts';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant contacts"
        ON public.contacts FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts';
      EXECUTE $policy$
        CREATE POLICY "Users can create contacts"
        ON public.contacts FOR INSERT
        TO authenticated
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts';
      EXECUTE $policy$
        CREATE POLICY "Users can update contacts"
        ON public.contacts FOR UPDATE
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping contacts policies because column public.contacts.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping contacts policies because table public.contacts does not exist.';
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
      AND table_name = 'custom_fields'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'custom_fields'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant custom fields" ON public.custom_fields';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant custom fields"
        ON public.custom_fields FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage custom fields" ON public.custom_fields';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage custom fields"
        ON public.custom_fields FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping custom_fields policies because column public.custom_fields.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping custom_fields policies because table public.custom_fields does not exist.';
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
      AND table_name = 'stages'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stages'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant stages" ON public.stages';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant stages"
        ON public.stages FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage stages" ON public.stages';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage stages"
        ON public.stages FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping stages policies because column public.stages.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping stages policies because table public.stages does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'deals'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deals'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deals'
      AND column_name = 'owner_id'
  ) INTO has_owner;

  IF has_table THEN
    IF has_tenant AND has_owner THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant deals" ON public.deals';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant deals"
        ON public.deals FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Users can create deals" ON public.deals';
      EXECUTE $policy$
        CREATE POLICY "Users can create deals"
        ON public.deals FOR INSERT
        TO authenticated
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Users can update own deals" ON public.deals';
      EXECUTE $policy$
        CREATE POLICY "Users can update own deals"
        ON public.deals FOR UPDATE
        TO authenticated
        USING (
          tenant_id = public.get_user_tenant_id(auth.uid()) AND
          (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        )
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping deals policies because required columns (tenant_id, owner_id) do not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping deals policies because table public.deals does not exist.';
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
      AND table_name = 'products'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own tenant products" ON public.products';
      EXECUTE $policy$
        CREATE POLICY "Users can view own tenant products"
        ON public.products FOR SELECT
        TO authenticated
        USING (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage products" ON public.products';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage products"
        ON public.products FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping products policies because column public.products.tenant_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping products policies because table public.products does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_product_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
      AND column_name = 'product_id'
  ) INTO has_product_id;

  IF has_table THEN
    IF has_product_id THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view product images" ON public.product_images';
      EXECUTE $policy$
        CREATE POLICY "Users can view product images"
        ON public.product_images FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_images.product_id
            AND p.tenant_id = public.get_user_tenant_id(auth.uid())
          )
        )
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Admins can manage product images" ON public.product_images';
      EXECUTE $policy$
        CREATE POLICY "Admins can manage product images"
        ON public.product_images FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_images.product_id
            AND p.tenant_id = public.get_user_tenant_id(auth.uid())
          ) AND public.has_role(auth.uid(), 'admin')
        )
      $policy$;
    ELSE
      RAISE NOTICE 'Skipping product_images policies because column public.product_images.product_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping product_images policies because table public.product_images does not exist.';
  END IF;
END;
$$;

-- ============================================
-- TRIGGERS: Update updated_at
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts';
    EXECUTE 'CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_contacts_updated_at because table public.contacts does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stages'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_stages_updated_at ON public.stages';
    EXECUTE 'CREATE TRIGGER update_stages_updated_at BEFORE UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_stages_updated_at because table public.stages does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'deals'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_deals_updated_at ON public.deals';
    EXECUTE 'CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_deals_updated_at because table public.deals does not exist.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_products_updated_at ON public.products';
    EXECUTE 'CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'Skipping trigger update_products_updated_at because table public.products does not exist.';
  END IF;
END;
$$;

-- INDEXES for performance
-- ============================================

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_email BOOLEAN;
  has_phone BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contacts'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'phone'
  ) INTO has_phone;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_contacts_tenant_id because column public.contacts.tenant_id does not exist.';
    END IF;

    IF has_email THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email)';
    ELSE
      RAISE NOTICE 'Skipping index idx_contacts_email because column public.contacts.email does not exist.';
    END IF;

    IF has_phone THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone)';
    ELSE
      RAISE NOTICE 'Skipping index idx_contacts_phone because column public.contacts.phone does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping contacts indexes because table public.contacts does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_stage BOOLEAN;
  has_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'deals'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'stage_id'
  ) INTO has_stage;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'owner_id'
  ) INTO has_owner;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_tenant_id ON public.deals(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_deals_tenant_id because column public.deals.tenant_id does not exist.';
    END IF;

    IF has_stage THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON public.deals(stage_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_deals_stage_id because column public.deals.stage_id does not exist.';
    END IF;

    IF has_owner THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_deals_owner_id because column public.deals.owner_id does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping deals indexes because table public.deals does not exist.';
  END IF;
END;
$$;

DO $$
DECLARE
  has_table BOOLEAN;
  has_tenant BOOLEAN;
  has_sku BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) INTO has_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'tenant_id'
  ) INTO has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'sku'
  ) INTO has_sku;

  IF has_table THEN
    IF has_tenant THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id)';
    ELSE
      RAISE NOTICE 'Skipping index idx_products_tenant_id because column public.products.tenant_id does not exist.';
    END IF;

    IF has_sku THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku)';
    ELSE
      RAISE NOTICE 'Skipping index idx_products_sku because column public.products.sku does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping products indexes because table public.products does not exist.';
  END IF;
END;
$$;
