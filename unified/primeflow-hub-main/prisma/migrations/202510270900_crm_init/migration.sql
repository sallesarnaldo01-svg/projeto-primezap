-- CRM initial objects: empreendimentos, correspondentes, correspondentes_usuarios,
-- pre_cadastros, documentos_pre_cadastro, documento_tipos and helper function
-- Safe/idempotent where possible to support repeated deploys.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Empreendimentos
CREATE TABLE IF NOT EXISTS public.empreendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  endereco text NULL,
  descricao text NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empreendimentos_tenant_idx ON public.empreendimentos(tenant_id);

-- Correspondentes
CREATE TABLE IF NOT EXISTS public.correspondentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  razao_social text NOT NULL,
  cnpj text NULL,
  contato text NULL,
  email text NULL,
  status text DEFAULT 'ATIVO',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correspondentes_tenant_idx ON public.correspondentes(tenant_id);

-- Correspondentes usuários
CREATE TABLE IF NOT EXISTS public.correspondentes_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  correspondente_id uuid NOT NULL REFERENCES public.correspondentes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correspondentes_usuarios_tenant_idx ON public.correspondentes_usuarios(tenant_id);

-- Pré-cadastros
CREATE TABLE IF NOT EXISTS public.pre_cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  status text DEFAULT 'NOVA_AVALIACAO',
  empreendimento text NULL,
  bloco text NULL,
  unidade text NULL,
  renda_mensal numeric(12,2) NULL,
  renda_familiar numeric(12,2) NULL,
  prestacao_valor numeric(12,2) NULL,
  avaliacao_valor numeric(12,2) NULL,
  aprovado_valor numeric(12,2) NULL,
  subsidio_valor numeric(12,2) NULL,
  fgts_valor numeric(12,2) NULL,
  prazo_meses integer NULL,
  vencimento_aprovacao timestamptz NULL,
  lead_id uuid NULL,
  lead_name text NULL,
  correspondente_id uuid NULL,
  correspondente_usuario_id uuid NULL,
  correspondente_name text NULL,
  observacoes text NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pre_cadastros_tenant_idx ON public.pre_cadastros(tenant_id);

-- Documentos do pré-cadastro
CREATE TABLE IF NOT EXISTS public.documentos_pre_cadastro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pre_cadastro_id uuid NULL REFERENCES public.pre_cadastros(id) ON DELETE SET NULL,
  lead_id uuid NULL,
  deal_id uuid NULL,
  tipo text NULL,
  pessoa text NULL,
  status text DEFAULT 'PENDENTE',
  url text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documentos_pre_cadastro_tenant_idx ON public.documentos_pre_cadastro(tenant_id);

-- Tipos de documentos
CREATE TABLE IF NOT EXISTS public.documento_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  etapa text NOT NULL,
  obrigatorio boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS documento_tipos_tenant_idx ON public.documento_tipos(tenant_id);

-- Função de percentual de documentos aprovados
CREATE OR REPLACE FUNCTION public.calcular_percentual_documentos(p_pre_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_total integer := 0;
  v_aprov integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.documentos_pre_cadastro WHERE pre_cadastro_id = p_pre_id;
  IF v_total = 0 THEN
    RETURN 0;
  END IF;
  SELECT COUNT(*) INTO v_aprov FROM public.documentos_pre_cadastro WHERE pre_cadastro_id = p_pre_id AND status = 'APROVADO';
  RETURN ROUND((v_aprov * 100.0) / v_total);
END;
$$;

