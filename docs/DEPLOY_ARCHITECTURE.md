# 🏗️ Arquitetura de Deploy - PrimeZap AI

## 📋 Visão Geral

Este documento descreve a arquitetura completa de deploy do PrimeZap AI, incluindo CI/CD com GitHub Actions, migrations automáticas via Supabase CLI e deploy via SSH com Docker.

---

## 🎯 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   Backend    │  │  Migrations  │      │
│  │  (React +    │  │  (Fastify +  │  │  (Supabase   │      │
│  │   Vite)      │  │   Prisma)    │  │    CLI)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ git push
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Build & Test                                       │  │
│  │    - Lint, TypeCheck, Tests                          │  │
│  │    - Build Frontend & Backend                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. Apply DB Migrations                               │  │
│  │    - supabase link --project-ref <REF>              │  │
│  │    - supabase db push                                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. Deploy to VPS                                     │  │
│  │    - rsync code via SSH                              │  │
│  │    - docker compose up -d --build                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SSH Deploy
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         VPS Server                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Docker Compose                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Frontend   │  │  Backend    │  │   Redis     │  │  │
│  │  │  (Nginx)    │  │  (Node.js)  │  │   (Cache)   │  │  │
│  │  │  :80, :443  │  │   :4000     │  │   :6379     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Supabase Client
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Realtime   │  │    Auth      │      │
│  │  (Database)  │  │  (WebSocket) │  │   (JWT)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes

### 1. GitHub Actions CI/CD

**Arquivo**: `.github/workflows/deploy.yml`

**Jobs**:
1. **Build & Test** - Valida código, executa testes, faz build
2. **Migrate Database** - Aplica migrations via Supabase CLI
3. **Deploy** - Faz deploy via SSH com Docker Compose
4. **Notify** - Notifica status do deploy

**Secrets Necessários**:
```bash
# SSH
SSH_HOST                    # IP ou domínio do VPS
SSH_USER                    # Usuário SSH (ex: ubuntu)
SSH_PRIVATE_KEY             # Chave privada SSH
APP_DIR                     # Diretório da aplicação (ex: /home/administrator/primezap)

# Supabase
SUPABASE_URL                # URL do projeto Supabase
SUPABASE_ANON_KEY           # Chave pública (anon key)
SUPABASE_SERVICE_ROLE_KEY   # Chave privada (service role key)
SUPABASE_ACCESS_TOKEN       # Token de acesso (Account Tokens)
SUPABASE_PROJECT_REF        # Referência do projeto (Dashboard → Settings)
SUPABASE_DB_PASSWORD        # Senha do banco

# Database
DATABASE_URL                # URL completa do PostgreSQL
DATABASE_URL_TEST           # URL para testes (opcional)

# Auth
JWT_SECRET                  # Secret para JWT

# Redis
REDIS_URL                   # URL do Redis
REDIS_PASSWORD              # Senha do Redis

# OpenAI
OPENAI_API_KEY              # Chave da API OpenAI

# Email (SMTP)
SMTP_HOST                   # Host SMTP
SMTP_PORT                   # Porta SMTP
SMTP_USER                   # Usuário SMTP
SMTP_PASS                   # Senha SMTP
SMTP_FROM                   # Email remetente

# Telegram
TELEGRAM_BOT_TOKEN          # Token do bot Telegram

# Twilio (SMS)
TWILIO_ACCOUNT_SID          # Account SID Twilio
TWILIO_AUTH_TOKEN           # Auth Token Twilio
TWILIO_PHONE_NUMBER         # Número de telefone Twilio

# Mailchimp
MAILCHIMP_API_KEY           # API Key Mailchimp
MAILCHIMP_SERVER_PREFIX     # Server prefix (ex: us1)

# Frontend
VITE_API_URL                # URL da API (ex: https://api.primezap.com)
```

### 2. Supabase Migrations

**Diretório**: `supabase/migrations/`

**Formato**: `<timestamp>_<description>.sql`

**Exemplo**:
```sql
-- 00000000000001_create_core_tables.sql
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Comandos**:
```bash
# Migrar migrations do Prisma para Supabase
./scripts/migrate-to-supabase.sh

# Link com projeto Supabase
supabase link --project-ref <PROJECT_REF>

# Aplicar migrations
supabase db push

# Ver diferenças
supabase db diff --schema public

# Gerar nova migration
supabase migration new <description>
```

### 3. Docker Compose

**Arquivo**: `docker-compose.prod.yml`

**Serviços**:
- **frontend** - Nginx servindo React build
- **api** - Backend Node.js com Fastify
- **redis** - Cache e rate limiting

**Comandos**:
```bash
# Build e start
docker compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Restart
docker compose -f docker-compose.prod.yml restart

# Stop
docker compose -f docker-compose.prod.yml down

# Ver status
docker compose -f docker-compose.prod.yml ps
```

### 4. Supabase Realtime

**Frontend**: Clientes conectam direto ao Supabase

**Hook**: `src/hooks/useSupabaseRealtime.ts`

**Exemplo de Uso**:
```typescript
import { useMessagesRealtime } from '@/hooks/useSupabaseRealtime';

function ChatComponent({ conversationId }) {
  const [messages, setMessages] = useState([]);

  // Escutar novas mensagens em tempo real
  useMessagesRealtime(conversationId, (newMessage) => {
    setMessages(prev => [...prev, newMessage]);
  });

  return <div>{/* UI */}</div>;
}
```

**Tabelas com Realtime Habilitado**:
- `messages`
- `conversations`
- `contacts`
- `leads`
- `deals`
- `notifications`

---

## 🚀 Setup Inicial

### 1. Configurar Supabase

```bash
# 1. Criar projeto no Supabase Dashboard
# 2. Anotar: SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, PROJECT_REF

