# Guia de Monitoramento - PrimeZapAI

**Última atualização:** 03/11/2025

## Visão Geral

O PrimeZapAI utiliza uma stack completa de monitoramento baseada em **Prometheus** (coleta de métricas), **Grafana** (visualização) e **AlertManager** (gerenciamento de alertas).

## Arquitetura de Monitoramento

```
┌─────────────────────────────────────────────────────────┐
│                    PrimeZapAI Stack                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐  │
│  │   API    │  │  Worker  │  │ Redis  │  │Postgres│  │
│  │  :4000   │  │          │  │ :6379  │  │ :5432  │  │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  └───┬────┘  │
│       │             │             │            │        │
│       └─────────────┴─────────────┴────────────┘        │
│                         │                                │
│                    [Métricas]                           │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │Prometheus │
                    │   :9090   │
                    └─────┬─────┘
                          │
              ┌───────────┴───────────┐
              │                       │
        ┌─────▼─────┐          ┌─────▼──────┐
        │  Grafana  │          │AlertManager│
        │   :3001   │          │   :9093    │
        └───────────┘          └────────────┘
```

## Componentes

### Prometheus
- **Porta:** 9090
- **Função:** Coleta e armazena métricas de todos os serviços
- **Intervalo de coleta:** 15 segundos
- **Retenção:** 15 dias (padrão)

### Grafana
- **Porta:** 3001
- **Função:** Visualização de métricas em dashboards
- **Usuário padrão:** admin
- **Senha padrão:** admin (⚠️ alterar em produção)

### AlertManager
- **Porta:** 9093
- **Função:** Gerencia e roteia alertas
- **Notificações:** Email, Slack, Webhook

### Exporters

| Exporter | Porta | Função |
| :--- | :--- | :--- |
| Node Exporter | 9100 | Métricas do sistema (CPU, memória, disco) |
| Redis Exporter | 9121 | Métricas do Redis |
| Postgres Exporter | 9187 | Métricas do PostgreSQL |

## Iniciando o Monitoramento

### Passo 1: Configurar Variáveis de Ambiente

Edite o `.env` e configure:

```bash
# Habilitar monitoramento
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true

# Senha do Grafana (altere!)
GRAFANA_ADMIN_PASSWORD=senha_forte_aqui
```

### Passo 2: Configurar AlertManager

Edite `alertmanager.yml` e configure o SMTP:

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@primezap.com'
  smtp_auth_username: 'alerts@primezap.com'
  smtp_auth_password: 'sua_senha_aqui'
```

### Passo 3: Iniciar os Serviços

```bash
# Iniciar stack de monitoramento
docker compose -f docker-compose.monitoring.yml up -d

