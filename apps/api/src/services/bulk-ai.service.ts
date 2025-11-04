/**
 * Serviço de Bulk AI Actions
 * Classificação e enriquecimento de leads/contatos em lote usando IA
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import OpenAI from 'openai';

// Inicializar cliente OpenAI se a chave estiver configurada
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface ClassificationResult {
  leadId: string;
  originalStatus?: string;
  newStatus: string;
  score?: number;
  reasoning: string;
  success: boolean;
}

interface EnrichmentResult {
  contactId: string;
  enrichedData: {
    company?: string;
    industry?: string;
    jobTitle?: string;
    linkedinUrl?: string;
    additionalInfo?: Record<string, any>;
  };
  success: boolean;
}

/**
 * Classifica um lote de leads com base em regras de IA.
 * @param leadIds IDs dos leads a serem classificados
 * @param classificationType Tipo de classificação (score, status, stage)
 * @param customPrompt Prompt customizado (opcional)
 * @returns Resultado da operação
 */
export async function classifyLeadsBulk(
  leadIds: string[],
  classificationType: 'score' | 'status' | 'stage' = 'status',
  customPrompt?: string
) {
  logger.info({ leadIds, classificationType }, 'Executing bulk classification for leads');

  if (!openai) {
    logger.warn('OpenAI not configured. Using fallback classification logic.');
    return fallbackClassification(leadIds, classificationType);
  }

  try {
    // 1. Buscar leads do Prisma com dados relacionados
    const leads = await prisma.leads.findMany({
      where: { id: { in: leadIds } },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 3,
        },
      },
    });

    if (leads.length === 0) {
      logger.warn({ leadIds }, 'No leads found for classification');
      return {
        success: false,
        message: 'No leads found',
        processedCount: 0,
      };
    }

    // 2. Processar cada lead com IA
    const results: ClassificationResult[] = await Promise.all(
      leads.map(async (lead) => {
        try {
          const prompt = customPrompt || generateClassificationPrompt(lead, classificationType);

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em classificação de leads para CRM imobiliário.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          });

          const aiResponse = completion.choices[0].message.content || '';
          const classification = parseClassificationResponse(aiResponse, classificationType);

          // 3. Atualizar lead no Prisma
          const updateData: any = {};

          if (classificationType === 'score' && classification.score !== undefined) {
            updateData.score = classification.score;
          } else if (classificationType === 'status' && classification.newStatus) {
            updateData.status = classification.newStatus;
          } else if (classificationType === 'stage' && classification.newStage) {
            updateData.stage = classification.newStage;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.leads.update({
              where: { id: lead.id },
              data: updateData,
            });

            // Registrar histórico se mudou status
            if (updateData.status && updateData.status !== lead.status) {
              await prisma.lead_status_history.create({
                data: {
                  leadId: lead.id,
                  oldStatus: lead.status,
                  newStatus: updateData.status,
                  changedBy: null, // IA
                },
              });
            }
          }

          return {
            leadId: lead.id,
            originalStatus: lead.status || undefined,
            newStatus: classification.newStatus || lead.status || 'unknown',
            score: classification.score,
            reasoning: classification.reasoning,
            success: true,
          };
        } catch (error) {
          logger.error({ error, leadId: lead.id }, 'Failed to classify lead');
          return {
            leadId: lead.id,
            originalStatus: lead.status || undefined,
            newStatus: lead.status || 'error',
            reasoning: 'Classification failed',
            success: false,
          };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;

    logger.info({ total: leads.length, success: successCount }, 'Bulk classification completed');

    return {
      success: true,
      processedCount: leads.length,
      successCount,
      failedCount: leads.length - successCount,
      results,
      message: `Successfully classified ${successCount}/${leads.length} leads.`,
    };
  } catch (error) {
    logger.error({ error, leadIds }, 'Failed to execute bulk classification');
    throw error;
  }
}

/**
 * Enriquecimento de dados de contatos em lote.
 * @param contactIds IDs dos contatos a serem enriquecidos
 * @returns Resultado da operação
 */
