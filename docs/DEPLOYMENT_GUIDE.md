# Guia de Deploy - PrimeZap

## Visão Geral

Este guia descreve o processo completo de deploy do PrimeZap em ambiente de produção, incluindo configuração de infraestrutura, variáveis de ambiente, migrations e monitoramento.

## Pré-requisitos

### Infraestrutura Necessária

- **Servidor**: Ubuntu 22.04 LTS ou superior (mínimo 4GB RAM, 2 vCPUs)
- **Docker**: Versão 24.0 ou superior
- **Docker Compose**: Versão 2.20 ou superior
- **Node.js**: Versão 20.x (para builds locais)
- **pnpm**: Versão 9.x
- **Domínio**: Domínio próprio com DNS configurado
- **SSL**: Certificado SSL (Let's Encrypt recomendado)

### Serviços Externos

- **Supabase**: Conta e projeto criado
- **Redis**: Instância Redis (pode ser local via Docker)
- **SMTP**: Servidor de email configurado (opcional)
- **APIs de IA**: Chaves da OpenAI e/ou Google Gemini (opcional)

## Passo 1: Preparação do Servidor

### 1.1 Atualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Instalar Docker e Docker Compose

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalação
docker --version
docker-compose --version
```

### 1.3 Configurar Firewall

```bash
# Permitir SSH, HTTP e HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Passo 2: Clonar e Configurar Projeto

### 2.1 Clonar Repositório

```bash
cd /opt
sudo git clone https://github.com/sallesarnaldo01-svg/projeto-primezap.git
sudo chown -R $USER:$USER projeto-primezap
cd projeto-primezap
```

### 2.2 Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas configurações
nano .env
```

**Variáveis Obrigatórias:**

```bash
# Domínios
VITE_APP_URL=https://seu-dominio.com
VITE_API_BASE_URL=https://api.seu-dominio.com
API_URL=https://api.seu-dominio.com
FRONTEND_ORIGIN=https://seu-dominio.com

# Portas
PORT=3001
FRONTEND_PORT=3000
HTTP_PORT=80
HTTPS_PORT=443

# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
VITE_SUPABASE_PROJECT_ID=seu_projeto_id
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# Database (do Supabase)
DATABASE_URL=postgresql://postgres:senha@db.seu-projeto.supabase.co:5432/postgres

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=senha_segura_redis
REDIS_DB=0

# JWT
JWT_SECRET=gere_um_secret_forte_aqui_min_32_caracteres
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=https://seu-dominio.com
CORS_CREDENTIALS=true

# Workers
WORKER_CONCURRENCY=5
WORKER_MAX_JOBS_PER_WORKER=10

# WhatsApp
WHATSAPP_SESSION_PATH=/app/sessions
WHATSAPP_WEBHOOK_URL=https://api.seu-dominio.com/webhooks/whatsapp
WHATSAPP_PROVIDER=baileys

# OpenAI (opcional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000

# Gemini (opcional)
GEMINI_API_KEY=sua_chave_gemini

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua_senha_app
SMTP_FROM=noreply@seu-dominio.com

# Logs
LOG_LEVEL=info
LOG_FILE=/var/log/primezap/app.log

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production

# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Grafana
GRAFANA_ENABLED=true
GRAFANA_PORT=3100
GRAFANA_ADMIN_PASSWORD=senha_forte_grafana

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads

# SSL
SSL_CERT_PATH=/etc/letsencrypt/live/seu-dominio.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/seu-dominio.com/privkey.pem

# Admin User
ADMIN_EMAIL=admin@seu-dominio.com
ADMIN_PASSWORD=senha_forte_admin
ADMIN_NAME=Administrador

# Node Environment
NODE_ENV=production
```

## Passo 3: Configurar SSL com Let's Encrypt

### 3.1 Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 3.2 Obter Certificado

```bash
sudo certbot certonly --standalone -d seu-dominio.com -d api.seu-dominio.com
```

### 3.3 Configurar Renovação Automática

```bash
sudo crontab -e

# Adicionar linha:
0 3 * * * certbot renew --quiet --post-hook "docker-compose restart nginx"
```

## Passo 4: Build e Deploy

### 4.1 Instalar Dependências

```bash
# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar pnpm
npm install -g pnpm@9

# Instalar dependências do projeto
pnpm install
```

### 4.2 Executar Migrations do Prisma

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma generate
cd ../..
```

### 4.3 Build da Aplicação

```bash
# Build de todos os apps
pnpm build:all
```

### 4.4 Iniciar com Docker Compose

```bash
# Build das imagens Docker
docker-compose build

# Iniciar serviços
docker-compose up -d

# Verificar status
docker-compose ps
```

## Passo 5: Validação do Deploy

### 5.1 Executar Script de Validação

```bash
bash scripts/validate-production-env.sh
```

### 5.2 Verificar Logs

```bash
# Logs da API
docker-compose logs -f api

# Logs do Worker
docker-compose logs -f worker

# Logs do Nginx
docker-compose logs -f nginx
```

### 5.3 Testar Endpoints

```bash
# Health check da API
curl https://api.seu-dominio.com/health

# Login de teste
curl -X POST https://api.seu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@seu-dominio.com","password":"sua_senha"}'
```

## Passo 6: Configurar Monitoramento

### 6.1 Acessar Grafana

```
https://seu-dominio.com:3100
```

Credenciais padrão:
- **Usuário**: admin
- **Senha**: Definida em `GRAFANA_ADMIN_PASSWORD`

### 6.2 Importar Dashboards

1. Acesse Grafana
2. Vá em **Dashboards** → **Import**
3. Importe os dashboards de `grafana/dashboards/`

### 6.3 Configurar Alertas

Edite `alertmanager.yml` para configurar notificações:

```yaml
route:
  receiver: 'email-alerts'

receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'ops@seu-dominio.com'
        from: 'alertas@seu-dominio.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'seu-email@gmail.com'
        auth_password: 'sua_senha_app'
```

## Passo 7: Backup e Recuperação

### 7.1 Configurar Backup Automático

```bash
# Editar crontab
crontab -e

# Adicionar backup diário às 2h da manhã
0 2 * * * cd /opt/projeto-primezap && bash scripts/infra/backup.sh --output /backups
```

### 7.2 Testar Backup

```bash
bash scripts/infra/backup.sh --output /tmp/test-backup
```

### 7.3 Restaurar de Backup

```bash
bash scripts/infra/restore.sh /backups/backup-2025-11-03.tar.gz
```

## Passo 8: Otimizações de Produção

### 8.1 Configurar Nginx para Cache

Edite `nginx-production.conf`:

```nginx
# Cache de assets estáticos
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 8.2 Configurar Compressão

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
```

### 8.3 Limitar Conexões

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req zone=api_limit burst=20 nodelay;
```

## Passo 9: Segurança

### 9.1 Hardening de Portas

```bash
bash scripts/infra/harden-ports.sh
```

### 9.2 Configurar Fail2Ban

```bash
sudo apt install fail2ban -y

# Configurar jail para nginx
sudo nano /etc/fail2ban/jail.local
```

Adicionar:

```ini
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
```

### 9.3 Atualizar Regularmente

```bash
# Criar script de atualização
cat > /opt/update-primezap.sh << 'EOF'
#!/bin/bash
cd /opt/projeto-primezap
git pull
pnpm install
pnpm build:all
docker-compose build
docker-compose up -d
EOF

chmod +x /opt/update-primezap.sh
```

## Passo 10: Troubleshooting

### Problema: Serviços não iniciam

```bash
# Verificar logs
docker-compose logs

# Verificar recursos
docker stats

# Reiniciar serviços
docker-compose restart
```

### Problema: Erro de conexão com banco

```bash
# Testar conexão
psql "$DATABASE_URL"

# Verificar migrations
cd apps/api && pnpm exec prisma migrate status
```

### Problema: WhatsApp não conecta

```bash
# Limpar sessões antigas
rm -rf sessions/*

# Reiniciar API
docker-compose restart api

# Gerar novo QR Code
curl https://api.seu-dominio.com/api/whatsapp/qr
```

## Checklist de Go-Live

- [ ] Servidor configurado e atualizado
- [ ] Docker e Docker Compose instalados
- [ ] Variáveis de ambiente configuradas
- [ ] SSL configurado e funcionando
- [ ] Migrations do Prisma executadas
- [ ] Build da aplicação concluído
- [ ] Serviços Docker rodando
- [ ] Script de validação passou sem erros
- [ ] Endpoints da API respondendo
- [ ] Monitoramento (Grafana) configurado
- [ ] Backup automático configurado
- [ ] Firewall configurado
- [ ] DNS apontando corretamente
- [ ] Testes de carga realizados
- [ ] Documentação atualizada
- [ ] Equipe treinada

## Suporte

Para problemas durante o deploy:

1. Consulte os logs: `docker-compose logs -f`
2. Execute o script de validação: `bash scripts/validate-production-env.sh`
3. Verifique a documentação: `docs/`
4. Abra uma issue no GitHub

## Manutenção Contínua

### Atualizações Semanais

```bash
# Atualizar código
git pull

# Atualizar dependências
pnpm update

# Rebuild e restart
pnpm build:all
docker-compose up -d --build
```

### Monitoramento Diário

- Verificar dashboards do Grafana
- Revisar logs de erro
- Verificar uso de recursos (CPU, RAM, disco)
- Validar backups

### Auditorias Mensais

- Revisar logs de segurança
- Atualizar dependências com vulnerabilidades
- Testar processo de recuperação de backup
- Revisar e otimizar queries lentas

---

**Última atualização**: 03/11/2025  
**Versão**: 1.0.0