# Verificar se todos os serviços estão rodando
docker compose -f docker-compose.monitoring.yml ps
```

### Passo 4: Acessar as Interfaces

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001
- **AlertManager:** http://localhost:9093

## Configurando o Grafana

### Primeiro Acesso

1. Acesse http://localhost:3001
2. Login: `admin` / Senha: `admin` (ou a que você configurou)
3. Altere a senha no primeiro acesso

### Datasource Prometheus

O datasource já está configurado automaticamente via provisioning. Verifique em:
- Configuration → Data Sources → Prometheus

### Importar Dashboards Prontos

O Grafana possui dashboards prontos para vários serviços:

1. **Node Exporter Full** (ID: 1860)
   - Dashboard completo de métricas do sistema
   - CPU, memória, disco, rede

2. **Redis Dashboard** (ID: 11835)
   - Métricas do Redis
   - Comandos, conexões, memória

3. **PostgreSQL Database** (ID: 9628)
   - Métricas do PostgreSQL
   - Queries, conexões, locks

**Como importar:**
1. Grafana → Dashboards → Import
2. Digite o ID do dashboard
3. Selecione o datasource "Prometheus"
4. Clique em "Import"

## Métricas Disponíveis

### API (Express.js)

| Métrica | Descrição |
| :--- | :--- |
| `http_requests_total` | Total de requisições HTTP |
| `http_request_duration_seconds` | Duração das requisições |
| `http_requests_in_flight` | Requisições em andamento |
| `process_cpu_user_seconds_total` | Uso de CPU do processo |
| `process_resident_memory_bytes` | Memória usada pelo processo |

### Redis

| Métrica | Descrição |
| :--- | :--- |
| `redis_connected_clients` | Clientes conectados |
| `redis_used_memory_bytes` | Memória usada |
| `redis_commands_processed_total` | Comandos processados |
| `redis_keyspace_hits_total` | Cache hits |
| `redis_keyspace_misses_total` | Cache misses |

### PostgreSQL

| Métrica | Descrição |
| :--- | :--- |
| `pg_stat_activity_count` | Conexões ativas |
| `pg_stat_database_tup_inserted` | Linhas inseridas |
| `pg_stat_database_tup_updated` | Linhas atualizadas |
| `pg_stat_database_tup_deleted` | Linhas deletadas |
| `pg_database_size_bytes` | Tamanho do banco |

### Sistema (Node Exporter)

| Métrica | Descrição |
| :--- | :--- |
| `node_cpu_seconds_total` | Uso de CPU |
| `node_memory_MemAvailable_bytes` | Memória disponível |
| `node_filesystem_avail_bytes` | Espaço em disco disponível |
| `node_network_receive_bytes_total` | Bytes recebidos pela rede |
| `node_network_transmit_bytes_total` | Bytes enviados pela rede |

## Alertas Configurados

### Críticos

| Alerta | Condição | Ação |
| :--- | :--- | :--- |
| BackendDown | API offline por 1 minuto | Email para devops + admin |
| RedisDown | Redis offline por 1 minuto | Email para devops + admin |
| PostgresDown | PostgreSQL offline por 1 minuto | Email para devops + admin |
| DiskSpaceLow | Menos de 10% de espaço em disco | Email para devops + admin |
| HighErrorRate | Mais de 5% de erros 5xx | Email para devops + admin |

### Avisos

| Alerta | Condição | Ação |
| :--- | :--- | :--- |
| FrontendDown | Frontend offline por 2 minutos | Email para devops |
| HighCPUUsage | CPU acima de 80% por 5 minutos | Email para devops |
| HighMemoryUsage | Memória acima de 85% por 5 minutos | Email para devops |
| HighResponseTime | P95 acima de 2 segundos | Email para devops |
| HighDatabaseConnections | Mais de 80 conexões no banco | Email para devops |

## Criando Dashboards Personalizados

### Dashboard Básico da API

1. Grafana → Dashboards → New Dashboard
2. Add visualization
3. Selecione "Prometheus" como datasource
4. Use as queries abaixo:

**Taxa de Requisições:**
```promql
rate(http_requests_total[5m])
```

**Tempo de Resposta (P95):**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Taxa de Erro:**
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

**Requisições por Endpoint:**
```promql
sum by (path) (rate(http_requests_total[5m]))
```

## Queries Úteis do Prometheus

### Verificar se serviços estão UP
```promql
up
```

### Top 5 endpoints mais lentos
```promql
topk(5, histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])))
```

### Uso de memória por serviço
```promql
process_resident_memory_bytes / 1024 / 1024
```

### Taxa de cache hit do Redis
```promql
rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
```

## Troubleshooting

### Prometheus não está coletando métricas

**Verificar targets:**
1. Acesse http://localhost:9090/targets
2. Verifique se todos os targets estão "UP"
3. Se algum estiver "DOWN", verifique:
   - O serviço está rodando?
   - A porta está correta?
   - O endpoint `/metrics` existe?

**Logs do Prometheus:**
```bash
docker logs primeflow-prometheus
```

### Grafana não exibe dados

**Verificar datasource:**
1. Configuration → Data Sources → Prometheus
2. Clique em "Test"
3. Deve retornar "Data source is working"

**Verificar queries:**
1. Explore → Selecione "Prometheus"
2. Digite `up` e execute
3. Deve retornar dados

### Alertas não estão sendo enviados

**Verificar AlertManager:**
```bash
# Logs do AlertManager
docker logs primeflow-alertmanager

# Status dos alertas
curl http://localhost:9093/api/v2/alerts
```

**Verificar configuração SMTP:**
- Email e senha estão corretos?
- SMTP permite autenticação de apps?
- Firewall está bloqueando a porta 587?

## Boas Práticas

1. **Altere senhas padrão** em produção
2. **Configure SSL/TLS** para acesso externo
3. **Limite acesso** às portas de monitoramento (firewall)
4. **Faça backup** dos dados do Prometheus e Grafana
5. **Monitore o monitoramento** (meta-monitoring)
6. **Revise alertas** regularmente para evitar fadiga
7. **Documente** dashboards e queries customizadas

## Próximos Passos

- [ ] Configurar Slack webhook para alertas críticos
- [ ] Criar dashboard de negócio (leads, conversas, campanhas)
- [ ] Configurar retenção de dados do Prometheus
- [ ] Implementar tracing distribuído (Jaeger/Tempo)
- [ ] Configurar backup automático do Grafana
