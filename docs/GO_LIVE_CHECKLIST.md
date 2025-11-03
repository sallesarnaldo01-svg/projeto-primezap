# Checklist de Go-Live - PrimeZap AI

**Data de Criação**: 03/11/2025  
**Versão**: 1.0

Este checklist garante que todos os aspectos críticos foram validados antes do lançamento em produção.

---

## 📋 Pré-Requisitos

### Infraestrutura

- [ ] **Servidor de Produção Provisionado**
  - CPU: Mínimo 4 cores
  - RAM: Mínimo 8GB
  - Disco: Mínimo 50GB SSD
  - OS: Ubuntu 22.04 LTS ou superior

- [ ] **Domínio Configurado**
  - DNS apontando para servidor de produção
  - Propagação DNS confirmada (48h)
  - Subdomínios configurados (api.dominio.com, app.dominio.com)

- [ ] **Certificado SSL Instalado**
  - Let's Encrypt configurado
  - Renovação automática ativada
  - Grade A+ no SSL Labs

- [ ] **Firewall Configurado**
  - Portas 80, 443 abertas
  - Portas 22 (SSH) restrita a IPs específicos
  - Outras portas bloqueadas

### Banco de Dados

- [ ] **Supabase Configurado**
  - Projeto criado
  - Plano adequado selecionado
  - Backup automático habilitado
  - Connection pooling configurado

- [ ] **Migrations Aplicadas**
  - Script `supabase/migrations/20251103_add_crm_tables.sql` executado
  - Tabelas verificadas (leads, schedules, tag_links, etc.)
  - Índices criados
  - RLS habilitado

- [ ] **Prisma Sincronizado**
  - `prisma db pull` executado
  - `prisma generate` executado
  - Schema validado

### Serviços Externos

- [ ] **Redis Configurado**
  - Instância de produção provisionada
  - Persistência habilitada
  - Senha configurada
  - Conexão testada

- [ ] **APIs de IA Configuradas**
  - Gemini API key válida
  - OpenAI API key válida
  - Limites de uso verificados
  - Billing configurado

- [ ] **SMTP Configurado**
  - Servidor SMTP configurado
  - Credenciais validadas
  - Email de teste enviado
  - SPF/DKIM/DMARC configurados

---

## 🔐 Segurança

### Variáveis de Ambiente

- [ ] **Variáveis Críticas Configuradas**
  - `DATABASE_URL` (Supabase)
  - `REDIS_URL`
  - `JWT_SECRET` (mínimo 32 caracteres aleatórios)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Variáveis de IA**
  - `GEMINI_API_KEY`
  - `OPENAI_API_KEY`

- [ ] **Variáveis de Email**
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

- [ ] **Variáveis de Produção**
  - `NODE_ENV=production`
  - `VITE_API_BASE_URL` (URL da API em produção)

### Autenticação e Autorização

- [ ] **JWT Configurado**
  - Secret forte e único
  - Expiração adequada (7 dias)
  - Refresh token implementado

- [ ] **Row Level Security (RLS)**
  - Policies criadas para todas as tabelas
  - Isolamento por tenant validado
  - Testes com diferentes usuários realizados

- [ ] **Rate Limiting**
  - Configurado no Nginx
  - Limites adequados por endpoint
  - Testado com ferramentas de carga

### Hardening

- [ ] **Servidor Hardened**
  - Usuário root desabilitado
  - SSH com chave pública apenas
  - Fail2Ban instalado e configurado
  - Atualizações automáticas de segurança

- [ ] **Docker Seguro**
  - Imagens sem vulnerabilidades (scan com Trivy)
  - Containers rodando como non-root
  - Secrets gerenciados via Docker secrets

---

## 🧪 Testes

### Testes Automatizados

- [ ] **Testes de Integração Passando**
  ```bash
  cd apps/api && pnpm test
  ```
  - Auth: 12 casos ✅
  - WhatsApp: 8 casos ✅
  - Messages: 12 casos ✅
  - CRM: 18 casos ✅
  - **Total**: 50 casos passando

- [ ] **Cobertura de Testes Adequada**
  - Mínimo 75% de cobertura
  - Fluxos críticos com 100%

- [ ] **Lint e Typecheck Passando**
  ```bash
  pnpm lint && pnpm typecheck
  ```