# 3. Gerar Access Token
# Dashboard → Account → Access Tokens → Generate new token

# 4. Habilitar Realtime nas tabelas
# Dashboard → Table Editor → Selecionar tabela → Enable Realtime

# 5. Configurar RLS (Row Level Security)
# Dashboard → Authentication → Policies
```

### 2. Configurar VPS

```bash
# 1. Instalar Docker e Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Criar diretório da aplicação
mkdir -p /home/administrator/primezap
cd /home/administrator/primezap

# 3. Configurar SSH Key
# Adicionar chave pública ao ~/.ssh/authorized_keys

# 4. Configurar Nginx (se não usar Docker)
# Copiar nginx/primezap.conf para /etc/nginx/sites-available/
# ln -s /etc/nginx/sites-available/primezap.conf /etc/nginx/sites-enabled/
```

### 3. Configurar GitHub Secrets

```bash
# GitHub Repository → Settings → Secrets and variables → Actions → New repository secret

# Adicionar todos os secrets listados acima
```

### 4. Migrar Migrations

```bash
# Executar script de migração
./scripts/migrate-to-supabase.sh

# Verificar migrations em supabase/migrations/

# Link com Supabase
export SUPABASE_ACCESS_TOKEN=<seu-token>
supabase link --project-ref <PROJECT_REF>

# Aplicar migrations
supabase db push
```

---

## 📝 Workflow de Deploy

### Automático (via GitHub Actions)

```bash
# 1. Fazer commit e push
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 2. GitHub Actions inicia automaticamente
# - Build & Test
# - Apply Migrations
# - Deploy to VPS

# 3. Verificar status
# GitHub → Actions → Ver workflow em execução

# 4. Acessar aplicação
# https://seu-dominio.com
```

### Manual (via SSH)

```bash
# 1. Conectar ao VPS
ssh administrator@seu-vps.com

# 2. Ir para diretório da aplicação
cd /home/administrator/primezap

# 3. Pull código
git pull origin main

# 4. Aplicar migrations
supabase db push

# 5. Deploy com Docker
docker compose -f docker-compose.prod.yml up -d --build

# 6. Ver logs
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🔍 Monitoramento

### Health Checks

```bash
# API
curl http://localhost:4000/health

# Frontend
curl http://localhost/

# Redis
docker exec primezap-redis redis-cli ping
```

### Logs

```bash
# Ver logs da API
docker compose -f docker-compose.prod.yml logs -f api

# Ver logs do Frontend
docker compose -f docker-compose.prod.yml logs -f frontend

# Ver logs do Redis
docker compose -f docker-compose.prod.yml logs -f redis

# Ver todos os logs
docker compose -f docker-compose.prod.yml logs -f
```

### Métricas

```bash
# Ver uso de recursos
docker stats

# Ver containers rodando
docker ps

# Ver imagens
docker images

# Ver volumes
docker volume ls
```

---

## 🐛 Troubleshooting

### Deploy Falhou

```bash
# 1. Ver logs do GitHub Actions
# GitHub → Actions → Ver workflow falhado

# 2. Conectar ao VPS e ver logs
ssh administrator@seu-vps.com
cd /home/administrator/primezap
docker compose -f docker-compose.prod.yml logs -f

# 3. Verificar .env
cat .env

# 4. Restart containers
docker compose -f docker-compose.prod.yml restart
```

### Migrations Falharam

```bash
# 1. Ver status do Supabase
supabase status

# 2. Ver diferenças
supabase db diff --schema public

# 3. Resetar (CUIDADO: apaga dados)
supabase db reset

# 4. Aplicar novamente
supabase db push
```

### Realtime Não Funciona

```bash
# 1. Verificar se Realtime está habilitado
# Dashboard → Table Editor → Tabela → Enable Realtime

# 2. Verificar RLS
# Dashboard → Authentication → Policies

# 3. Verificar Replica Identity
# Dashboard → SQL Editor
ALTER TABLE messages REPLICA IDENTITY FULL;

# 4. Ver logs no browser console
# F12 → Console → Procurar por erros de Supabase
```

### Containers Não Iniciam

```bash
# 1. Ver logs de erro
docker compose -f docker-compose.prod.yml logs

# 2. Verificar portas em uso
sudo netstat -tulpn | grep LISTEN

# 3. Limpar containers antigos
docker compose -f docker-compose.prod.yml down
docker system prune -a

# 4. Rebuild
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

---

## 📚 Recursos Adicionais

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## 🎯 Checklist de Go-Live

- [ ] Supabase configurado (URL, keys, access token)
- [ ] VPS configurado (Docker, SSH, diretórios)
- [ ] GitHub Secrets configurados (todos os 25+ secrets)
- [ ] Migrations aplicadas (`supabase db push`)
- [ ] Realtime habilitado nas tabelas
- [ ] RLS configurado e testado
- [ ] SSL/TLS configurado (Nginx + Certbot)
- [ ] Domínio apontado para VPS
- [ ] Health checks funcionando
- [ ] Logs e monitoramento configurados
- [ ] Backup automático configurado
- [ ] Testes de carga realizados
- [ ] Documentação atualizada

---

<div align="center">

**Arquitetura implementada com ❤️ pela equipe PrimeZap AI**

**Versão**: 1.0.0  
**Data**: 04/11/2024

</div>
