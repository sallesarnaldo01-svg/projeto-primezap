import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import {
  predictChurn,
  getRecommendations,
  analyzeContactBehavior,
} from '../../src/services/insights.service';
import { prisma } from '../../src/lib/prisma';
import OpenAI from 'openai';

// Mock do OpenAI
vi.mock('openai');

describe('Insights Service', () => {
  let testTenantId: string;
  let testContactId: string;
  let testContactIdActive: string;
  let testContactIdInactive: string;

  beforeAll(async () => {
    testTenantId = `test-tenant-insights-${Date.now()}`;

    // Criar contato em risco (sem atividade recente)
    const contact = await prisma.contacts.create({
      data: {
        name: 'João Silva',
        email: 'joao@example.com',
        phone: '+5511999999999',
        tenantId: testTenantId,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 dias atrás
        lastContactAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 dias atrás
      },
    });
    testContactId = contact.id;

    // Criar contato ativo (atividade recente)
    const contactActive = await prisma.contacts.create({
      data: {
        name: 'Maria Santos',
        email: 'maria@example.com',
        phone: '+5511988888888',
        tenantId: testTenantId,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
        lastContactAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
      },
    });
    testContactIdActive = contactActive.id;

    // Criar contato inativo (muito tempo sem contato)
    const contactInactive = await prisma.contacts.create({
      data: {
        name: 'Pedro Oliveira',
        email: 'pedro@example.com',
        phone: '+5511977777777',
        tenantId: testTenantId,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180 dias atrás
        lastContactAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 dias atrás
      },
    });
    testContactIdInactive = contactInactive.id;

    // Criar algumas mensagens para os contatos
    await prisma.messages.createMany({
      data: [
        {
          contactId: testContactIdActive,
          tenantId: testTenantId,
          content: 'Mensagem recente',
          direction: 'inbound',
          platform: 'whatsapp',
          status: 'delivered',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          contactId: testContactIdActive,
          tenantId: testTenantId,
          content: 'Outra mensagem',
          direction: 'outbound',
          platform: 'whatsapp',
          status: 'delivered',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          contactId: testContactId,
          tenantId: testTenantId,
          content: 'Mensagem antiga',
          direction: 'inbound',
          platform: 'whatsapp',
          status: 'delivered',
          createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  });

  afterAll(async () => {
    // Limpar dados de teste
    await prisma.messages.deleteMany({
      where: { tenantId: testTenantId },
    });
    await prisma.contacts.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('predictChurn', () => {
    it('deve prever alto risco de churn para contato inativo', async () => {
      const mockPrediction = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                churnScore: 0.85,
                riskLevel: 'high',
                factors: [
                  'Sem contato há 90 dias',
                  'Baixo engajamento',
                  'Nenhuma mensagem recente',
                ],
                recommendations: [
                  'Contato urgente necessário',
                  'Oferecer promoção especial',
                  'Verificar satisfação',
                ],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockPrediction);

      const result = await predictChurn(testContactIdInactive);

      expect(result.churnScore).toBeGreaterThan(0.7);
      expect(result.riskLevel).toBe('high');
      expect(result.factors).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('deve prever baixo risco de churn para contato ativo', async () => {
      const mockPrediction = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                churnScore: 0.15,
                riskLevel: 'low',
                factors: [
                  'Contato recente (2 dias)',
                  'Bom engajamento',
                  'Mensagens frequentes',
                ],
                recommendations: [
                  'Manter relacionamento atual',
                  'Considerar upsell',
                ],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockPrediction);

      const result = await predictChurn(testContactIdActive);

      expect(result.churnScore).toBeLessThan(0.3);
      expect(result.riskLevel).toBe('low');
    });

    it('deve prever risco médio de churn para contato moderado', async () => {
      const mockPrediction = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                churnScore: 0.55,
                riskLevel: 'medium',
                factors: [
                  'Contato há 45 dias',
                  'Engajamento moderado',
                ],
                recommendations: [
                  'Reengajar com conteúdo relevante',
                  'Verificar necessidades',
                ],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockPrediction);

      const result = await predictChurn(testContactId);

      expect(result.churnScore).toBeGreaterThan(0.3);
      expect(result.churnScore).toBeLessThan(0.7);
      expect(result.riskLevel).toBe('medium');
    });

    it('deve usar fallback quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await predictChurn(testContactIdInactive);

      // Deve usar heurísticas
      expect(result.churnScore).toBeDefined();
      expect(result.churnScore).toBeGreaterThanOrEqual(0);
      expect(result.churnScore).toBeLessThanOrEqual(1);
      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.riskLevel);

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve calcular features corretamente', async () => {
      const mockPrediction = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                churnScore: 0.5,
                riskLevel: 'medium',
                factors: [],
                recommendations: [],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      const mockCreate = vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockPrediction);

      await predictChurn(testContactId);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

      // Verificar se features foram incluídas
      expect(userMessage.content).toContain('daysSinceLastContact');
      expect(userMessage.content).toContain('messageCount');
    });

    it('deve retornar erro quando contato não existe', async () => {
      await expect(predictChurn('invalid-uuid-123')).rejects.toThrow();
    });

    it('deve lidar com erro da IA gracefully', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockRejectedValue(
        new Error('AI error')
      );

      const result = await predictChurn(testContactId);

      // Deve usar fallback heurístico
      expect(result.churnScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });
  });

  describe('getRecommendations', () => {
    it('deve gerar recomendações personalizadas para contato', async () => {
      const mockRecommendations = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    type: 'engagement',
                    priority: 'high',
                    action: 'Enviar mensagem personalizada',
                    reason: 'Contato sem interação há 45 dias',
                  },
                  {
                    type: 'content',
                    priority: 'medium',
                    action: 'Compartilhar novidades',
                    reason: 'Manter interesse',
                  },
                ],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockRecommendations);

      const result = await getRecommendations(testContactId);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toHaveProperty('type');
      expect(result.recommendations[0]).toHaveProperty('priority');
      expect(result.recommendations[0]).toHaveProperty('action');
      expect(result.recommendations[0]).toHaveProperty('reason');
    });

    it('deve priorizar recomendações por urgência', async () => {
      const mockRecommendations = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    type: 'urgent',
                    priority: 'high',
                    action: 'Contato imediato',
                    reason: 'Risco de perda',
                  },
                  {
                    type: 'routine',
                    priority: 'low',
                    action: 'Follow-up de rotina',
                    reason: 'Manutenção de relacionamento',
                  },
                ],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockRecommendations);

      const result = await getRecommendations(testContactIdInactive);

      const highPriorityRecs = result.recommendations.filter(r => r.priority === 'high');
      expect(highPriorityRecs.length).toBeGreaterThan(0);
    });

    it('deve incluir contexto do contato nas recomendações', async () => {
      const mockRecommendations = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    type: 'personalized',
                    priority: 'medium',
                    action: 'Oferta personalizada',
                    reason: 'Baseado no histórico',
                  },
                ],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      const mockCreate = vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockRecommendations);

      await getRecommendations(testContactId);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

      expect(userMessage.content).toContain('João Silva');
      expect(userMessage.content).toContain('joao@example.com');
    });

    it('deve usar fallback quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await getRecommendations(testContactId);

      // Deve retornar recomendações baseadas em heurísticas
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve retornar erro quando contato não existe', async () => {
      await expect(getRecommendations('invalid-uuid-456')).rejects.toThrow();
    });
  });

  describe('analyzeContactBehavior', () => {
    it('deve analisar comportamento completo do contato', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                engagementLevel: 'medium',
                preferredChannel: 'whatsapp',
                bestTimeToContact: '14:00-16:00',
                interests: ['Imóveis', 'Investimentos'],
                buyingSignals: ['Perguntou sobre preços', 'Solicitou visita'],
                nextBestAction: 'Agendar visita ao imóvel',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeContactBehavior(testContactId);

      expect(result.engagementLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.engagementLevel);
      expect(result.preferredChannel).toBeDefined();
      expect(result.interests).toBeDefined();
      expect(result.nextBestAction).toBeDefined();
    });

    it('deve identificar contato altamente engajado', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                engagementLevel: 'high',
                preferredChannel: 'whatsapp',
                bestTimeToContact: '10:00-12:00',
                interests: ['Produto Premium'],
                buyingSignals: ['Pronto para comprar', 'Solicitou proposta'],
                nextBestAction: 'Enviar proposta comercial',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeContactBehavior(testContactIdActive);

      expect(result.engagementLevel).toBe('high');
      expect(result.buyingSignals).toBeDefined();
      expect(result.buyingSignals.length).toBeGreaterThan(0);
    });

    it('deve identificar contato pouco engajado', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                engagementLevel: 'low',
                preferredChannel: 'email',
                bestTimeToContact: 'any',
                interests: [],
                buyingSignals: [],
                nextBestAction: 'Reengajar com conteúdo relevante',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeContactBehavior(testContactIdInactive);

      expect(result.engagementLevel).toBe('low');
    });

    it('deve incluir histórico de mensagens na análise', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                engagementLevel: 'medium',
                preferredChannel: 'whatsapp',
                interests: ['Baseado em mensagens'],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      const mockCreate = vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      await analyzeContactBehavior(testContactIdActive);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

      expect(userMessage.content).toContain('messageCount');
    });

    it('deve usar fallback quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await analyzeContactBehavior(testContactId);

      expect(result.engagementLevel).toBeDefined();
      expect(result.preferredChannel).toBeDefined();

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve retornar erro quando contato não existe', async () => {
      await expect(analyzeContactBehavior('invalid-uuid-789')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com timeout da IA', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await predictChurn(testContactId);

      // Deve usar fallback
      expect(result.churnScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('deve lidar com resposta malformada da IA', async () => {
      const mockBadResponse = {
        choices: [
          {
            message: {
              content: 'resposta inválida não-JSON',
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockBadResponse);

      const result = await predictChurn(testContactId);

      // Deve usar fallback
      expect(result.churnScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('deve lidar com erro de rede', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockRejectedValue(
        new Error('Network error')
      );

      const result = await predictChurn(testContactId);

      expect(result.churnScore).toBeDefined();
    });
  });
});