### Testes Manuais

- [ ] **Fluxo de Autenticação**
  - Registro de novo usuário
  - Login com credenciais válidas
  - Login com credenciais inválidas (deve falhar)
  - Logout
  - Refresh token

- [ ] **Fluxo de CRM**
  - Criar contato
  - Editar contato
  - Buscar contato
  - Deletar contato
  - Criar lead
  - Converter lead em deal
  - Mover deal entre stages

- [ ] **Fluxo de WhatsApp**
  - Conectar via QR Code
  - Enviar mensagem de texto
  - Enviar mensagem com mídia
  - Receber mensagem
  - Resposta automática de IA
  - Desconectar

- [ ] **Fluxo de IA**
  - Configurar agente de IA
  - Testar resposta automática
  - Validar contexto de conversação
  - Testar com diferentes prompts

### Testes de Performance

- [ ] **Testes de Carga**
  - 100 usuários simultâneos
  - Tempo de resposta < 500ms (p95)
  - Sem erros 5xx

- [ ] **Testes de Stress**
  - Identificar limite de capacidade
  - Validar graceful degradation

---

## 📊 Monitoramento

### Grafana

- [ ] **Dashboards Configurados**
  - Dashboard de sistema (CPU, RAM, Disco)
  - Dashboard de aplicação (requests, latência, erros)
  - Dashboard de banco de dados (queries, conexões)
  - Dashboard de Redis (memória, hit rate)

- [ ] **Alertas Configurados**
  - CPU > 80% por 5 minutos
  - RAM > 90% por 5 minutos
  - Disco > 85%
  - Erro 5xx > 10 em 1 minuto
  - API response time > 1s (p95)

### Logs

- [ ] **Logs Centralizados**
  - Logs da API sendo coletados
  - Logs do Worker sendo coletados
  - Logs do Nginx sendo coletados
  - Retenção de 30 dias configurada

- [ ] **Níveis de Log Adequados**
  - Produção: `info` ou `warn`
  - Desenvolvimento: `debug`

### Sentry (Opcional)

- [ ] **Sentry Configurado**
  - Projeto criado
  - DSN configurado
  - Source maps enviados
  - Alertas configurados

---

## 🚀 Deploy

### Build e Deploy

- [ ] **Build de Produção**
  ```bash
  pnpm build
  ```
  - Frontend compilado sem erros
  - API compilada sem erros
  - Worker compilado sem erros

- [ ] **Docker Images**
  - Imagens construídas
  - Tagging adequado (latest, v1.0.0)
  - Push para registry

- [ ] **Docker Compose**
  - `docker-compose.yml` atualizado
  - Variáveis de ambiente injetadas
  - Healthchecks configurados

- [ ] **Deploy Executado**
  ```bash
  docker-compose up -d
  ```
  - Todos os containers rodando
  - Sem erros nos logs

### Validação Pós-Deploy

- [ ] **Script de Validação Executado**
  ```bash
  bash scripts/validate-production-env.sh
  ```
  - Todas as verificações passando
  - Sem erros ou avisos críticos

- [ ] **Endpoints Respondendo**
  - `GET /health` → 200 OK
  - `GET /api-docs` → 200 OK (Swagger)
  - `POST /api/auth/login` → 200 OK (com credenciais válidas)

- [ ] **Frontend Acessível**
  - https://app.dominio.com carregando
  - Sem erros no console
  - Assets carregando corretamente

---

## 📚 Documentação

### Documentação Técnica

- [ ] **README Atualizado**
  - Instruções de instalação
  - Variáveis de ambiente documentadas
  - Comandos úteis listados

- [ ] **API Documentada**
  - Swagger acessível em `/api-docs`
  - Todos os endpoints documentados
  - Exemplos de uso incluídos

- [ ] **Guias Criados**
  - Guia de deploy (`docs/DEPLOYMENT_GUIDE.md`)
  - Guia de migrations (`docs/SUPABASE_MIGRATIONS_GUIDE.md`)
  - Guia de troubleshooting

### Documentação de Usuário

- [ ] **Manual de Usuário**
  - Como fazer login
  - Como conectar WhatsApp
  - Como criar contatos e deals
  - Como usar IA

- [ ] **FAQs**
  - Perguntas frequentes respondidas
  - Problemas comuns documentados

