/**
 * Serviço de AI-Powered Insights
 * Previsão de churn, recomendações de ações e análise preditiva
 */

import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import OpenAI from 'openai';

// Inicializar cliente OpenAI se a chave estiver configurada
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ChurnPrediction {
  leadId: string;
  churnRisk: number; // 0-1 (0 = baixo risco, 1 = alto risco)
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  lastInteraction?: Date;
  daysSinceLastContact?: number;
  recommendedActions: string[];
}

interface ActionRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  expectedImpact: string;
}

/**
 * Prevê o risco de churn para um conjunto de leads.
 * @param leadIds IDs dos leads a serem analisados
 * @returns Previsões de churn
 */
export async function predictChurn(leadIds: string[]): Promise<{
  success: boolean;
  predictions: ChurnPrediction[];
  summary?: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}> {
  logger.info({ leadIds, count: leadIds.length }, 'Predicting churn for leads');

  if (!openai) {
    logger.warn('OpenAI not configured. Using fallback churn prediction.');
    return fallbackChurnPrediction(leadIds);
  }

  try {
    // 1. Buscar leads com dados relacionados
    const leads = await prisma.leads.findMany({
      where: { id: { in: leadIds } },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5,
        },
        schedules: {
          orderBy: { startsAt: 'desc' },
          take: 3,
        },
      },
    });

    if (leads.length === 0) {
      logger.warn({ leadIds }, 'No leads found for churn prediction');
      return {
        success: false,
        predictions: [],
      };
    }

    // 2. Analisar cada lead
    const predictions: ChurnPrediction[] = await Promise.all(
      leads.map(async (lead) => {
        try {
          // Calcular features
          const features = calculateChurnFeatures(lead);

          // Usar IA para análise
          const prompt = `
Analise este lead e preveja o risco de churn (abandono):

Lead: ${lead.name || 'N/A'}
Status: ${lead.status || 'N/A'}
Score: ${lead.score || 'N/A'}
Dias desde último contato: ${features.daysSinceLastContact}
Total de mensagens: ${features.totalMessages}
Total de agendamentos: ${features.totalSchedules}
Mudanças de status recentes: ${features.statusChanges}
Tendência: ${features.trend}

Retorne um JSON com:
{
  "churnRisk": 0.75,  // 0-1
  "riskLevel": "high",  // low, medium, high
  "factors": ["fator 1", "fator 2"],
  "recommendedActions": ["ação 1", "ação 2"]
}
`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'Você é um especialista em análise preditiva de churn para CRM imobiliário.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 800,
          });

          const aiResponse = completion.choices[0].message.content || '{}';
          const prediction = parseChurnResponse(aiResponse, features);

          return {
            leadId: lead.id,
            churnRisk: prediction.churnRisk,
            riskLevel: prediction.riskLevel,
            factors: prediction.factors,
            lastInteraction: features.lastInteraction,
            daysSinceLastContact: features.daysSinceLastContact,
            recommendedActions: prediction.recommendedActions,
          };
        } catch (error) {
          logger.error({ error, leadId: lead.id }, 'Failed to predict churn for lead');
          return {
            leadId: lead.id,
            churnRisk: 0.5,
            riskLevel: 'medium' as const,
            factors: ['Erro na análise'],
            recommendedActions: ['Revisar manualmente'],
          };
        }
      })
    );

    // 3. Calcular resumo
    const summary = {
      highRisk: predictions.filter((p) => p.riskLevel === 'high').length,
      mediumRisk: predictions.filter((p) => p.riskLevel === 'medium').length,
      lowRisk: predictions.filter((p) => p.riskLevel === 'low').length,
    };

    logger.info({ summary, total: predictions.length }, 'Churn prediction completed');

    return {
      success: true,
      predictions,
      summary,
    };
  } catch (error) {
    logger.error({ error, leadIds }, 'Failed to predict churn');
    throw error;
  }
}

/**
 * Gera recomendações de ações para um lead específico.
 * @param leadId ID do lead
 * @returns Recomendações de ações
 */
