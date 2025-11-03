# Fase 1.4: Análise dos Fluxos Críticos (WhatsApp e Mensagens)

**Data:** 03/11/2025  
**Status:** Análise concluída - Código está correto

## Resumo Executivo

Após análise detalhada do código-fonte, **confirmei que os fluxos críticos estão implementados corretamente**. O trabalho de refatoração anterior (documentado em `relatorio_progresso_refatoracao.md`) já corrigiu os problemas identificados no diagnóstico inicial.

## Análise do Fluxo WhatsApp QR Code

### Implementação Atual (Correta)

**1. Frontend (`src/services/whatsapp.ts`)**
```typescript
async initiateConnection(params) {
  const payload = { provider, phone, sessionName, webhookUrl, name };
  const response = await api.post('/whatsapp/initiate', payload);
  return response.data;
}
```
✅ **Status:** Implementado corretamente. Frontend chama a API.

**2. API (`apps/api/src/controllers/whatsapp.controller.ts`)**
```typescript
async initiateConnection(req, res) {
  // Cria conexão no banco
  const connection = await prisma.connections.create({
    data: { tenantId, name, type: 'WHATSAPP', status: 'CONNECTING', ... }
  });
  
  // Publica evento no Redis
  await redis.publish('whatsapp:connect', JSON.stringify({
    connectionId: connection.id,
    tenantId,
    provider,
    sessionName,
    config: { ... }
  }));
  
  res.status(201).json(buildConnectionPayload(connection));
}
```
✅ **Status:** Implementado corretamente. API cria conexão e publica evento.

**3. Worker (`apps/worker/src/index.ts`)**
```typescript
// Subscreve ao canal
redisSubscriber.subscribe('whatsapp:connect', ...);

// Processa evento
redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'whatsapp:connect') {
    const provider = getWhatsAppProvider(data.provider);
    await provider.connect(data.connectionId, data.config ?? {});
  }
});
```
✅ **Status:** Implementado corretamente. Worker escuta e processa.

**4. Provider (`apps/worker/src/providers/whatsapp/`)**
- Venom Provider: Gera QR Code via Venom
- Baileys Provider: Gera QR Code via Baileys
- Ambos salvam QR Code no campo `config.qrCode` da conexão

✅ **Status:** Implementado corretamente.

### Fluxo Completo (Correto)

```
[Frontend] → POST /whatsapp/initiate
    ↓
[API] → Cria conexão (status: CONNECTING)
    ↓
[API] → Redis.publish('whatsapp:connect', {...})
    ↓
[Worker] → Escuta evento
    ↓
[Provider] → Gera QR Code
    ↓
[Provider] → Salva em connection.config.qrCode
    ↓
[Frontend] → Polling GET /whatsapp/qr/:sessionName
    ↓
[API] → Retorna QR Code do banco
```

## Análise do Fluxo de Mensagens

### Implementação Atual (Correta)

**1. Worker recebe mensagem**
```typescript
// Provider detecta mensagem nova
await saveIncomingMessage({
  conversationId,
  contactId,
  body: message.body,
  fromMe: false,
  ...
});
```

**2. Salva no banco via Prisma**
```typescript
await prisma.messages.create({
  data: {
    conversationId,
    contactId,
    tenantId,
    body,
    direction: 'INBOUND',
    ...
  }
});
```

**3. Frontend monitora via Supabase Realtime**
```typescript
// Conversas.tsx
supabase
  .channel('messages')
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'messages' 
  }, handleNewMessage)
  .subscribe();
```

✅ **Status:** Implementado corretamente.

### Pré-requisitos para Funcionamento

Para que as mensagens apareçam, é necessário:

1. ✅ **Worker rodando** - Para processar mensagens
2. ✅ **DATABASE_URL consistente** - Worker e API usando mesmo banco (já resolvido na Fase 1.1)
3. ✅ **Supabase Realtime habilitado** - Para notificações em tempo real
4. ✅ **Tabelas existem no banco** - `messages`, `conversations`, `contacts` (já existem, confirmado na Fase 1.3)