---

## 🔄 Backup e Recuperação

### Backup

- [ ] **Backup Automático Configurado**
  - Banco de dados: Diário (Supabase)
  - Arquivos de mídia: Diário
  - Configurações: Semanal
  - Retenção: 30 dias

- [ ] **Backup Testado**
  - Backup manual executado
  - Restauração testada em ambiente de staging

### Disaster Recovery

- [ ] **Plano de DR Documentado**
  - RTO (Recovery Time Objective): < 4 horas
  - RPO (Recovery Point Objective): < 1 hora
  - Procedimentos de recuperação documentados

- [ ] **Runbook Criado**
  - Procedimentos para incidentes comuns
  - Contatos de emergência
  - Escalação definida

---

## 🎯 Performance

### Otimizações

- [ ] **Nginx Otimizado**
  - Gzip habilitado
  - Cache de assets estáticos (7 dias)
  - HTTP/2 habilitado
  - Rate limiting configurado

- [ ] **Banco de Dados Otimizado**
  - Índices criados em campos frequentemente consultados
  - Queries lentas identificadas e otimizadas
  - Connection pooling configurado

- [ ] **Redis Configurado**
  - Cache de sessões
  - Cache de queries frequentes
  - TTL adequado configurado

### CDN (Opcional)

- [ ] **CDN Configurado**
  - Assets estáticos servidos via CDN
  - Imagens otimizadas
  - Cache invalidation configurado

---

## 📞 Suporte

### Canais de Suporte

- [ ] **Email de Suporte Configurado**
  - suporte@dominio.com
  - Auto-responder configurado
  - SLA definido (24h)

- [ ] **Chat de Suporte (Opcional)**
  - Widget instalado
  - Horário de atendimento definido

### Equipe

- [ ] **Equipe Treinada**
  - Desenvolvedores conhecem o sistema
  - Suporte sabe usar a plataforma
  - Runbooks revisados

- [ ] **Plantão Definido**
  - Escala de plantão criada
  - Contatos de emergência compartilhados

---

## ✅ Checklist Final

### Pré-Go-Live (1 semana antes)

- [ ] Todos os itens acima verificados
- [ ] Testes de carga executados
- [ ] Backup testado
- [ ] Equipe treinada
- [ ] Runbooks revisados

### Go-Live (Dia D)

- [ ] Deploy executado em horário de baixo tráfego
- [ ] Validação pós-deploy realizada
- [ ] Monitoramento ativo
- [ ] Equipe de plantão disponível

### Pós-Go-Live (Primeira Semana)

- [ ] Monitoramento diário de métricas
- [ ] Logs revisados diariamente
- [ ] Feedback de usuários coletado
- [ ] Ajustes finos realizados

---

## 📊 Métricas de Sucesso

Após o go-live, monitore estas métricas:

| Métrica | Meta | Frequência |
|---------|------|------------|
| **Uptime** | > 99.5% | Diária |
| **Tempo de Resposta (p95)** | < 500ms | Diária |
| **Taxa de Erro** | < 0.1% | Diária |
| **Satisfação do Usuário** | > 4.5/5 | Semanal |
| **Conversão de Leads** | > 20% | Semanal |
| **Tempo Médio de Resposta** | < 5 min | Semanal |

---

## 🚨 Critérios de Rollback

Faça rollback imediato se:

- [ ] Taxa de erro > 5% por mais de 5 minutos
- [ ] Uptime < 95% em 1 hora
- [ ] Perda de dados detectada
- [ ] Vulnerabilidade crítica descoberta
- [ ] Performance degradada > 50%

### Procedimento de Rollback

```bash
# 1. Parar containers atuais
docker-compose down

# 2. Restaurar versão anterior
git checkout <versao_anterior>

# 3. Rebuild e deploy
docker-compose up -d --build

# 4. Validar
bash scripts/validate-production-env.sh
```

---

## 📝 Assinaturas

| Papel | Nome | Assinatura | Data |
|-------|------|------------|------|
| **Tech Lead** | | | |
| **DevOps** | | | |
| **QA Lead** | | | |
| **Product Owner** | | | |

---

**Status**: ⏳ Pendente  
**Última Atualização**: 03/11/2025  
**Preparado por**: Manus AI