export async function getActionRecommendations(leadId: string): Promise<{
  success: boolean;
  leadId: string;
  recommendations: ActionRecommendation[];
}> {
  logger.info({ leadId }, 'Generating action recommendations for lead');

  if (!openai) {
    logger.warn('OpenAI not configured. Using fallback recommendations.');
    return fallbackRecommendations(leadId);
  }

  try {
    // 1. Buscar lead com dados completos
    const lead = await prisma.leads.findUnique({
      where: { id: leadId },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5,
        },
        schedules: {
          orderBy: { startsAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // 2. Preparar contexto para IA
    const context = `
Lead: ${lead.name || 'N/A'}
Email: ${lead.email || 'N/A'}
Telefone: ${lead.phone || 'N/A'}
Status: ${lead.status || 'N/A'}
Stage: ${lead.stage || 'N/A'}
Score: ${lead.score || 'N/A'}
Fonte: ${lead.source || 'N/A'}

Últimas Mensagens:
${lead.messages?.map((m, i) => `${i + 1}. ${m.content?.substring(0, 100)}`).join('\n') || 'Nenhuma'}

Histórico de Status:
${lead.statusHistory?.map((h) => `${h.oldStatus} → ${h.newStatus}`).join('\n') || 'Nenhum'}

Agendamentos:
${lead.schedules?.map((s) => `${s.title} - ${s.status}`).join('\n') || 'Nenhum'}

Baseado nestes dados, sugira 3-5 ações específicas para aumentar o engajamento e conversão deste lead.

Retorne um JSON:
{
  "recommendations": [
    {
      "action": "descrição da ação",
      "priority": "high|medium|low",
      "reasoning": "justificativa",
      "expectedImpact": "impacto esperado"
    }
  ]
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em estratégias de vendas e engajamento para CRM imobiliário.',
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.4,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0].message.content || '{}';
    const parsed = parseRecommendationsResponse(aiResponse);

    logger.info({ leadId, recommendationCount: parsed.recommendations.length }, 'Recommendations generated');

    return {
      success: true,
      leadId,
      recommendations: parsed.recommendations,
    };
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to generate recommendations');
    throw error;
  }
}

/**
 * Calcula features para previsão de churn
 */
function calculateChurnFeatures(lead: any): any {
  const now = new Date();

  // Última interação
  const lastMessage = lead.messages?.[0];
  const lastInteraction = lastMessage?.createdAt || lead.createdAt;
  const daysSinceLastContact = Math.floor(
    (now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Contagens
  const totalMessages = lead.messages?.length || 0;
  const totalSchedules = lead.schedules?.length || 0;
  const statusChanges = lead.statusHistory?.length || 0;

  // Tendência (baseado em mudanças de status recentes)
  let trend = 'stable';
  if (lead.statusHistory?.length > 0) {
    const recentChanges = lead.statusHistory.slice(0, 2);
    if (recentChanges.some((h: any) => h.newStatus === 'Perdido' || h.newStatus === 'Inativo')) {
      trend = 'declining';
    } else if (recentChanges.some((h: any) => h.newStatus === 'Qualificado' || h.newStatus === 'Em Negociação')) {
      trend = 'improving';
    }
  }

  return {
    lastInteraction,
    daysSinceLastContact,
    totalMessages,
    totalSchedules,
    statusChanges,
    trend,
  };
}

/**
 * Parse da resposta de churn da IA
 */
function parseChurnResponse(response: string, features: any): any {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validar e ajustar churnRisk
      if (parsed.churnRisk !== undefined) {
        parsed.churnRisk = Math.max(0, Math.min(1, parsed.churnRisk));
      } else {
        // Calcular baseado em features se não fornecido
        parsed.churnRisk = calculateChurnRiskFromFeatures(features);
      }

      // Determinar riskLevel se não fornecido
      if (!parsed.riskLevel) {
        if (parsed.churnRisk >= 0.7) parsed.riskLevel = 'high';
        else if (parsed.churnRisk >= 0.4) parsed.riskLevel = 'medium';
        else parsed.riskLevel = 'low';
      }

      return parsed;
    }

    // Fallback
    return {
      churnRisk: calculateChurnRiskFromFeatures(features),
      riskLevel: 'medium',
      factors: ['Análise baseada em heurísticas'],
      recommendedActions: ['Entrar em contato'],
    };
  } catch (error) {
    logger.error({ error, response }, 'Failed to parse churn response');
    return {
      churnRisk: 0.5,
      riskLevel: 'medium',
      factors: ['Erro no parse'],
      recommendedActions: [],
    };
  }
}

/**
 * Calcula risco de churn baseado em features
 */
function calculateChurnRiskFromFeatures(features: any): number {
  let risk = 0;

  // Dias desde último contato (peso: 40%)
  if (features.daysSinceLastContact > 30) risk += 0.4;
  else if (features.daysSinceLastContact > 14) risk += 0.2;
  else if (features.daysSinceLastContact > 7) risk += 0.1;

  // Total de mensagens (peso: 20%)
  if (features.totalMessages === 0) risk += 0.2;
  else if (features.totalMessages < 3) risk += 0.1;

  // Agendamentos (peso: 20%)
  if (features.totalSchedules === 0) risk += 0.2;

  // Tendência (peso: 20%)
  if (features.trend === 'declining') risk += 0.2;
  else if (features.trend === 'improving') risk -= 0.1;

  return Math.max(0, Math.min(1, risk));
}

/**
 * Parse da resposta de recomendações da IA
 */
function parseRecommendationsResponse(response: string): any {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: extrair recomendações do texto
    const recommendations: ActionRecommendation[] = [];
    const lines = response.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      if (line.match(/^\d+\.|^-|^•/)) {
        recommendations.push({
          action: line.replace(/^\d+\.|^-|^•/, '').trim(),
          priority: 'medium',
          reasoning: 'Recomendação baseada em análise',
          expectedImpact: 'Melhoria no engajamento',
        });
      }
    }

    return { recommendations: recommendations.slice(0, 5) };
  } catch (error) {
    logger.error({ error, response }, 'Failed to parse recommendations response');
    return { recommendations: [] };
  }
}

/**
 * Fallback para previsão de churn quando OpenAI não está configurada
 */
async function fallbackChurnPrediction(leadIds: string[]) {
  const leads = await prisma.leads.findMany({
    where: { id: { in: leadIds } },
    include: {
      messages: true,
    },
  });

  const predictions: ChurnPrediction[] = leads.map((lead) => {
    const features = calculateChurnFeatures(lead);
    const churnRisk = calculateChurnRiskFromFeatures(features);

    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (churnRisk >= 0.7) riskLevel = 'high';
    else if (churnRisk < 0.4) riskLevel = 'low';

    return {
      leadId: lead.id,
      churnRisk,
      riskLevel,
      factors: ['Análise baseada em heurísticas (OpenAI não configurada)'],
      daysSinceLastContact: features.daysSinceLastContact,
      recommendedActions: ['Entrar em contato', 'Agendar follow-up'],
    };
  });

  return {
    success: true,
    predictions,
    summary: {
      highRisk: predictions.filter((p) => p.riskLevel === 'high').length,
      mediumRisk: predictions.filter((p) => p.riskLevel === 'medium').length,
      lowRisk: predictions.filter((p) => p.riskLevel === 'low').length,
    },
  };
}

/**
 * Fallback para recomendações quando OpenAI não está configurada
 */
async function fallbackRecommendations(leadId: string) {
  const defaultRecommendations: ActionRecommendation[] = [
    {
      action: 'Enviar email de acompanhamento',
      priority: 'high',
      reasoning: 'Reativar contato com o lead',
      expectedImpact: 'Aumento de 30% no engajamento',
    },
    {
      action: 'Agendar ligação de follow-up',
      priority: 'high',
      reasoning: 'Contato direto para entender necessidades',
      expectedImpact: 'Qualificação do lead',
    },
    {
      action: 'Enviar material relevante (catálogo, simulação)',
      priority: 'medium',
      reasoning: 'Manter interesse e fornecer informações',
      expectedImpact: 'Educação do lead',
    },
  ];

  return {
    success: true,
    leadId,
    recommendations: defaultRecommendations,
  };
}

/**
 * Verifica se o serviço de Insights está configurado.
 * @returns true se configurado, false caso contrário
 */
export function isInsightsConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