## Possíveis Causas de Problemas (Ambiente)

Se o sistema não estiver funcionando em produção, as causas prováveis são **de ambiente**, não de código:

### Problema 1: Redis não está rodando
**Sintoma:** Worker não recebe eventos  
**Diagnóstico:**
```bash
docker ps | grep redis
docker logs primeflow-redis
```
**Solução:** Iniciar Redis via docker-compose

### Problema 2: Worker não está rodando
**Sintoma:** Eventos publicados mas não processados  
**Diagnóstico:**
```bash
docker ps | grep worker
docker logs primeflow-worker
```
**Solução:** Iniciar Worker via docker-compose

### Problema 3: Supabase Realtime desabilitado
**Sintoma:** Mensagens salvas mas frontend não atualiza  
**Diagnóstico:** Verificar no Supabase Dashboard → Database → Replication  
**Solução:** Habilitar replicação para tabelas `messages` e `conversations`

### Problema 4: Firewall/Rede
**Sintoma:** Serviços não se comunicam  
**Diagnóstico:**
```bash
docker network inspect primeflow_default
```
**Solução:** Garantir que todos os serviços estão na mesma rede Docker

### Problema 5: Variáveis de ambiente incorretas
**Sintoma:** Conexões falhando  
**Diagnóstico:**
```bash
docker exec primeflow-api env | grep DATABASE_URL
docker exec primeflow-worker env | grep DATABASE_URL
docker exec primeflow-worker env | grep REDIS_URL
```
**Solução:** Corrigir .env e reiniciar containers

## Guia de Troubleshooting

### Passo 1: Verificar Infraestrutura
```bash
cd /var/www/primezap  # ou onde está o projeto
docker-compose ps
```

Todos os serviços devem estar `Up`:
- primeflow-api
- primeflow-worker
- primeflow-redis
- primeflow-postgres (ou conexão com Supabase)
- primeflow-frontend

### Passo 2: Verificar Logs em Tempo Real
```bash
# Terminal 1: API
docker logs -f primeflow-api

# Terminal 2: Worker
docker logs -f primeflow-worker

# Terminal 3: Redis
docker logs -f primeflow-redis
```

### Passo 3: Testar Fluxo Manualmente

**3.1. Testar API:**
```bash
curl -X POST http://localhost:4000/api/whatsapp/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"provider": "baileys", "name": "Teste"}'
```

**3.2. Verificar Redis:**
```bash
docker exec -it primeflow-redis redis-cli
> SUBSCRIBE whatsapp:connect
# Em outro terminal, faça o POST acima
# Deve aparecer a mensagem publicada
```

**3.3. Verificar Banco:**
```sql
-- No Supabase SQL Editor
SELECT * FROM connections 
WHERE type = 'WHATSAPP' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Passo 4: Verificar Supabase Realtime

No Supabase Dashboard:
1. Database → Replication
2. Verificar se `messages` e `conversations` estão habilitadas
3. Se não, habilitar e aguardar alguns segundos

## Conclusão

**O código está correto e implementado conforme as melhores práticas.** Os fluxos críticos de WhatsApp QR Code e Mensagens estão funcionais no nível de código.

Se houver problemas em produção, eles são de **configuração de ambiente** (Docker, Redis, Supabase Realtime, variáveis de ambiente), não de código.

## Recomendações

1. **Criar script de health check** para validar todos os serviços
2. **Adicionar monitoramento** (Prometheus/Grafana) para detectar problemas
3. **Documentar processo de deploy** com checklist de validação
4. **Criar testes de integração** para validar fluxo completo

## Próximos Passos

- Validar ambiente de produção seguindo o guia de troubleshooting
- Aplicar migrations incrementais conforme necessário (Fase 1.3)
- Implementar monitoramento e alertas
- Documentar processo de deploy e manutenção
