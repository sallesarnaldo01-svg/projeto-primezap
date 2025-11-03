-- Function to generate sequential number for pre_cadastros per tenant
-- Adds helper sequence table and function. Idempotent creation.

-- Auxiliary table to store per-tenant counters
CREATE TABLE IF NOT EXISTS public.seq_pre_cadastros (
  tenant_id uuid PRIMARY KEY,
  current_value bigint NOT NULL DEFAULT 0
);

-- Function: returns next formatted number for a tenant
CREATE OR REPLACE FUNCTION public.generate_pre_cadastro_numero(p_tenant_id uuid)
RETURNS text AS $$
DECLARE
  next_val bigint;
  result text;
BEGIN
  LOOP
    -- try update existing row
    UPDATE public.seq_pre_cadastros SET current_value = current_value + 1 WHERE tenant_id = p_tenant_id RETURNING current_value INTO next_val;
    IF FOUND THEN
      EXIT;
    END IF;
    -- insert if not exists
    BEGIN
      INSERT INTO public.seq_pre_cadastros (tenant_id, current_value) VALUES (p_tenant_id, 1) RETURNING current_value INTO next_val;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- someone else inserted; retry
    END;
  END LOOP;

  -- Format: PC-YYYY-XXXXX (zero-padded)
  result := 'PC-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 5, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Optional column to store the generated number
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pre_cadastros' AND column_name = 'numero'
  ) THEN
    ALTER TABLE public.pre_cadastros ADD COLUMN numero text;
  END IF;
END $$;

