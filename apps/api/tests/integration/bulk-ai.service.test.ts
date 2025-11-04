import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { classifyLeadsBulk, enrichContactsBulk } from '../../src/services/bulk-ai.service';
import { prisma } from '../../src/lib/prisma';
import OpenAI from 'openai';

// Mock do OpenAI
vi.mock('openai');

describe('Bulk AI Service', () => {
  let testTenantId: string;
  let testLeadIds: string[];
  let testContactIds: string[];

  beforeAll(async () => {
    // Criar tenant de teste
    testTenantId = `test-tenant-${Date.now()}`;

    // Criar leads de teste
    const lead1 = await prisma.leads.create({
      data: {
        name: 'João Silva',
        email: 'joao@example.com',
        phone: '+5511999999999',
        status: 'Novo',
        score: 50,
        stage: 'Prospecção',
        tenantId: testTenantId,
        source: 'Website',
        notes: 'Interessado em imóvel de 3 quartos',
      },
    });

    const lead2 = await prisma.leads.create({
      data: {
        name: 'Maria Santos',
        email: 'maria@example.com',
        phone: '+5511988888888',
        status: 'Novo',
        score: 30,
        stage: 'Prospecção',
        tenantId: testTenantId,
        source: 'Facebook',
        notes: 'Procura apartamento no centro',
      },
    });

    const lead3 = await prisma.leads.create({
      data: {
        name: 'Pedro Oliveira',
        email: 'pedro@example.com',
        phone: '+5511977777777',
        status: 'Qualificado',
        score: 75,
        stage: 'Negociação',
        tenantId: testTenantId,
        source: 'Indicação',
        notes: 'Cliente premium, orçamento alto',
      },
    });

    testLeadIds = [lead1.id, lead2.id, lead3.id];

    // Criar contatos de teste
    const contact1 = await prisma.contacts.create({
      data: {
        name: 'Ana Costa',
        email: 'ana@example.com',
        phone: '+5511966666666',
        tenantId: testTenantId,
      },
    });

    const contact2 = await prisma.contacts.create({
      data: {
        name: 'Carlos Souza',
        email: 'carlos@techcorp.com',
        phone: '+5511955555555',
        tenantId: testTenantId,
        company: 'Tech Corp',
      },
    });

    testContactIds = [contact1.id, contact2.id];
  });

  afterAll(async () => {
    // Limpar dados de teste
    await prisma.leadStatusHistory.deleteMany({
      where: { lead: { tenantId: testTenantId } },
    });
    await prisma.leads.deleteMany({
      where: { tenantId: testTenantId },
    });
    await prisma.contacts.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  beforeEach(() => {
    // Limpar todos os mocks antes de cada teste
    vi.clearAllMocks();
  });

  describe('classifyLeadsBulk', () => {
    it('deve classificar leads por status com sucesso', async () => {
      // Mock da resposta do OpenAI
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                newStatus: 'Qualificado',
                reasoning: 'Lead demonstrou interesse concreto e tem perfil adequado',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await classifyLeadsBulk([testLeadIds[0]], 'status');

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toHaveProperty('leadId');
      expect(result.results[0]).toHaveProperty('newStatus');
      expect(result.results[0]).toHaveProperty('reasoning');
      expect(result.results[0].newStatus).toBe('Qualificado');
    });

    it('deve classificar leads por score', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 85,
                reasoning: 'Alto potencial de conversão baseado no perfil e engajamento',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await classifyLeadsBulk([testLeadIds[1]], 'score');

      expect(result.success).toBe(true);
      expect(result.results[0].score).toBeGreaterThanOrEqual(0);
      expect(result.results[0].score).toBeLessThanOrEqual(100);
      expect(result.results[0].score).toBe(85);
    });

    it('deve classificar leads por stage', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                newStage: 'Negociação',
                reasoning: 'Lead está pronto para avançar para negociação',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await classifyLeadsBulk([testLeadIds[0]], 'stage');

      expect(result.success).toBe(true);
      expect(result.results[0]).toHaveProperty('newStage');
      expect(result.results[0].newStage).toBe('Negociação');
    });

    it('deve processar múltiplos leads em lote', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                newStatus: 'Qualificado',
                reasoning: 'Lead qualificado',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await classifyLeadsBulk(testLeadIds, 'status');

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('deve usar fallback quando OpenAI não configurado', async () => {
      // Remover temporariamente a API key
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await classifyLeadsBulk([testLeadIds[0]], 'status');

      expect(result.success).toBe(true);
      expect(result.message).toContain('fallback');
      expect(result.results[0]).toHaveProperty('newStatus');

      // Restaurar API key
      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve retornar erro quando leads não existem', async () => {
      const result = await classifyLeadsBulk(['invalid-uuid-123'], 'status');

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });

    it('deve registrar histórico de mudança de status', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                newStatus: 'Qualificado',
                reasoning: 'Lead qualificado por IA',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const leadId = testLeadIds[0];
      const leadBefore = await prisma.leads.findUnique({ where: { id: leadId } });

      await classifyLeadsBulk([leadId], 'status');

      const history = await prisma.leadStatusHistory.findFirst({
        where: { leadId },
        orderBy: { changedAt: 'desc' },
      });

      expect(history).toBeTruthy();
      expect(history?.oldStatus).toBe(leadBefore?.status);
      expect(history?.newStatus).toBe('Qualificado');
    });

    it('deve aceitar prompt customizado', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                newStatus: 'Premium',
                reasoning: 'Lead classificado como premium',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      const mockCreate = vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const customPrompt = 'Classifique este lead como Premium se tiver alto orçamento';
      await classifyLeadsBulk([testLeadIds[2]], 'status', customPrompt);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(customPrompt);
    });
  });

  describe('enrichContactsBulk', () => {
    it('deve enriquecer contatos com dados da IA', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                company: 'Tech Solutions',
                industry: 'Tecnologia',
                jobTitle: 'Desenvolvedora',
                linkedinUrl: 'https://linkedin.com/in/ana-costa',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await enrichContactsBulk([testContactIds[0]]);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.results[0].enrichedData).toHaveProperty('industry');
      expect(result.results[0].enrichedData.industry).toBe('Tecnologia');
    });

    it('deve processar múltiplos contatos em lote', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                industry: 'Tecnologia',
                jobTitle: 'Desenvolvedor',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await enrichContactsBulk(testContactIds);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('deve atualizar apenas campos vazios', async () => {
      const contactId = testContactIds[1]; // Carlos já tem company
      const contactBefore = await prisma.contacts.findUnique({ where: { id: contactId } });

      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                company: 'Nova Empresa',
                industry: 'Tecnologia',
                jobTitle: 'CTO',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      await enrichContactsBulk([contactId]);

      const contactAfter = await prisma.contacts.findUnique({ where: { id: contactId } });

      // Company não deve ser atualizada (já existia)
      expect(contactAfter?.company).toBe(contactBefore?.company);
      // Industry deve ser adicionada (era null)
      expect(contactAfter?.industry).toBe('Tecnologia');
    });

    it('deve usar fallback quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await enrichContactsBulk([testContactIds[0]]);

      expect(result.success).toBe(true);
      expect(result.message).toContain('fallback');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve retornar erro quando contatos não existem', async () => {
      const result = await enrichContactsBulk(['invalid-uuid-456']);

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });

    it('deve lidar com respostas malformadas da IA', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: 'resposta inválida não-JSON',
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      const result = await enrichContactsBulk([testContactIds[0]]);

      // Deve usar fallback quando parsing falha
      expect(result.success).toBe(true);
      expect(result.successCount).toBeGreaterThan(0);
    });

    it('deve incluir informações de contexto no enriquecimento', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                industry: 'Tecnologia',
              }),
            },
          },
        ],
      });

      // @ts-ignore
      OpenAI.prototype.chat.completions.create = mockCreate;

      await enrichContactsBulk([testContactIds[0]]);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toContain('Ana Costa');
      expect(userMessage.content).toContain('ana@example.com');
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com erro de rede do OpenAI', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockRejectedValue(
        new Error('Network error')
      );

      const result = await classifyLeadsBulk([testLeadIds[0]], 'status');

      // Deve usar fallback
      expect(result.success).toBe(true);
      expect(result.message).toContain('fallback');
    });

    it('deve lidar com timeout do OpenAI', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await classifyLeadsBulk([testLeadIds[0]], 'status');

      expect(result.success).toBe(true);
    });

    it('deve continuar processando mesmo se um lead falhar', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                newStatus: 'Qualificado',
                reasoning: 'Lead qualificado',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockCompletion);

      // Incluir um ID inválido no meio
      const result = await classifyLeadsBulk(
        [testLeadIds[0], 'invalid-id', testLeadIds[1]],
        'status'
      );

      expect(result.processedCount).toBe(3);
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.failedCount).toBeGreaterThan(0);
    });
  });
});
