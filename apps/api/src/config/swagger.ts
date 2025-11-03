import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PrimeZap API',
      version: version || '1.0.0',
      description: `
        API completa de CRM e automação de WhatsApp com inteligência artificial.
        
        ## Recursos Principais
        
        - **Autenticação JWT** - Sistema seguro de autenticação e autorização
        - **CRM Completo** - Gestão de contatos, leads e deals
        - **WhatsApp Automation** - Automação completa de mensagens
        - **IA Integrada** - Gemini e OpenAI para respostas inteligentes
        - **Multi-tenant** - Isolamento completo por tenant
        - **Webhooks** - Eventos em tempo real
        - **Rate Limiting** - Proteção contra abuso
        
        ## Autenticação
        
        Todas as rotas protegidas requerem um token JWT no header:
        \`\`\`
        Authorization: Bearer <seu_token>
        \`\`\`
        
        Obtenha seu token através do endpoint \`/auth/login\`.
      `,
      contact: {
        name: 'PrimeZap Support',
        email: 'suporte@primezap.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.VITE_API_BASE_URL || 'http://localhost:3001',
        description: 'API Server',
      },
      {
        url: 'http://localhost:3001',
        description: 'Local Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtido através do endpoint /auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro descritiva',
            },
            code: {
              type: 'string',
              description: 'Código do erro',
            },
            details: {
              type: 'object',
              description: 'Detalhes adicionais do erro',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['admin', 'manager', 'agent', 'viewer'],
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Contact: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            phone: {
              type: 'string',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            metadata: {
              type: 'object',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Deal: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            value: {
              type: 'number',
              format: 'decimal',
            },
            currency: {
              type: 'string',
              default: 'BRL',
            },
            probability: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
            },
            stageId: {
              type: 'string',
              format: 'uuid',
            },
            contactId: {
              type: 'string',
              format: 'uuid',
            },
            expectedCloseDate: {
              type: 'string',
              format: 'date',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            conversationId: {
              type: 'string',
              format: 'uuid',
            },
            content: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'video', 'audio', 'document'],
            },
            direction: {
              type: 'string',
              enum: ['inbound', 'outbound'],
            },
            status: {
              type: 'string',
              enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
            },
            mediaUrl: {
              type: 'string',
              format: 'uri',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de autenticação ausente ou inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Token de autenticação inválido',
                code: 'UNAUTHORIZED',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Sem permissão para acessar este recurso',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Você não tem permissão para acessar este recurso',
                code: 'FORBIDDEN',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Recurso não encontrado',
                code: 'NOT_FOUND',
              },
            },
          },
        },
        ValidationError: {
          description: 'Erro de validação dos dados enviados',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Dados inválidos',
                code: 'VALIDATION_ERROR',
                details: {
                  field: 'email',
                  message: 'Email inválido',
                },
              },
            },
          },
        },
      },
      parameters: {
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Número máximo de resultados a retornar',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
        },
        OffsetParam: {
          name: 'offset',
          in: 'query',
          description: 'Número de resultados a pular',
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
        },
        SortByParam: {
          name: 'sortBy',
          in: 'query',
          description: 'Campo para ordenação',
          schema: {
            type: 'string',
            default: 'createdAt',
          },
        },
        OrderParam: {
          name: 'order',
          in: 'query',
          description: 'Direção da ordenação',
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Endpoints de autenticação e autorização',
      },
      {
        name: 'Contacts',
        description: 'Gestão de contatos do CRM',
      },
      {
        name: 'Leads',
        description: 'Gestão de leads',
      },
      {
        name: 'Deals',
        description: 'Gestão de negócios e pipeline de vendas',
      },
      {
        name: 'Messages',
        description: 'Envio e gestão de mensagens',
      },
      {
        name: 'Conversations',
        description: 'Gestão de conversações',
      },
      {
        name: 'WhatsApp',
        description: 'Integração e automação do WhatsApp',
      },
      {
        name: 'AI',
        description: 'Inteligência artificial e agentes',
      },
      {
        name: 'Analytics',
        description: 'Métricas e analytics',
      },
      {
        name: 'Webhooks',
        description: 'Configuração e gestão de webhooks',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/routes/**/*.ts',
    './src/controllers/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
