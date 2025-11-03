import { Job } from 'bullmq';
import { OpenAI } from 'openai';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';
import { env } from '../config/env.js';

interface BulkAIJob {
  tenantId: string;
  leadIds: string[];
  prompt: string;
  agentId?: string;
}

export async function processBulkAI(job: Job<BulkAIJob>) {
  const { tenantId, leadIds, prompt, agentId } = job.data;

  try {
    logger.info({ tenantId, leadCount: leadIds.length }, 'Processing bulk AI action');

    // Buscar agente de IA se especificado
    const agent = agentId
      ? await prisma.aIProvider.findFirst({
          where: { id: agentId, tenantId }
        })
      : null;

    const results = [];

    for (const leadId of leadIds) {
      try {
        const leadContext = await fetchLeadContext(leadId);

        const aiResponse = await generateAIResponse({
          agent,
          prompt,
          leadId,
          leadContext
        });

        // Registrar evento
        await prisma.conversationEvent.create({
          data: {
            tenantId,
            conversationId: leadId,
            type: 'ai_action',
            actor: 'ai_agent',
            actorName: agent?.name || 'Bulk AI',
            content: aiResponse.message,
            metadata: {
              bulkAction: true,
              prompt,
              response: aiResponse
            }
          }
        });

        results.push({
          leadId,
          success: true,
          action: aiResponse.action,
          updateStatus: aiResponse.updateStatus ?? null
        });

        logger.info({ leadId }, 'Bulk AI processed lead');
      } catch (error) {
        logger.error({ error, leadId }, 'Failed to process lead in bulk AI');
        results.push({
          leadId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: true,
      totalLeads: leadIds.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results
    };
  } catch (error) {
    logger.error({ error }, 'Failed to process bulk AI action');
    throw error;
  }
}

interface GenerateAIResponseParams {
  agent: any | null;
  prompt: string;
  leadId: string;
  leadContext: any;
}

interface AIResponsePayload {
  action: string;
  message: string;
  updateStatus?: string | null;
  raw?: string;
}

async function fetchLeadContext(leadId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        *,
        conversations(
          id,
          status,
          last_message_content,
          messages(
            id,
            content,
            type,
            sender,
            created_at
          )
        ),
        deals(
          id,
          title,
          value,
          stage,
          status,
          updated_at
        ),
        tickets(
          id,
          title,
          status,
          priority,
          updated_at
        )
      `)
      .eq('id', leadId)
      .single();

    if (error) {
      throw error;
    }

    return data ?? { id: leadId };
  } catch (error) {
    logger.warn({ error, leadId }, 'Failed to fetch lead context, using minimal payload');
    return { id: leadId };
  }
}

async function generateAIResponse({
  agent,
  prompt,
  leadId,
  leadContext
}: GenerateAIResponseParams): Promise<AIResponsePayload> {
  const fallbackResponse: AIResponsePayload = {
    action: 'send_message',
    message: `Resposta automática para o lead ${leadId}: ${prompt}`,
    updateStatus: null
  };

  const apiKey =
    (agent?.api_key as string | undefined)?.trim() || env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn('OPENAI_API_KEY não configurada. Retornando resposta padrão.');
    return fallbackResponse;
  }

  try {
    const openai = new OpenAI({ apiKey });

    const baseSystemPrompt =
      typeof agent?.config === 'object' && agent?.config !== null && 'systemPrompt' in (agent.config as Record<string, unknown>)
        ? String((agent.config as Record<string, unknown>).systemPrompt)
        : 'Você é um assistente de vendas. Responda sempre com JSON no formato {"action": "send_message", "message": "...", "updateStatus": "qualified"}.';

    const completion = await openai.chat.completions.create({
      model: typeof agent?.model === 'string' && agent.model ? agent.model : 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `${baseSystemPrompt}\n\nFaça com que a resposta final seja um JSON válido com as chaves: action, message, updateStatus.`
        },
        {
          role: 'user',
          content: `Prompt: ${prompt}\n\nLead: ${JSON.stringify(leadContext, null, 2)}`
        }
      ]
    });

    const rawContent = completion.choices[0]?.message?.content ?? '';
    const responseText = extractTextContent(rawContent);

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = null;
    }

    const normalized: AIResponsePayload = {
      action: parsed?.action ?? 'send_message',
      message: parsed?.message ?? (responseText || fallbackResponse.message),
      updateStatus: parsed?.updateStatus ?? parsed?.status ?? null,
      raw: responseText
    };

    return normalized;
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to generate AI response, using fallback');
    return fallbackResponse;
  }
}

function extractTextContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String(part.text ?? '');
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  if (content && typeof content === 'object' && 'text' in content) {
    return String(content.text ?? '');
  }

  return '';
}
