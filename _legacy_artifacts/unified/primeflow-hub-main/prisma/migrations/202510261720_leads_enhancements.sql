-- Leads enhancements: score, sale_probability, ultimo_contato, total_interacoes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='score'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN score int DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='sale_probability'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN sale_probability int;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ultimo_contato'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN ultimo_contato timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='total_interacoes'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN total_interacoes int DEFAULT 0;
  END IF;
END $$;
