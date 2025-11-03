# Documentação da API - PrimeZap

## Visão Geral

A API do PrimeZap é uma API RESTful construída com Node.js, TypeScript e Express que fornece funcionalidades completas de CRM, automação de WhatsApp, gestão de conversas e inteligência artificial.

## Base URL

```
Desenvolvimento: http://localhost:3001/api
Produção: https://seu-dominio.com/api
```

## Autenticação

A API utiliza autenticação baseada em JWT (JSON Web Tokens). Todas as requisições autenticadas devem incluir o token no header:

```
Authorization: Bearer <seu_token_jwt>
```

### Obter Token

**POST** `/auth/login`

```json
{
  "email": "usuario@example.com",
  "password": "senha_segura"
}
```

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "usuario@example.com",
    "name": "Nome do Usuário"
  }
}
```

## Endpoints Principais

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/register` | Registrar novo usuário |
| POST | `/auth/login` | Fazer login |
| POST | `/auth/logout` | Fazer logout |
| POST | `/auth/refresh` | Renovar token |
| GET | `/auth/me` | Obter dados do usuário autenticado |

### Contatos (CRM)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/contacts` | Listar todos os contatos |
| GET | `/contacts/:id` | Buscar contato específico |
| POST | `/contacts` | Criar novo contato |
| PATCH | `/contacts/:id` | Atualizar contato |
| DELETE | `/contacts/:id` | Deletar contato |
| GET | `/contacts/search` | Buscar contatos (com filtros) |

### Deals (Negócios)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/deals` | Listar todos os deals |
| GET | `/deals/:id` | Buscar deal específico |
| POST | `/deals` | Criar novo deal |
| PATCH | `/deals/:id` | Atualizar deal |
| DELETE | `/deals/:id` | Deletar deal |
| GET | `/deals/pipeline` | Visualizar pipeline de vendas |

### Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/messages/:conversationId` | Listar mensagens de uma conversação |
| GET | `/messages/single/:id` | Buscar mensagem específica |
| POST | `/messages` | Enviar nova mensagem |
| POST | `/messages/bulk` | Enviar mensagens em lote |
| PATCH | `/messages/:id` | Atualizar mensagem |
| DELETE | `/messages/:id` | Deletar mensagem |
| GET | `/messages/search` | Buscar mensagens |

### WhatsApp

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/whatsapp/qr` | Obter QR Code para conexão |
| GET | `/whatsapp/status` | Verificar status da conexão |
| POST | `/whatsapp/send` | Enviar mensagem via WhatsApp |
| POST | `/whatsapp/disconnect` | Desconectar sessão |
| GET | `/whatsapp/chats` | Listar chats do WhatsApp |

### Conversações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/conversations` | Listar conversações |
| GET | `/conversations/:id` | Buscar conversação específica |
| POST | `/conversations` | Criar nova conversação |
| PATCH | `/conversations/:id` | Atualizar conversação |
| DELETE | `/conversations/:id` | Deletar conversação |
| POST | `/conversations/:id/assign` | Atribuir conversação a usuário |

### IA (Inteligência Artificial)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/ai/agents` | Listar agentes de IA |
| POST | `/ai/agents` | Criar novo agente |
| PATCH | `/ai/agents/:id` | Atualizar agente |
| DELETE | `/ai/agents/:id` | Deletar agente |
| POST | `/ai/chat` | Enviar mensagem para IA |
| POST | `/ai/analyze` | Analisar texto com IA |

### Analytics

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/analytics/dashboard` | Métricas do dashboard |
| GET | `/analytics/funnel` | Funil de vendas |
| GET | `/analytics/conversion-rate` | Taxa de conversão |
| GET | `/analytics/pipeline-value` | Valor total em pipeline |
| GET | `/analytics/messages-stats` | Estatísticas de mensagens |

## Parâmetros de Query Comuns

### Paginação

```
?limit=20&offset=0
```

- `limit`: Número máximo de resultados (padrão: 50)
- `offset`: Número de resultados a pular (padrão: 0)

### Ordenação

```
?sortBy=createdAt&order=desc
```

- `sortBy`: Campo para ordenar
- `order`: `asc` ou `desc`

### Filtros

```
?search=termo&status=active&startDate=2025-01-01&endDate=2025-12-31
```

## Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado com sucesso |
| 400 | Bad Request - Requisição inválida |
| 401 | Unauthorized - Autenticação necessária |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Conflito (ex: email duplicado) |
| 422 | Unprocessable Entity - Validação falhou |
| 500 | Internal Server Error - Erro no servidor |

## Formato de Erro

Todas as respostas de erro seguem o formato:

```json
{
  "error": "Mensagem de erro descritiva",
  "code": "ERROR_CODE",
  "details": {
    "field": "campo_com_erro",
    "message": "Detalhes adicionais"
  }
}
```

## Rate Limiting

A API implementa rate limiting para prevenir abuso:

- **Limite padrão**: 100 requisições por minuto por IP
- **Limite autenticado**: 1000 requisições por minuto por usuário

Headers de resposta:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

## Webhooks

O PrimeZap suporta webhooks para eventos em tempo real:

### Eventos Disponíveis

- `message.received` - Nova mensagem recebida
- `message.sent` - Mensagem enviada
- `conversation.created` - Nova conversação criada
- `conversation.updated` - Conversação atualizada
- `deal.created` - Novo deal criado
- `deal.stage_changed` - Stage do deal alterado
- `contact.created` - Novo contato criado
- `contact.updated` - Contato atualizado

### Configurar Webhook

**POST** `/webhooks`

```json
{
  "url": "https://seu-servidor.com/webhook",
  "events": ["message.received", "deal.created"],
  "secret": "seu_secret_para_validacao"
}
```

## Geração de Documentação Swagger/OpenAPI

Para gerar a documentação interativa da API:

### 1. Instalar dependências

```bash
pnpm add -D swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
```

### 2. Configurar Swagger

Crie o arquivo `apps/api/src/config/swagger.ts`:

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PrimeZap API',
      version: '1.0.0',
      description: 'API completa de CRM e automação de WhatsApp',
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: 'Desenvolvimento',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

### 3. Adicionar ao servidor

No arquivo `apps/api/src/app.ts`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### 4. Acessar documentação

Após iniciar o servidor, acesse:

```
http://localhost:3001/api-docs
```

## Exemplos de Uso

### Criar Contato e Deal

```bash
# 1. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}'

# 2. Criar Contato
curl -X POST http://localhost:3001/api/contacts \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "+5511999999999"
  }'

# 3. Criar Deal
curl -X POST http://localhost:3001/api/deals \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Venda de Software",
    "contactId": "ID_DO_CONTATO",
    "value": 15000,
    "probability": 70
  }'
```

## Suporte

Para mais informações ou suporte:

- **Email**: suporte@primezap.com
- **Documentação**: https://docs.primezap.com
- **GitHub**: https://github.com/sallesarnaldo01-svg/projeto-primezap

## Changelog

### v1.0.0 (2025-11-03)
- Lançamento inicial da API
- Endpoints de autenticação, CRM, mensagens e WhatsApp
- Integração com IA (Gemini e OpenAI)
- Sistema de webhooks
- Rate limiting e segurança
