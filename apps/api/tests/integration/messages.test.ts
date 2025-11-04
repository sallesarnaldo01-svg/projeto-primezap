import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';

describe('Messages Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let tenantId: string;
  let contactId: string;
  let conversationId: string;
  let messageId: string;

  const testUser = {
    email: 'messages-test@primezap.com',
    password: 'Test123!@#',
    name: 'Messages Test User',
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

    // Criar contato de teste
    const contact = await prisma.contacts.create({
      data: {
        tenantId,
        name: 'Test Contact',
        phone: '+5511999999999',
        email: 'contact@test.com',
      },
    });
    contactId = contact.id;

    // Criar conversação de teste
    const conversation = await prisma.Conversation.create({
      data: {
        tenantId,
        contactId,
        channel: 'whatsapp',
        status: 'OPEN',
      },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (conversationId) {
      await prisma.Message.deleteMany({
        where: { conversationId },
      });
      await prisma.Conversation.delete({
        where: { id: conversationId },
      });
    }
    if (contactId) {
      await prisma.contacts.delete({
        where: { id: contactId },
      });
    }
    if (userId) {
      await prisma.public_users.delete({
        where: { id: userId },
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /api/messages', () => {
    it('deve enviar uma mensagem de texto com sucesso', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId,
          content: 'Olá, esta é uma mensagem de teste!',
          type: 'text',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Olá, esta é uma mensagem de teste!');
      expect(response.body.type).toBe('text');
      expect(response.body.conversationId).toBe(conversationId);

      messageId = response.body.id;
    });

    it('deve enviar uma mensagem com mídia', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId,
          content: 'Mensagem com imagem',
          type: 'image',
          mediaUrl: 'https://example.com/image.jpg',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('image');
      expect(response.body.mediaUrl).toBe('https://example.com/image.jpg');
    });

    it('não deve permitir envio sem autenticação', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          content: 'Mensagem sem auth',
          type: 'text',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('não deve permitir envio sem conversationId', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Mensagem sem conversação',
          type: 'text',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/messages/:conversationId', () => {
    it('deve listar mensagens de uma conversação', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('type');
    });

    it('deve suportar paginação', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversationId}`)
        .query({ limit: 10, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('não deve listar mensagens sem autenticação', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversationId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/messages/:id', () => {
    it('deve buscar uma mensagem específica', async () => {
      const response = await request(app)
        .get(`/api/messages/single/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', messageId);
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('type');
    });

    it('deve retornar 404 para mensagem inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/messages/single/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/messages/:id', () => {
    it('deve atualizar o status de uma mensagem', async () => {
      const response = await request(app)
        .patch(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'read',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', messageId);
      expect(response.body.status).toBe('read');
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('deve deletar uma mensagem', async () => {
      const response = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deletada');

      // Verificar se foi realmente deletada
      const checkResponse = await request(app)
        .get(`/api/messages/single/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/messages/bulk', () => {
    it('deve enviar mensagens em lote', async () => {
      const response = await request(app)
        .post('/api/messages/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationIds: [conversationId],
          content: 'Mensagem em lote',
          type: 'text',
        })
        .expect(201);

      expect(response.body).toHaveProperty('sent');
      expect(response.body.sent).toBeGreaterThan(0);
    });
  });

  describe('GET /api/messages/search', () => {
    it('deve buscar mensagens por conteúdo', async () => {
      const response = await request(app)
        .get('/api/messages/search')
        .query({ q: 'teste' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('deve filtrar mensagens por tipo', async () => {
      const response = await request(app)
        .get('/api/messages/search')
        .query({ type: 'text' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0].type).toBe('text');
      }
    });

    it('deve filtrar mensagens por período', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get('/api/messages/search')
        .query({ startDate: today })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
