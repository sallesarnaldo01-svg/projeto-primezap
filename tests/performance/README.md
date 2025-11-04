# Performance Testing with k6

Este diretório contém testes de performance para a API do PrimeZap AI usando [k6](https://k6.io/).

## Instalação do k6

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Windows
```bash
choco install k6
```

## Tipos de Testes

### 1. Load Test (`load-test.js`)

Testa o sistema sob carga normal esperada.

**Objetivo**: Verificar se o sistema mantém performance aceitável sob carga normal.

**Configuração**:
- 50-100 usuários simultâneos
- Duração: 16 minutos
- Thresholds: p95 < 500ms, error rate < 1%

**Executar**:
```bash
k6 run tests/performance/load-test.js
```

**Com variáveis de ambiente**:
```bash
API_URL=https://api.primezap.com \
TEST_EMAIL=test@example.com \
TEST_PASSWORD=password123 \
k6 run tests/performance/load-test.js
```

---

### 2. Stress Test (`stress-test.js`)

Testa o sistema até o ponto de quebra.

**Objetivo**: Encontrar os limites do sistema e identificar gargalos.

**Configuração**:
- 100-400 usuários simultâneos
- Duração: 33 minutos
- Thresholds: p99 < 3s, error rate < 10%

**Executar**:
```bash
k6 run tests/performance/stress-test.js
```

**Análise**:
- Identifique em que ponto o sistema começa a degradar
- Monitore CPU, memória e conexões de banco de dados
- Verifique logs de erro

---

### 3. Spike Test (`spike-test.js`)

Testa a capacidade do sistema de lidar com picos súbitos de tráfego.

**Objetivo**: Verificar se o sistema se recupera após picos de tráfego.

**Configuração**:
- Pico de 50 para 500 usuários em 30 segundos
- Duração: 5 minutos
- Thresholds: p95 < 2s, error rate < 20% (durante pico)

**Executar**:
```bash
k6 run tests/performance/spike-test.js
```

**Análise**:
- Sistema deve se recuperar após o pico
- Rate limiting deve funcionar corretamente
- Sem crashes ou timeouts permanentes

---

## Métricas Importantes

### Tempo de Resposta
- **p50 (mediana)**: 50% das requisições abaixo desse tempo
- **p95**: 95% das requisições abaixo desse tempo
- **p99**: 99% das requisições abaixo desse tempo

### Taxa de Erro
- **http_req_failed**: Porcentagem de requisições que falharam
- **errors**: Taxa de erros customizada

### Throughput
- **http_reqs**: Total de requisições por segundo
- **data_received**: Dados recebidos por segundo
- **data_sent**: Dados enviados por segundo

---

## Interpretando Resultados

### ✅ Bom
```
✓ http_req_duration..............: avg=245ms  p95=450ms
✓ http_req_failed................: 0.12%
✓ http_reqs......................: 15000 (250/s)
```

### ⚠️ Atenção
```
✗ http_req_duration..............: avg=850ms  p95=1500ms
✓ http_req_failed................: 2.5%
✓ http_reqs......................: 12000 (200/s)
```

### ❌ Crítico
```
✗ http_req_duration..............: avg=3200ms p95=5000ms
✗ http_req_failed................: 15%
✗ http_reqs......................: 5000 (83/s)
```

---

## Metas de Performance

| Métrica | Meta | Crítico |
|---------|------|---------|
| **p95 Response Time** | < 500ms | > 2s |
| **p99 Response Time** | < 1s | > 5s |
| **Error Rate** | < 1% | > 5% |
| **Throughput** | > 200 req/s | < 50 req/s |

---

## Executar Todos os Testes

```bash
#!/bin/bash

echo "Running Load Test..."
k6 run tests/performance/load-test.js

echo "Running Stress Test..."
k6 run tests/performance/stress-test.js

echo "Running Spike Test..."
k6 run tests/performance/spike-test.js

echo "All tests completed!"
```

---

## Integração com CI/CD

Adicione ao GitHub Actions:

```yaml
- name: Run Performance Tests
  run: |
    k6 run --out json=results.json tests/performance/load-test.js
    
- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: k6-results
    path: results.json
```

---

## Monitoramento Durante Testes

### Servidor
```bash
# CPU e Memória
htop

# Conexões de rede
netstat -an | grep :4000 | wc -l

# Logs em tempo real
tail -f logs/app.log
```

### Banco de Dados
```sql
-- PostgreSQL: Conexões ativas
SELECT count(*) FROM pg_stat_activity;

-- Queries lentas
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

### Redis
```bash
# Monitorar comandos
redis-cli monitor

# Estatísticas
redis-cli info stats
```

---

## Otimizações Comuns

### Se p95 > 500ms:
1. Adicionar índices no banco de dados
2. Implementar cache (Redis)
3. Otimizar queries N+1
4. Usar connection pooling

### Se error rate > 1%:
1. Aumentar timeouts
2. Implementar retry logic
3. Melhorar tratamento de erros
4. Escalar recursos

### Se throughput < 200 req/s:
1. Escalar horizontalmente (mais instâncias)
2. Usar load balancer
3. Otimizar código (profiling)
4. Aumentar recursos (CPU, RAM)

---

## Referências

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
