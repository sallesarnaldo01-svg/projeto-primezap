
echo
echo "== 5) Tentar de novo com SSL_CERT_FILE =="
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
codex login --debug || true
SH

chmod +x ~/diagnostico-codex.sh
./diagnostico-codex.sh
codex
npm i -g @openai/codex
codex
codex logout
codex login
codex
codex
# ver se há processo SSH com -R 15432
ps aux | grep -E 'ssh .*(:| )15432' | grep -v grep || echo "sem ssh -R ativo"
# ver se está escutando 127.0.0.1:15432
ss -ltnp | grep 15432 || sudo netstat -ltnp | grep 15432 || echo "porta 15432 não está escutando"
# ver se há processo SSH com -R 15432
ps aux | grep -E 'ssh .*(:| )15432' | grep -v grep || echo "sem ssh -R ativo"
# ver se está escutando 127.0.0.1:15432
ss -ltnp | grep 15432 || sudo netstat -ltnp | grep 15432 || echo "porta 15432 não está escutando"
# ver se há processo SSH com -R 15432
ps aux | grep -E 'ssh .*(:| )15432' | grep -v grep || echo "sem ssh -R ativo"
# ver se está escutando 127.0.0.1:15432
ss -ltnp | grep 15432 || sudo netstat -ltnp | grep 15432 || echo "porta 15432 não está escutando"
# ver se há processo SSH com -R 15432
ps aux | grep -E 'ssh .*(:| )15432' | grep -v grep || echo "sem ssh -R ativo"
# ver se está escutando 127.0.0.1:15432
ss -ltnp | grep 15432 || sudo netstat -ltnp | grep 15432 || echo "porta 15432 não está escutando"
ssh -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 `
  -R 127.0.0.1:15432:db.pkcvpdbnygcgbgvdqton.supabase.co:5432 `
  administrator@93.127.141.223
ssh -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 `
  -R 127.0.0.1:15432:db.pkcvpdbnygcgbgvdqton.supabase.co:5432 `
  administrator@93.127.141.223
postgresql://postgres:Noemiamaesz1@127.0.0.1:15432/postgres?sslmode=require
# ver a config efetiva
sudo sshd -T | egrep 'allowtcpforwarding|gatewayports|permitopen|streamlocalbind'
# garantir que está permitido via drop-in (não mexe no arquivo principal)
echo -e "AllowTcpForwarding yes\nGatewayPorts no\nPermitOpen any\nStreamLocalBindUnlink yes" |   sudo tee /etc/ssh/sshd_config.d/forwarding.conf >/dev/null
sudo systemctl reload ssh
# ver a config efetiva
sudo sshd -T | egrep 'allowtcpforwarding|gatewayports|permitopen|streamlocalbind'
# garantir que está permitido via drop-in (não mexe no arquivo principal)
echo -e "AllowTcpForwarding yes\nGatewayPorts no\nPermitOpen any\nStreamLocalBindUnlink yes" |   sudo tee /etc/ssh/sshd_config.d/forwarding.conf >/dev/null
sudo systemctl reload ssh
codex
# 1) Garantir cliente psql disponível (caso falte)
sudo apt-get update && sudo apt-get install -y postgresql-client
# 2) Permitir encaminhamento reverso no SSHD
sudo bash -lc 'cat >/etc/ssh/sshd_config.d/99-forward.conf <<EOF
AllowTcpForwarding yes
GatewayPorts clientspecified
PermitOpen any
EOF
systemctl reload sshd || systemctl reload ssh'
# 3) Checar se as flags ficaram ativas
sudo sshd -T | grep -E 'allowtcpforwarding|gatewayports|permitopen'
mkdir -p ~/primeflow_patch && cd ~/primeflow_patch
cat > 00_fix_connections.sql <<'SQL'
-- Corrige colunas faltantes em public.connections (idempotente)
ALTER TABLE IF EXISTS public.connections
  ADD COLUMN IF NOT EXISTS access_token           text,
  ADD COLUMN IF NOT EXISTS page_id                text,
  ADD COLUMN IF NOT EXISTS instagram_account_id   text,
  ADD COLUMN IF NOT EXISTS webhook_verified       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at           timestamptz;

