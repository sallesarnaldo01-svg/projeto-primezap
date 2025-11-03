import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { redis } from '../../src/lib/redis';

describe('WhatsApp Integration Tests', () => {
  let authToken: string;
  let tenantId: string;
  let connectionId: string;

  beforeAll(async () => {
    // Criar usuário de teste e obter token
    const testUser = {
      email: 'whatsapp-test@primezap.com',
      password: 'Test123!@#',
      name: 'WhatsApp Test User',
    };

    // Limpar dados anteriores
    await prisma.profiles.deleteMany({
      where: { email: testUser.email },
    });

    // Registrar usuário
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    authToken = registerResponse.body.token;
    tenantId = registerResponse.body.user.tenantId;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (connectionId) {
      await prisma.connections.deleteMany({
        where: { id: connectionId },
      });
    }

    await prisma.profiles.deleteMany({
      where: { email: 'whatsapp-test@primezap.com' },
    });

    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    // Limpar conexões de teste anteriores
    await prisma.connections.deleteMany({
      where: {
        tenantId,
        type: 'WHATSAPP',
      },
    });
  });

  describe('POST /api/whatsapp/initiate', () => {
    it('deve iniciar uma conexão WhatsApp com sucesso', async () => {
      const response = await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Conexão de Teste',
          provider: 'baileys',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('CONNECTING');
      expect(response.body.provider).toBe('baileys');

      connectionId = response.body.id;
    });

    it('deve aceitar número de telefone opcional', async () => {
      const response = await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Conexão com Telefone',
          provider: 'baileys',
          phone: '5511999999999',
        })
        .expect(201);

      expect(response.body.phone).toBe('5511999999999');
      connectionId = response.body.id;
    });

    it('não deve permitir iniciar conexão sem autenticação', async () => {
      const response = await request(app)
        .post('/api/whatsapp/initiate')
        .send({
          name: 'Conexão Não Autorizada',
          provider: 'baileys',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('deve publicar evento no Redis', async () => {
      // Subscrever ao canal antes de fazer a requisição
      const subscriber = redis.duplicate();
      await subscriber.connect();

      const eventPromise = new Promise((resolve) => {
        subscriber.subscribe('whatsapp:connect', (message) => {
          resolve(JSON.parse(message));
        });
      });

      const response = await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Teste Redis',
          provider: 'baileys',
        })
        .expect(201);

      connectionId = response.body.id;

      // Aguardar evento do Redis (com timeout)
      const event = await Promise.race([
        eventPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]) as any;

      expect(event).toHaveProperty('connectionId');
      expect(event.connectionId).toBe(connectionId);
      expect(event.provider).toBe('baileys');

      await subscriber.quit();
    });
  });

  describe('GET /api/whatsapp/qr/:connectionId', () => {
    beforeEach(async () => {
      // Criar uma conexão para testar
      const response = await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Conexão QR Test',
          provider: 'baileys',
        });

      connectionId = response.body.id;
    });

    it('deve retornar 204 quando QR Code ainda não foi gerado', async () => {
      const response = await request(app)
        .get(`/api/whatsapp/qr/${connectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      expect(response.body).toEqual({});
    });

    it('deve retornar QR Code quando disponível', async () => {
      // Simular QR Code no banco
      await prisma.connections.update({
        where: { id: connectionId },
        data: {
          config: {
            qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
          },
        },
      });

      const response = await request(app)
        .get(`/api/whatsapp/qr/${connectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('qrCode');
      expect(response.body.qrCode).toContain('data:image');
    });

    it('não deve retornar QR Code de outra tenant', async () => {
      // Criar outro usuário
      const otherUser = {
        email: 'other@test.com',
        password: 'Test123!@#',
        name: 'Other User',
      };

      const otherResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUser);

      const otherToken = otherResponse.body.token;

      // Tentar acessar QR Code de outra tenant
      const response = await request(app)
        .get(`/api/whatsapp/qr/${connectionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(204);

      // Limpar
      await prisma.profiles.deleteMany({
        where: { email: otherUser.email },
      });
    });
  });

  describe('GET /api/whatsapp/connections', () => {
    it('deve listar conexões do tenant', async () => {
      // Criar algumas conexões
      await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Conexão 1', provider: 'baileys' });

      await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Conexão 2', provider: 'venom' });

      const response = await request(app)
        .get('/api/whatsapp/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('não deve listar conexões sem autenticação', async () => {
      const response = await request(app)
        .get('/api/whatsapp/connections')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/whatsapp/disconnect/:connectionId', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/whatsapp/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Conexão para Deletar', provider: 'baileys' });

      connectionId = response.body.id;
    });

    it('deve desconectar uma conexão com sucesso', async () => {
      const response = await request(app)
        .delete(`/api/whatsapp/disconnect/${connectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verificar se status foi atualizado
      const connection = await prisma.connections.findUnique({
        where: { id: connectionId },
      });

      expect(connection?.status).toBe('DISCONNECTED');
    });

    it('não deve desconectar conexão de outra tenant', async () => {
      // Criar outro usuário
      const otherUser = {
        email: 'disconnect-other@test.com',
        password: 'Test123!@#',
        name: 'Other User',
      };

      const otherResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUser);

      const otherToken = otherResponse.body.token;

      // Tentar desconectar conexão de outra tenant
      const response = await request(app)
        .delete(`/api/whatsapp/disconnect/${connectionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      // Limpar
      await prisma.profiles.deleteMany({
        where: { email: otherUser.email },
      });
    });
  });
});
