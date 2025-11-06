-- CRM Modules baseline (Pré-Cadastros, Documentos, Correspondentes, Empreendimentos, Simulações, Interações)
-- Safe extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Empreendimentos
CREATE TABLE IF NOT EXISTS public.empreendimentos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  endereco text,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empreendimentos_tenant_idx ON public.empreendimentos(tenant_id);

-- Correspondentes (empresas)
CREATE TABLE IF NOT EXISTS public.correspondentes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  razao_social text NOT NULL,
  cnpj text,
  contato text,
  email text,
  status text NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correspondentes_tenant_idx ON public.correspondentes(tenant_id);

-- Correspondentes usuários
CREATE TABLE IF NOT EXISTS public.correspondentes_usuarios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correspondentes_usuarios_tenant_idx ON public.correspondentes_usuarios(tenant_id);

-- Pré-cadastros
CREATE TABLE IF NOT EXISTS public.pre_cadastros (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'NOVA_AVALIACAO',
  empreendimento text,
  bloco text,
  unidade text,
  renda_mensal numeric,
  renda_familiar numeric,
  prestacao_valor numeric,
  avaliacao_valor numeric,
  aprovado_valor numeric,
  subsidio_valor numeric,
  fgts_valor numeric,
  prazo_meses int,
  vencimento_aprovacao timestamptz,
  lead_id uuid,
  lead_name text,
  correspondente_id uuid,
  correspondente_usuario_id uuid,
  correspondente_name text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pre_cadastros_tenant_idx ON public.pre_cadastros(tenant_id);

-- Documentos do pré-cadastro (genérico)
CREATE TABLE IF NOT EXISTS public.documentos_pre_cadastro (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  pre_cadastro_id uuid,
  lead_id uuid,
  deal_id uuid,
  tipo text,
  pessoa text,
  status text NOT NULL DEFAULT 'PENDENTE',
  url text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documentos_pre_cadastro_tenant_idx ON public.documentos_pre_cadastro(tenant_id);

-- Tipos de documento (config)
CREATE TABLE IF NOT EXISTS public.documento_tipos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  etapa text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS documento_tipos_tenant_idx ON public.documento_tipos(tenant_id);

-- Aprovacoes (histórico)
CREATE TABLE IF NOT EXISTS public.aprovacoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  pre_cadastro_id uuid NOT NULL,
  status text NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aprovacoes_tenant_idx ON public.aprovacoes(tenant_id);

-- Lead interactions (timeline)
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  type text NOT NULL,
  content text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_interactions_tenant_idx ON public.lead_interactions(tenant_id);

-- Simulações de financiamento
CREATE TABLE IF NOT EXISTS public.simulacoes_financiamento (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  lead_id uuid,
  pre_cadastro_id uuid,
  valor_imovel numeric NOT NULL,
  valor_entrada numeric NOT NULL,
  prazo_meses int NOT NULL,
  taxa_juros numeric NOT NULL,
  valor_fgts numeric,
  valor_subsidio numeric,
  sistema_amortizacao text NOT NULL,
  valor_financiado numeric,
  valor_prestacao numeric,
  valor_total numeric,
  renda_minima_requerida numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS simulacoes_financiamento_tenant_idx ON public.simulacoes_financiamento(tenant_id);

-- Função: percentual de documentos aprovados por pré-cadastro (0-100)
CREATE OR REPLACE FUNCTION public.calcular_percentual_documentos(p_pre_cadastro_id uuid)
RETURNS int AS $$
DECLARE
  total int;
  aprovados int;
BEGIN
  SELECT COUNT(*) INTO total FROM public.documentos_pre_cadastro WHERE pre_cadastro_id = p_pre_cadastro_id;
  IF total = 0 THEN
    RETURN 0;
  END IF;
  SELECT COUNT(*) INTO aprovados FROM public.documentos_pre_cadastro WHERE pre_cadastro_id = p_pre_cadastro_id AND status = 'APROVADO';
  RETURN ROUND((aprovados::numeric / total::numeric) * 100);
END;
$$ LANGUAGE plpgsql;