CREATE INDEX IF NOT EXISTS idx_connections_page_id
  ON public.connections (page_id);

CREATE INDEX IF NOT EXISTS idx_connections_instagram_account_id
  ON public.connections (instagram_account_id);
SQL

cat > 01_crm_core.sql <<'SQL'
-- Núcleo CRM: leads, deals, atividades e agenda (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  contact_id        uuid,
  name              text,
  email             text,
  phone             text,
  source            text,
  status            text,
  stage             text,
  score             numeric,
  owner_user_id     uuid,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Histórico de status
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text,
  changed_by  uuid,
  changed_at  timestamptz DEFAULT now()
);

-- Timeline do lead
CREATE TABLE IF NOT EXISTS public.lead_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id   uuid,
  role        text,
  content     text,
  created_at  timestamptz DEFAULT now()
);

-- Deals
CREATE TABLE IF NOT EXISTS public.deals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title         text NOT NULL,
  amount        numeric,
  stage         text,
  owner_user_id uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Atividades do Deal
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  kind        text,
  payload     jsonb,
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Agenda
CREATE TABLE IF NOT EXISTS public.schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  lead_id     uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title       text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  status      text DEFAULT 'scheduled',
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_tenant     ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant     ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON public.schedules(tenant_id);
SQL

cat > 02_segmentation.sql <<'SQL'
-- Segmentação: listas e tags (idempotente)

CREATE TABLE IF NOT EXISTS public.contact_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_list_members (
  list_id     uuid NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id  uuid,
  lead_id     uuid,
  added_at    timestamptz DEFAULT now(),
  PRIMARY KEY (list_id, contact_id, lead_id)
);

CREATE TABLE IF NOT EXISTS public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.tag_links (
  tag_id      uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  contact_id  uuid,
  lead_id     uuid,
  deal_id     uuid,
  PRIMARY KEY (tag_id, contact_id, lead_id, deal_id)
);
SQL

cat > primeflow_apply_patch.sh <<'SH'
#!/bin/bash
set -euo pipefail

# Premissas fornecidas
: "${DATABASE_URL:?Defina DATABASE_URL (ex: postgresql://postgres:Noemiamaesz1@127.0.0.1:15432/postgres?sslmode=require)}"
APP_ROOT="${APP_ROOT:-/home/administrator/PrimeZapAI}"

echo "🔗 DATABASE_URL=$DATABASE_URL"
echo "📁 APP_ROOT=$APP_ROOT"
echo "➡️  Aplicando migrations SQL idempotentes..."
psql "$DATABASE_URL" -f 00_fix_connections.sql
psql "$DATABASE_URL" -f 01_crm_core.sql
psql "$DATABASE_URL" -f 02_segmentation.sql

echo "🧩 Prisma generate + migrate deploy..."
if [ -d "$APP_ROOT/apps/api" ]; then
  pushd "$APP_ROOT/apps/api" >/dev/null
  npm ci --no-audit --no-fund || npm install
  npx prisma generate
  npx prisma migrate deploy
  npm run build || true
  popd >/dev/null
else
  echo "⚠️  Diretório $APP_ROOT/apps/api não encontrado (ajuste APP_ROOT)."
fi

echo "⚙️  Worker build..."
if [ -d "$APP_ROOT/apps/worker" ]; then
  pushd "$APP_ROOT/apps/worker" >/dev/null
  npm ci --no-audit --no-fund || npm install
  npm run build || true
  popd >/dev/null
fi

echo "♻️  Reload de serviços (PM2 se existir)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload all || true
  pm2 save || true
  pm2 status || true
