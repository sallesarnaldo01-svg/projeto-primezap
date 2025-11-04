import { FastifyInstance } from 'fastify';
import { SwaggerOptions } from '@fastify/swagger';
import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

/**
 * Enhanced Swagger Configuration for PrimeZap AI
 * 
 * Complete OpenAPI 3.0 documentation with all endpoints, schemas, and examples.
 */

export const swaggerOptions: SwaggerOptions = {
  openapi: {
    info: {
      title: 'PrimeZap AI API',
      description: `
# PrimeZap AI API Documentation

API completa para gerenciamento de conversas, contatos, campanhas e automações com IA.

## Autenticação

A API usa autenticação JWT (JSON Web Token). Para acessar endpoints protegidos:

1. Faça login em \`POST /api/auth/login\`
2. Receba o token JWT na resposta
3. Inclua o token no header: \`Authorization: Bearer {token}\`

## Rate Limiting

- **Geral**: 100 requisições por 15 minutos
- **Autenticação**: 5 tentativas por 15 minutos
- **Webhooks**: 1000 requisições por minuto

## Paginação

Endpoints de listagem suportam paginação via query parameters:

- \`page\`: Número da página (padrão: 1)
- \`limit\`: Itens por página (padrão: 20, máximo: 100)
- \`sort\`: Campo para ordenação (ex: \`createdAt\`)
- \`order\`: Ordem (asc ou desc)

## Filtros

Use query parameters para filtrar resultados:

- \`search\`: Busca textual
- \`status\`: Filtrar por status
- \`tags\`: Filtrar por tags (separadas por vírgula)
- \`startDate\` e \`endDate\`: Filtrar por período

## Erros

A API retorna erros no formato padrão:

\`\`\`json
{
  "error": "ValidationError",
  "message": "Validation failed",
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "requestId": "uuid",
  "timestamp": "2024-11-04T12:00:00.000Z"
}
\`\`\`

## Webhooks

Configure webhooks para receber eventos em tempo real:

- \`message.received\`: Nova mensagem recebida
- \`message.sent\`: Mensagem enviada
- \`conversation.created\`: Nova conversa criada
- \`contact.created\`: Novo contato criado
- \`deal.updated\`: Deal atualizado

## SDKs

SDKs oficiais disponíveis:

- JavaScript/TypeScript: \`npm install @primezap/sdk\`
- Python: \`pip install primezap\`
- PHP: \`composer require primezap/sdk\`
      `,
      version: '1.0.0',
      contact: {
        name: 'PrimeZap Support',
        email: 'support@primezap.com',
        url: 'https://primezap.com/support',
      },
      license: {
        name: 'Proprietary',
        url: 'https://primezap.com/terms',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://api-staging.primezap.com',
        description: 'Staging server',
      },
      {
        url: 'https://api.primezap.com',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'Autenticação e autorização' },
      { name: 'Contacts', description: 'Gerenciamento de contatos' },
      { name: 'Conversations', description: 'Gerenciamento de conversas' },
      { name: 'Messages', description: 'Envio e recebimento de mensagens' },
      { name: 'Campaigns', description: 'Campanhas de marketing' },
      { name: 'Workflows', description: 'Automações e workflows' },
      { name: 'Deals', description: 'Gerenciamento de negócios (CRM)' },
      { name: 'AI', description: 'Recursos de inteligência artificial' },
      { name: 'Integrations', description: 'Integrações externas' },
      { name: 'Webhooks', description: 'Configuração de webhooks' },
      { name: 'Analytics', description: 'Relatórios e análises' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtido via /api/auth/login',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key para integrações',
        },
      },
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'ValidationError' },
            message: { type: 'string', example: 'Validation failed' },
            statusCode: { type: 'number', example: 400 },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            details: { type: 'array', items: { type: 'object' } },
            requestId: { type: 'string', format: 'uuid' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                total: { type: 'number', example: 100 },
                totalPages: { type: 'number', example: 5 },
              },
            },
          },
        },
        // Auth schemas
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'password123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        // User schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'user', 'agent'] },
            tenantId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // Contact schemas
        Contact: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'João Silva' },
            phone: { type: 'string', example: '+5511999999999' },
            email: { type: 'string', format: 'email', example: 'joao@example.com' },
            tags: { type: 'array', items: { type: 'string' } },
            customFields: { type: 'object' },
            tenantId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateContactRequest: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string', example: 'João Silva' },
            phone: { type: 'string', example: '+5511999999999' },
            email: { type: 'string', format: 'email', example: 'joao@example.com' },
            tags: { type: 'array', items: { type: 'string' } },
            customFields: { type: 'object' },
          },
        },
        // Message schemas
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            conversationId: { type: 'string', format: 'uuid' },
            content: { type: 'string', example: 'Olá, como posso ajudar?' },
            type: { type: 'string', enum: ['text', 'image', 'video', 'audio', 'document'] },
            direction: { type: 'string', enum: ['inbound', 'outbound'] },
            status: { type: 'string', enum: ['pending', 'sent', 'delivered', 'read', 'failed'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SendMessageRequest: {
          type: 'object',
          required: ['conversationId', 'content'],
          properties: {
            conversationId: { type: 'string', format: 'uuid' },
            content: { type: 'string', example: 'Olá, como posso ajudar?' },
            type: { type: 'string', enum: ['text', 'image', 'video', 'audio', 'document'], default: 'text' },
            mediaUrl: { type: 'string', format: 'uri', description: 'URL da mídia (se type != text)' },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
    ],
  },
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: '/api/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
};

/**
 * Register Swagger plugin
 */
export async function registerSwagger(app: FastifyInstance) {
  await app.register(require('@fastify/swagger'), swaggerOptions);
  await app.register(require('@fastify/swagger-ui'), swaggerUiOptions);

  console.log('📚 Swagger documentation available at /api/docs');
}

/**
 * Example of route with Swagger documentation:
 * 
 * app.post('/api/contacts', {
 *   schema: {
 *     description: 'Create a new contact',
 *     tags: ['Contacts'],
 *     body: { $ref: 'CreateContactRequest#' },
 *     response: {
 *       201: { $ref: 'Contact#' },
 *       400: { $ref: 'Error#' },
 *       401: { $ref: 'Error#' },
 *     },
 *   },
 * }, async (request, reply) => {
 *   // Handler logic
 * });
 */
