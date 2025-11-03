# Exemplo de Documentação Swagger

Este documento mostra como adicionar documentação Swagger aos controllers e rotas da API.

## Configuração Inicial

### 1. Instalar Dependências

```bash
cd apps/api
pnpm add swagger-jsdoc swagger-ui-express
pnpm add -D @types/swagger-jsdoc @types/swagger-ui-express
```

### 2. Adicionar ao App Principal

No arquivo `apps/api/src/app.ts` ou `apps/api/src/index.ts`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// ... outras configurações

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'PrimeZap API Documentation',
}));

// Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
```

### 3. Acessar Documentação

Após iniciar o servidor:

- **Swagger UI**: http://localhost:3001/api-docs
- **Swagger JSON**: http://localhost:3001/api-docs.json

## Exemplos de Documentação

### Exemplo 1: Endpoint de Autenticação

```typescript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Fazer login
 *     description: Autentica um usuário e retorna um token JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: senha123
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
export async function login(req: Request, res: Response) {
  // ... implementação
}
```

### Exemplo 2: CRUD de Contatos

```typescript
/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Listar contatos
 *     description: Retorna uma lista paginada de contatos do tenant
 *     tags: [Contacts]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - $ref: '#/components/parameters/SortByParam'
 *       - $ref: '#/components/parameters/OrderParam'
 *       - name: search
 *         in: query
 *         description: Termo de busca (nome, email ou telefone)
 *         schema:
 *           type: string
 *       - name: tags
 *         in: query
 *         description: Filtrar por tags (separadas por vírgula)
 *         schema:
 *           type: string
 *           example: cliente,vip
 *     responses:
 *       200:
 *         description: Lista de contatos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   post:
 *     summary: Criar contato
 *     description: Cria um novo contato no CRM
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@example.com
 *               phone:
 *                 type: string
 *                 example: +5511999999999
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [cliente, vip]
 *               metadata:
 *                 type: object
 *                 example: { empresa: "Acme Corp", cargo: "CEO" }
 *     responses:
 *       201:
 *         description: Contato criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export class ContactsController {
  async list(req: Request, res: Response) {
    // ... implementação
  }

  async create(req: Request, res: Response) {
    // ... implementação
  }
}
```

### Exemplo 3: Endpoint com Path Parameter

```typescript
/**
 * @swagger
 * /api/contacts/{id}:
 *   get:
 *     summary: Buscar contato por ID
 *     description: Retorna os detalhes de um contato específico
 *     tags: [Contacts]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do contato
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalhes do contato
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   patch:
 *     summary: Atualizar contato
 *     description: Atualiza parcialmente os dados de um contato
 *     tags: [Contacts]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Contato atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *   delete:
 *     summary: Deletar contato
 *     description: Remove um contato do sistema
 *     tags: [Contacts]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Contato deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Contato deletado com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
```

### Exemplo 4: Endpoint de Mensagens

```typescript
/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Enviar mensagem
 *     description: Envia uma nova mensagem em uma conversação
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - content
 *               - type
 *             properties:
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 example: Olá, como posso ajudar?
 *               type:
 *                 type: string
 *                 enum: [text, image, video, audio, document]
 *                 default: text
 *               mediaUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL da mídia (para tipos não-texto)
 *     responses:
 *       201:
 *         description: Mensagem enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
```

### Exemplo 5: Endpoint de Analytics

```typescript
/**
 * @swagger
 * /api/analytics/funnel:
 *   get:
 *     summary: Funil de vendas
 *     description: Retorna métricas do funil de vendas por stage
 *     tags: [Analytics]
 *     parameters:
 *       - name: startDate
 *         in: query
 *         description: Data inicial (ISO 8601)
 *         schema:
 *           type: string
 *           format: date
 *           example: 2025-01-01
 *       - name: endDate
 *         in: query
 *         description: Data final (ISO 8601)
 *         schema:
 *           type: string
 *           format: date
 *           example: 2025-12-31
 *     responses:
 *       200:
 *         description: Métricas do funil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       stageId:
 *                         type: string
 *                         format: uuid
 *                       stageName:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       value:
 *                         type: number
 *                       conversionRate:
 *                         type: number
 *                         format: float
 *                 totalValue:
 *                   type: number
 *                 totalDeals:
 *                   type: integer
 */
```

## Boas Práticas

### 1. Sempre Especifique Tags

Tags agrupam endpoints relacionados na UI do Swagger:

```typescript
/**
 * @swagger
 * tags: [Contacts]
 */
```

### 2. Use Referências para Schemas Comuns

Evite duplicação usando `$ref`:

```typescript
schema:
  $ref: '#/components/schemas/Contact'
```

### 3. Documente Todos os Códigos de Status

Inclua respostas de sucesso e erro:

```typescript
responses:
  200:
    description: Sucesso
  400:
    $ref: '#/components/responses/ValidationError'
  401:
    $ref: '#/components/responses/UnauthorizedError'
  404:
    $ref: '#/components/responses/NotFoundError'
```

### 4. Adicione Exemplos

Exemplos ajudam os desenvolvedores a entender o formato esperado:

```typescript
example: usuario@example.com
```

### 5. Marque Campos Obrigatórios

```typescript
required:
  - email
  - password
```

### 6. Use Descrições Claras

```typescript
description: Autentica um usuário e retorna um token JWT válido por 7 dias
```

## Validação

Para validar a documentação Swagger:

```bash
# Instalar validador
npm install -g swagger-cli

# Validar spec
swagger-cli validate apps/api/src/config/swagger.ts
```

## Exportar Documentação

Para exportar a documentação em JSON:

```bash
curl http://localhost:3001/api-docs.json > swagger.json
```

Para converter em HTML estático:

```bash
npx redoc-cli bundle swagger.json -o docs/api.html
```

---

**Preparado por**: Manus AI  
**Data**: 03/11/2025
