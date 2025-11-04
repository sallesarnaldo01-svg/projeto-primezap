import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';

describe('CRM Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let tenantId: string;
  let contactId: string;
  let dealId: string;
  let stageId: string;

  const testUser = {
    email: 'crm-test@primezap.com',
    password: 'Test123!@#',
    name: 'CRM Test User',
  };

  beforeAll(async () => {
    // Criar usuário de teste
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;

    // Obter tenant do usuário
    const user = await prisma.public_users.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    tenantId = user?.tenantId || '';

    // Criar stage de teste
    const stage = await prisma.stages.create({
      data: {
        tenantId,
        name: 'Qualificação',
        order: 1,
      },
    });
    stageId = stage.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (dealId) {
      await prisma.deals.delete({
        where: { id: dealId },
      });
    }
    if (contactId) {
      await prisma.contacts.delete({
        where: { id: contactId },
      });
    }
    if (stageId) {
      await prisma.stages.delete({
        where: { id: stageId },
      });
    }
    if (userId) {
      await prisma.public_users.delete({
        where: { id: userId },
      });
    }
    await prisma.$disconnect();
  });

  describe('Contacts API', () => {
    describe('POST /api/contacts', () => {
      it('deve criar um novo contato com sucesso', async () => {
        const response = await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'João Silva',
            phone: '+5511987654321',
            email: 'joao.silva@example.com',
            tags: ['cliente', 'vip'],
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('João Silva');
        expect(response.body.phone).toBe('+5511987654321');
        expect(response.body.email).toBe('joao.silva@example.com');

        contactId = response.body.id;
      });

      it('não deve permitir criar contato sem nome', async () => {
        const response = await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            phone: '+5511999999999',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('não deve permitir criar contato com email inválido', async () => {
        const response = await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test',
            email: 'email-invalido',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/contacts', () => {
      it('deve listar todos os contatos', async () => {
        const response = await request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

      it('deve suportar busca por nome', async () => {
        const response = await request(app)
          .get('/api/contacts')
          .query({ search: 'João' })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('deve suportar paginação', async () => {
        const response = await request(app)
          .get('/api/contacts')
          .query({ limit: 10, offset: 0 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(10);
      });
    });

    describe('GET /api/contacts/:id', () => {
      it('deve buscar um contato específico', async () => {
        const response = await request(app)
          .get(`/api/contacts/${contactId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', contactId);
        expect(response.body.name).toBe('João Silva');
      });

      it('deve retornar 404 para contato inexistente', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/api/contacts/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PATCH /api/contacts/:id', () => {
      it('deve atualizar um contato', async () => {
        const response = await request(app)
          .patch(`/api/contacts/${contactId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'João Silva Atualizado',
            notes: 'Cliente VIP atualizado',
          })
          .expect(200);

        expect(response.body.name).toBe('João Silva Atualizado');
        expect(response.body.notes).toBe('Cliente VIP atualizado');
      });
    });
  });

  describe('Deals API', () => {
    describe('POST /api/deals', () => {
      it('deve criar um novo deal com sucesso', async () => {
        const response = await request(app)
          .post('/api/deals')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Venda de Software',
            contactId,
            stageId,
            value: 15000.00,
            currency: 'BRL',
            probability: 70,
            expectedCloseDate: '2025-12-31',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe('Venda de Software');
        expect(response.body.value).toBe('15000.00');
        expect(response.body.probability).toBe(70);

        dealId = response.body.id;
      });

      it('não deve permitir criar deal sem título', async () => {
        const response = await request(app)
          .post('/api/deals')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            contactId,
            value: 10000,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('não deve permitir criar deal com valor negativo', async () => {
        const response = await request(app)
          .post('/api/deals')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Deal Inválido',
            value: -1000,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/deals', () => {
      it('deve listar todos os deals', async () => {
        const response = await request(app)
          .get('/api/deals')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

      it('deve filtrar deals por stage', async () => {
        const response = await request(app)
          .get('/api/deals')
          .query({ stageId })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('deve filtrar deals por valor mínimo', async () => {
        const response = await request(app)
          .get('/api/deals')
          .query({ minValue: 10000 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(parseFloat(response.body[0].value)).toBeGreaterThanOrEqual(10000);
        }
      });
    });

    describe('GET /api/deals/:id', () => {
      it('deve buscar um deal específico', async () => {
        const response = await request(app)
          .get(`/api/deals/${dealId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', dealId);
        expect(response.body.title).toBe('Venda de Software');
      });
    });

    describe('PATCH /api/deals/:id', () => {
      it('deve atualizar um deal', async () => {
        const response = await request(app)
          .patch(`/api/deals/${dealId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Venda de Software - Atualizado',
            probability: 90,
            notes: 'Cliente demonstrou muito interesse',
          })
          .expect(200);

        expect(response.body.title).toBe('Venda de Software - Atualizado');
        expect(response.body.probability).toBe(90);
      });

      it('deve registrar histórico ao mudar de stage', async () => {
        const response = await request(app)
          .patch(`/api/deals/${dealId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            stageId,
          })
          .expect(200);

        // Verificar se o histórico foi criado
        const history = await prisma.deal_history.findMany({
          where: { dealId },
        });

        expect(history.length).toBeGreaterThan(0);
      });
    });

    describe('DELETE /api/deals/:id', () => {
      it('deve deletar um deal', async () => {
        const response = await request(app)
          .delete(`/api/deals/${dealId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message');

        // Verificar se foi realmente deletado
        const checkResponse = await request(app)
          .get(`/api/deals/${dealId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        dealId = ''; // Limpar para não tentar deletar novamente no afterAll
      });
    });
  });

  describe('CRM Analytics', () => {
    it('deve retornar métricas do funil de vendas', async () => {
      const response = await request(app)
        .get('/api/crm/analytics/funnel')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stages');
      expect(Array.isArray(response.body.stages)).toBe(true);
    });

    it('deve retornar taxa de conversão', async () => {
      const response = await request(app)
        .get('/api/crm/analytics/conversion-rate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('rate');
      expect(typeof response.body.rate).toBe('number');
    });

    it('deve retornar valor total em pipeline', async () => {
      const response = await request(app)
        .get('/api/crm/analytics/pipeline-value')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(typeof response.body.total).toBe('number');
    });
  });
});