else
  echo "ℹ️  PM2 não encontrado; se usa Docker, rode: docker compose up -d --build"
fi

echo "🩺 Health checks..."
curl -fsS http://localhost:3000/healthz || echo 'healthz falhou (verifique porta/API)'
curl -fsS http://localhost:3000/api/integrations || echo '/api/integrations falhou (logs?)'

echo "✅ Patch concluído."
SH

chmod +x primeflow_apply_patch.sh
# 3.1 Apontar para o túnel
export DATABASE_URL='postgresql://postgres:Noemiamaesz1@127.0.0.1:15432/postgres?sslmode=require'
# 3.2 Teste rápido (tem que responder)
psql "$DATABASE_URL" -c "select inet_server_addr(), inet_client_addr(), now();"
# 3.3 Rodar o script unificado
cd ~/primeflow_patch
./primeflow_apply_patch.sh
# /api/integrations NÃO deve mais dar 500
curl -fsS http://localhost:3000/api/integrations | head
# conferir colunas em connections
psql "$DATABASE_URL" -c "\d+ public.connections"
# logs
pm2 logs --lines 200 || true
# (ou) docker compose logs -f api worker
cat > 00_fix_connections.sql <<'SQL'
-- Tabela connections mínima para a API funcionar (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.connections (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid,
  provider                 text,        -- ex.: whatsapp|facebook|instagram
  channel                  text,        -- ex.: inbox|bot etc (se usado)
  phone                    text,        -- se aplicável
  access_token             text,
  page_id                  text,
  instagram_account_id     text,
  webhook_verified         boolean DEFAULT false,
  last_sync_at             timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- Garante colunas exigidas pela API (idempotente)
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS access_token         text,
  ADD COLUMN IF NOT EXISTS page_id              text,
  ADD COLUMN IF NOT EXISTS instagram_account_id text,
  ADD COLUMN IF NOT EXISTS webhook_verified     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at         timestamptz;

CREATE INDEX IF NOT EXISTS idx_connections_provider
  ON public.connections (provider);

CREATE INDEX IF NOT EXISTS idx_connections_page_id
  ON public.connections (page_id);

CREATE INDEX IF NOT EXISTS idx_connections_instagram_account_id
  ON public.connections (instagram_account_id);
SQL

cat > 01_crm_core.sql <<'SQL'
-- Núcleo CRM: leads, deals, atividades e agenda (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  contact_id        uuid,
  name              text,
  email             text,
  phone             text,
  source            text,
  status            text,
  stage             text,
  score             numeric,
  owner_user_id     uuid,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Histórico de status
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text,
  changed_by  uuid,
  changed_at  timestamptz DEFAULT now()
);

-- Timeline do lead
CREATE TABLE IF NOT EXISTS public.lead_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id   uuid,
  role        text,       -- 'user' | 'agent' | 'system'
  content     text,
  created_at  timestamptz DEFAULT now()
);

-- Deals
CREATE TABLE IF NOT EXISTS public.deals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title         text NOT NULL,
  amount        numeric,
  stage         text,
  owner_user_id uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Atividades do Deal
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  kind        text,       -- 'note' | 'stage_change' | 'task' | etc.
  payload     jsonb,
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Agenda
CREATE TABLE IF NOT EXISTS public.schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  lead_id     uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title       text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  status      text DEFAULT 'scheduled',
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_leads_tenant     ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant     ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON public.schedules(tenant_id);
SQL

cat > primeflow_apply_patch.sh <<'SH'
#!/bin/bash
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL (ex: postgresql://postgres:Noemiamaesz1@127.0.0.1:15432/postgres?sslmode=require)}"

# Descobrir APP_ROOT automaticamente (procura por apps/api/package.json)
discover_root() {
  for base in /home/administrator /opt /srv; do
    hit=$(find "$base" -maxdepth 6 -type f -name package.json -path "*/apps/api/*" 2>/dev/null | head -n1 || true)
    if [ -n "${hit:-}" ]; then
      dirname "$(dirname "$(dirname "$hit")")"
      return 0
    fi
  done
  return 1
}

APP_ROOT="${APP_ROOT:-}"
if [ -z "${APP_ROOT}" ]; then
  if APP_ROOT=$(discover_root); then
    echo "🔎 APP_ROOT detectado: $APP_ROOT"
  else
    echo "⚠️  Não achei apps/api. Se souber o caminho, exporte APP_ROOT e rode de novo."
    APP_ROOT="/home/administrator/PrimeZapAI"  # fallback
  fi
else
  echo "📁 APP_ROOT definido: $APP_ROOT"
fi

echo "➡️  Aplicando migrations SQL (idempotentes)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 00_fix_connections.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 01_crm_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02_segmentation.sql

if [ -d "$APP_ROOT/apps/api" ]; then
  echo "🧩 Prisma generate + migrate deploy (API)..."
  pushd "$APP_ROOT/apps/api" >/dev/null
  npm ci --no-audit --no-fund || npm install
  npx prisma generate
  npx prisma migrate deploy
  npm run build || true
  popd >/dev/null
else
  echo "⚠️  $APP_ROOT/apps/api não existe. Pulando etapa da API."
fi

if [ -d "$APP_ROOT/apps/worker" ]; then
  echo "⚙️  Build do Worker..."
  pushd "$APP_ROOT/apps/worker" >/dev/null
  npm ci --no-audit --no-fund || npm install
  npm run build || true
  popd >/dev/null
else
  echo "ℹ️  Worker não encontrado. Pulando."
fi

echo "♻️  PM2 (se existir)..."
if command -v pm2 >/dev/null 2>&1; then
  # tenta nomes comuns; ajuste depois se seus nomes forem outros
  pm2 list | grep -q api    && pm2 reload api    || true
  pm2 list | grep -q worker && pm2 reload worker || true
  pm2 save || true
  pm2 status || true
else
  echo "ℹ️  PM2 não instalado; se usar Docker, rode docker compose up -d --build no diretório do projeto."
fi

echo "🩺 Health checks locais (porta 3000)..."
curl -fsS http://localhost:3000/healthz || echo 'healthz indisponível — verifique se a API está rodando e a porta correta.'
curl -fsS http://localhost:3000/api/integrations || echo '/api/integrations indisponível — verifique logs/porta.'
echo "✅ Patch aplicado."
SH

chmod +x primeflow_apply_patch.sh
# apontar para o túnel reverso (deixe o PowerShell aberto!)
export DATABASE_URL='postgresql://postgres:Noemiamaesz1@127.0.0.1:15432/postgres?sslmode=require'
# testar conexão
psql "$DATABASE_URL" -c "select now();"
# aplicar tudo
cd ~/primeflow_patch
./primeflow_apply_patch.sh
codex
unistall codex
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://pkcvpdbnygcgbgvdqton.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
cat > ~/diagnostico-codex.sh <<'SH'
#!/usr/bin/env bash
set -e

echo "== 1) Versão do codex =="
codex --version || echo "codex não encontrado"

echo
echo "== 2) Teste HTTPS para auth.openai.com =="
curl -v https://auth.openai.com/oauth/token 2>&1 | head -n 40 || true

echo
echo "== 3) Atualizar certificados =="
sudo apt update -y
sudo apt install -y ca-certificates ntpdate
sudo update-ca-certificates

echo
echo "== 4) Acertar hora =="
sudo ntpdate pool.ntp.org || true
date

echo
echo "== 5) Tentar de novo com SSL_CERT_FILE =="
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
codex login --debug || true
SH

chmod +x ~/diagnostico-codex.sh
./diagnostico-codex.sh
find /home/administrator -maxdepth 4 -type f \( -iname 'docker-compose.yml' -o -iname 'compose.yml' \) -print
codex
