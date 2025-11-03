# Testes de Integração - PrimeZapAI API

## Visão Geral

Este diretório contém os testes de integração da API do PrimeZapAI. Os testes validam o funcionamento correto dos fluxos críticos do sistema, incluindo autenticação, WhatsApp e mensagens.

## Estrutura

```
tests/
├── integration/          # Testes de integração
│   ├── auth.test.ts     # Testes de autenticação
│   └── whatsapp.test.ts # Testes de WhatsApp
├── setup.ts             # Configuração global dos testes
└── README.md            # Este arquivo
```

## Pré-requisitos

1. **Banco de Dados de Teste:** Configure um banco separado para testes no `.env.test`
2. **Redis:** Redis deve estar rodando (pode ser o mesmo de desenvolvimento)
3. **Dependências:** Instale as dependências com `pnpm install`

## Executando os Testes

### Todos os testes
```bash
pnpm test
```

### Apenas testes de integração
```bash
pnpm test:integration
```

### Modo watch (desenvolvimento)
```bash
pnpm test:watch
```

### Com cobertura de código
```bash
pnpm test:coverage
```

## Configuração do Ambiente de Teste

Crie um arquivo `.env.test` na raiz de `apps/api`:

```bash
# Banco de Dados de Teste (IMPORTANTE: Use um banco separado!)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/primeflow_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=test_secret_key_for_integration_tests_only

# Supabase (pode usar o mesmo de desenvolvimento)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_ANON_KEY=sua_anon_key
```

## Criando o Banco de Teste

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de teste
CREATE DATABASE primeflow_test;

# Sair
\q

# Aplicar migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/primeflow_test pnpm prisma migrate deploy
```

## Escrevendo Novos Testes

### Estrutura Básica

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

describe('Meu Teste', () => {
  beforeAll(async () => {
    // Setup: criar dados de teste
  });

  afterAll(async () => {
    // Cleanup: limpar dados de teste
    await prisma.$disconnect();
  });

  it('deve fazer algo', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
```

### Boas Práticas

1. **Isolamento:** Cada teste deve ser independente e não depender de outros
2. **Cleanup:** Sempre limpe os dados criados no `afterAll` ou `afterEach`
3. **Nomes Descritivos:** Use nomes claros que descrevem o que está sendo testado
4. **Arrange-Act-Assert:** Organize o teste em 3 partes: preparação, ação e verificação
5. **Banco Separado:** NUNCA use o banco de produção ou desenvolvimento para testes

## Testes Implementados

### auth.test.ts
- ✅ Registro de usuário
- ✅ Login com credenciais válidas
- ✅ Validação de email e senha
- ✅ Proteção de rotas autenticadas
- ✅ Renovação de token
- ✅ Logout

### whatsapp.test.ts
- ✅ Iniciar conexão WhatsApp
- ✅ Obter QR Code
- ✅ Listar conexões
- ✅ Desconectar
- ✅ Publicação de eventos no Redis
- ✅ Isolamento por tenant

## Próximos Passos

- [ ] Testes para mensagens (messages.test.ts)
- [ ] Testes para conversas (conversations.test.ts)
- [ ] Testes para leads (leads.test.ts)
- [ ] Testes para campanhas (campaigns.test.ts)
- [ ] Testes para workflows (workflows.test.ts)

## Troubleshooting

### Erro: "Cannot find module"
```bash
# Recompilar pacote shared
cd ../../packages/shared
pnpm build
```

### Erro: "Connection refused" (Redis)
```bash
# Verificar se Redis está rodando
docker ps | grep redis

# Iniciar Redis
docker compose up -d redis
```

### Erro: "Database does not exist"
```bash
# Criar banco de teste
psql -U postgres -c "CREATE DATABASE primeflow_test;"

# Aplicar migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/primeflow_test pnpm prisma migrate deploy
```

### Testes lentos
- Verifique se está usando o banco de teste (não o de produção)
- Considere usar transações para rollback automático
- Use `beforeEach` em vez de `beforeAll` se houver conflitos de dados

## CI/CD

Os testes são executados automaticamente no GitHub Actions a cada push. Veja `.github/workflows/test.yml` para detalhes.
