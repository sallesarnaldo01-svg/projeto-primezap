# Guia de Configuração de Variáveis de Ambiente

**Última atualização:** 03/11/2025

## Visão Geral

Este documento descreve todas as variáveis de ambiente necessárias para o funcionamento correto do PrimeZapAI, incluindo as que precisam ser configuradas antes do lançamento em produção.

## Variáveis Críticas (Obrigatórias)

Estas variáveis **devem** estar configuradas para o sistema funcionar.

### Banco de Dados

```bash
# URL de conexão com o banco de dados
DATABASE_URL=postgresql://postgres:senha@host:5432/primeflow

# Configurações do pool de conexões
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

**Status atual:** ✅ Configurada (Supabase)

### Autenticação

```bash
# Segredo para geração de tokens JWT (mínimo 32 caracteres)
JWT_SECRET=seu_segredo_super_secreto_aqui_minimo_32_chars

# Tempo de expiração dos tokens
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

**Status atual:** ✅ Configurada

**⚠️ IMPORTANTE:** Gere um JWT_SECRET forte em produção:
```bash
openssl rand -base64 32
```

### Supabase

```bash
# URL do projeto Supabase
SUPABASE_URL=https://seu-projeto.supabase.co

# Chave de serviço (service_role) - NUNCA exponha no frontend
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Chave anônima (anon) - Pode ser exposta no frontend
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Status atual:** ✅ Configurada

### Redis

```bash
# Host do Redis
REDIS_HOST=redis

# Porta do Redis
REDIS_PORT=6379

# URL completa (alternativa)
REDIS_URL=redis://redis:6379

# Senha (opcional, mas recomendado em produção)
REDIS_PASSWORD=
```

**Status atual:** ⚠️ REDIS_PASSWORD vazia (recomendado configurar em produção)

### API e Frontend

```bash
# Porta da API
PORT=4000

# URL base da API (para o frontend)
API_URL=http://localhost:4000

# Origem permitida para CORS
FRONTEND_ORIGIN=https://primezap.primezapia.com
CORS_ORIGIN=https://primezap.primezapia.com
```

**Status atual:** ✅ Configurada

## Variáveis de IA (Opcionais mas Recomendadas)

Necessárias para funcionalidades de IA e chatbots.

### OpenAI

```bash
# Chave de API da OpenAI
OPENAI_API_KEY=sk-...

# Modelo padrão
OPENAI_MODEL=gpt-4o-mini

# Máximo de tokens por requisição
OPENAI_MAX_TOKENS=2000
```

**Status atual:** ❌ Vazia

**Como obter:**
1. Acesse https://platform.openai.com/api-keys
2. Crie uma nova chave de API
3. Adicione ao `.env`

### Google Gemini

```bash
# Chave de API do Google Gemini
GEMINI_API_KEY=AIza...
```

**Status atual:** ❌ Vazia

**Como obter:**
1. Acesse https://makersuite.google.com/app/apikey
2. Crie uma nova chave de API
3. Adicione ao `.env`

## Variáveis de Email (SMTP)

Necessárias para envio de emails (notificações, recuperação de senha, etc.).

### Configuração SMTP

```bash
# Host do servidor SMTP
SMTP_HOST=smtp.gmail.com

# Porta (587 para TLS, 465 para SSL)
SMTP_PORT=587

# Usuário (geralmente o email)
SMTP_USER=seu-email@gmail.com

# Senha ou App Password
SMTP_PASSWORD=

# Email remetente
SMTP_FROM=noreply@primezap.com
```

**Status atual:** ❌ SMTP_PASSWORD vazia

**Recomendações por provedor:**

**Gmail:**
1. Habilite "Verificação em 2 etapas"
2. Gere uma "Senha de app" em https://myaccount.google.com/apppasswords
3. Use a senha de app no `SMTP_PASSWORD`

**SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.sua_api_key_aqui
```

**Mailgun:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@seu-dominio.mailgun.org
SMTP_PASSWORD=sua_senha_mailgun
```

## Variáveis de Monitoramento (Opcionais)

### Sentry (Rastreamento de Erros)

```bash
# DSN do projeto Sentry
SENTRY_DSN=

# Ambiente (development, staging, production)
SENTRY_ENVIRONMENT=production
```

**Status atual:** ❌ Vazia

**Como configurar:**
1. Crie uma conta em https://sentry.io
2. Crie um novo projeto
3. Copie o DSN e adicione ao `.env`

### Prometheus e Grafana

```bash
# Habilitar Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Habilitar Grafana
GRAFANA_ENABLED=true
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=admin123
```

**Status atual:** ✅ Configurada

## Variáveis de WhatsApp

```bash
# Provider do WhatsApp (venom ou baileys)
WHATSAPP_PROVIDER=baileys

# Caminho para sessões
WHATSAPP_SESSION_PATH=./.wwebjs_auth

# URL para webhooks
WHATSAPP_WEBHOOK_URL=https://primezap.primezapia.com/api/webhooks/whatsapp
```

**Status atual:** ✅ Configurada

## Variáveis de Feature Flags

```bash
# Habilitar/desabilitar funcionalidades
FEATURE_FLAGS_ENABLED=true
FEATURE_AI_PANEL=true
FEATURE_CRM=true
FEATURE_ANALYTICS=true
FEATURE_WHATSAPP_AUTOMATION=true
FEATURE_ADVANCED_MONITORING=true
```

**Status atual:** ✅ Configurada

## Checklist de Configuração para Produção

- [ ] **JWT_SECRET** gerado com segurança (32+ caracteres)
- [ ] **REDIS_PASSWORD** configurada
- [ ] **OPENAI_API_KEY** configurada (se usar IA)
- [ ] **GEMINI_API_KEY** configurada (se usar IA)
- [ ] **SMTP_***  configurado (para envio de emails)
- [ ] **SENTRY_DSN** configurado (para monitoramento de erros)
- [ ] **FRONTEND_ORIGIN** atualizado para domínio de produção
- [ ] **SSL_CERT_PATH** e **SSL_KEY_PATH** configurados (se usar HTTPS)
- [ ] **GRAFANA_ADMIN_PASSWORD** alterado do padrão

## Exemplo de .env para Produção

```bash
# Banco de Dados
DATABASE_URL=postgresql://postgres:senha_forte@db.supabase.co:5432/postgres

# Autenticação
JWT_SECRET=gere_um_segredo_forte_com_openssl_rand_base64_32
JWT_EXPIRES_IN=7d

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_ANON_KEY=sua_anon_key

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=senha_redis_forte

# API
PORT=4000
FRONTEND_ORIGIN=https://app.primezap.com
NODE_ENV=production

# IA
OPENAI_API_KEY=sk-sua_chave_openai
GEMINI_API_KEY=AIza_sua_chave_gemini

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.sua_api_key_sendgrid
SMTP_FROM=noreply@primezap.com

# Monitoramento
SENTRY_DSN=https://sua_dsn@sentry.io/projeto
SENTRY_ENVIRONMENT=production
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
GRAFANA_ADMIN_PASSWORD=senha_forte_grafana

# WhatsApp
WHATSAPP_PROVIDER=baileys
WHATSAPP_WEBHOOK_URL=https://app.primezap.com/api/webhooks/whatsapp
```

## Segurança

**⚠️ NUNCA:**
- Commite o arquivo `.env` no Git
- Exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Use senhas fracas em produção
- Compartilhe credenciais via chat ou email

**✅ SEMPRE:**
- Use `.env.example` como template (sem valores sensíveis)
- Armazene credenciais em um gerenciador de senhas
- Use variáveis de ambiente do servidor em produção
- Rotacione chaves regularmente