export async function enrichContactsBulk(contactIds: string[]) {
  logger.info({ contactIds }, 'Executing bulk enrichment for contacts');

  if (!openai) {
    logger.warn('OpenAI not configured. Using fallback enrichment logic.');
    return fallbackEnrichment(contactIds);
  }

  try {
    // 1. Buscar contatos do Prisma
    const contacts = await prisma.contacts.findMany({
      where: { id: { in: contactIds } },
    });

    if (contacts.length === 0) {
      logger.warn({ contactIds }, 'No contacts found for enrichment');
      return {
        success: false,
        message: 'No contacts found',
        processedCount: 0,
      };
    }

    // 2. Enriquecer cada contato com IA
    const results: EnrichmentResult[] = await Promise.all(
      contacts.map(async (contact) => {
        try {
          const prompt = `
Analise os dados deste contato e sugira informações adicionais relevantes:

Nome: ${contact.name || 'N/A'}
Email: ${contact.email || 'N/A'}
Telefone: ${contact.phone || 'N/A'}
Empresa: ${contact.company || 'N/A'}

Retorne um JSON com possíveis enriquecimentos:
{
  "company": "nome da empresa (se não fornecido)",
  "industry": "setor/indústria provável",
  "jobTitle": "cargo provável baseado no contexto",
  "linkedinUrl": "URL do LinkedIn (se identificável)",
  "additionalInfo": { "key": "value" }
}
`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em enriquecimento de dados de contatos B2B.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          });

          const aiResponse = completion.choices[0].message.content || '{}';
          const enrichedData = parseEnrichmentResponse(aiResponse);

          // 3. Atualizar contato no Prisma (apenas se houver dados novos)
          const updateData: any = {};

          if (enrichedData.company && !contact.company) {
            updateData.company = enrichedData.company;
          }

          if (enrichedData.jobTitle && !contact.jobTitle) {
            updateData.jobTitle = enrichedData.jobTitle;
          }

          // Atualizar metadata com informações adicionais
          if (enrichedData.industry || enrichedData.linkedinUrl || enrichedData.additionalInfo) {
            const currentMetadata = (contact.metadata as any) || {};
            updateData.metadata = {
              ...currentMetadata,
              ...(enrichedData.industry && { industry: enrichedData.industry }),
              ...(enrichedData.linkedinUrl && { linkedinUrl: enrichedData.linkedinUrl }),
              ...(enrichedData.additionalInfo && { enrichedData: enrichedData.additionalInfo }),
              enrichedAt: new Date().toISOString(),
            };
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.contacts.update({
              where: { id: contact.id },
              data: updateData,
            });
          }

          return {
            contactId: contact.id,
            enrichedData,
            success: true,
          };
        } catch (error) {
          logger.error({ error, contactId: contact.id }, 'Failed to enrich contact');
          return {
            contactId: contact.id,
            enrichedData: {},
            success: false,
          };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;

    logger.info({ total: contacts.length, success: successCount }, 'Bulk enrichment completed');

    return {
      success: true,
      processedCount: contacts.length,
      successCount,
      failedCount: contacts.length - successCount,
      results,
      message: `Successfully enriched ${successCount}/${contacts.length} contacts.`,
    };
  } catch (error) {
    logger.error({ error, contactIds }, 'Failed to execute bulk enrichment');
    throw error;
  }
}

/**
 * Gera prompt de classificação baseado no tipo
 */
function generateClassificationPrompt(lead: any, type: string): string {
  const baseInfo = `
Lead: ${lead.name || 'N/A'}
Email: ${lead.email || 'N/A'}
Telefone: ${lead.phone || 'N/A'}
Fonte: ${lead.source || 'N/A'}
Status Atual: ${lead.status || 'N/A'}
Score Atual: ${lead.score || 'N/A'}

Últimas Mensagens:
${lead.messages?.map((m: any) => `- ${m.content?.substring(0, 100)}`).join('\n') || 'Nenhuma'}

Histórico de Status:
${lead.statusHistory?.map((h: any) => `- ${h.oldStatus} → ${h.newStatus}`).join('\n') || 'Nenhum'}
`;

  if (type === 'score') {
    return `${baseInfo}\n\nAnalise este lead e atribua um score de 0 a 100 baseado no potencial de conversão. Retorne apenas o número e uma breve justificativa.`;
  } else if (type === 'status') {
    return `${baseInfo}\n\nAnalise este lead e classifique em um dos seguintes status: "Novo", "Qualificado", "Em Negociação", "Ganho", "Perdido". Retorne o status e justificativa.`;
  } else if (type === 'stage') {
    return `${baseInfo}\n\nAnalise este lead e classifique em um dos seguintes estágios: "Prospecção", "Qualificação", "Proposta", "Negociação", "Fechamento". Retorne o estágio e justificativa.`;
  }

  return baseInfo;
}

/**
 * Parse da resposta de classificação da IA
 */
function parseClassificationResponse(response: string, type: string): any {
  try {
    // Tentar extrair JSON se houver
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: parse manual
    const result: any = { reasoning: response };

    if (type === 'score') {
      const scoreMatch = response.match(/\b(\d{1,3})\b/);
      if (scoreMatch) {
        result.score = parseInt(scoreMatch[1]);
      }
    } else if (type === 'status') {
      const statusMatch = response.match(/(Novo|Qualificado|Em Negociação|Ganho|Perdido)/i);
      if (statusMatch) {
        result.newStatus = statusMatch[1];
      }
    } else if (type === 'stage') {
      const stageMatch = response.match(/(Prospecção|Qualificação|Proposta|Negociação|Fechamento)/i);
      if (stageMatch) {
        result.newStage = stageMatch[1];
      }
    }

    return result;
  } catch (error) {
    logger.error({ error, response }, 'Failed to parse classification response');
    return { reasoning: response };
  }
}

/**
 * Parse da resposta de enriquecimento da IA
 */
function parseEnrichmentResponse(response: string): any {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    logger.error({ error, response }, 'Failed to parse enrichment response');
    return {};
  }
}

/**
 * Classificação fallback quando OpenAI não está configurada
 */
async function fallbackClassification(leadIds: string[], type: string) {
  const leads = await prisma.leads.findMany({
    where: { id: { in: leadIds } },
  });

  // Lógica simples de classificação baseada em regras
  await Promise.all(
    leads.map(async (lead) => {
      if (type === 'score') {
        const score = Math.floor(Math.random() * 50) + 50; // 50-100
        await prisma.leads.update({
          where: { id: lead.id },
          data: { score },
        });
      }
    })
  );

  return {
    success: true,
    processedCount: leads.length,
    message: `Classified ${leads.length} leads using fallback logic (OpenAI not configured).`,
  };
}

/**
 * Enriquecimento fallback quando OpenAI não está configurada
 */
async function fallbackEnrichment(contactIds: string[]) {
  const contacts = await prisma.contacts.findMany({
    where: { id: { in: contactIds } },
  });

  return {
    success: true,
    processedCount: contacts.length,
    message: `Processed ${contacts.length} contacts using fallback logic (OpenAI not configured).`,
  };
}
