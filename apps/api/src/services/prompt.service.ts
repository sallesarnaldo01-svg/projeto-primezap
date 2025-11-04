/**
 * Serviço de gestão de System Prompts usando Prisma
 * Utiliza o modelo ai_agents para armazenar prompts do sistema
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

interface PromptData {
  name: string;
  systemPrompt: string;
  model?: string;
  description?: string;
  temperature?: number;
  maxTokens?: number;
  tenantId: string;
  providerId?: string;
  active?: boolean;
}

interface UpdatePromptData {
  name?: string;
  systemPrompt?: string;
  model?: string;
  description?: string;
  temperature?: number;
  maxTokens?: number;
  active?: boolean;
}

/**
 * Cria um novo prompt (AI Agent) no banco de dados.
 * @param data Dados do prompt
 * @returns Prompt criado
 */
export async function createPrompt(data: PromptData) {
  try {
    logger.info({ name: data.name, tenantId: data.tenantId }, 'Creating new prompt');

    const prompt = await prisma.ai_agents.create({
      data: {
        name: data.name,
        systemPrompt: data.systemPrompt,
        model: data.model || 'gpt-4',
        description: data.description,
        temperature: data.temperature || 0.7,
        maxTokens: data.maxTokens || 1000,
        tenantId: data.tenantId,
        providerId: data.providerId,
        active: data.active !== undefined ? data.active : true,
      },
    });

    logger.info({ id: prompt.id, name: prompt.name }, 'Prompt created successfully');

    return prompt;
  } catch (error) {
    logger.error({ error, name: data.name }, 'Failed to create prompt');
    throw error;
  }
}

/**
 * Busca um prompt pelo ID.
 * @param id ID do prompt
 * @returns Prompt encontrado ou null
 */
export async function getPrompt(id: string) {
  try {
    logger.info({ id }, 'Fetching prompt');

    const prompt = await prisma.ai_agents.findUnique({
      where: { id },
      include: {
        provider: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!prompt) {
      logger.warn({ id }, 'Prompt not found');
      return null;
    }

    logger.info({ id, name: prompt.name }, 'Prompt retrieved successfully');

    return prompt;
  } catch (error) {
    logger.error({ error, id }, 'Failed to fetch prompt');
    throw error;
  }
}

/**
 * Atualiza um prompt existente.
 * @param id ID do prompt
 * @param data Dados a serem atualizados
 * @returns Prompt atualizado
 */
export async function updatePrompt(id: string, data: UpdatePromptData) {
  try {
    logger.info({ id, updates: Object.keys(data) }, 'Updating prompt');

    const prompt = await prisma.ai_agents.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.systemPrompt && { systemPrompt: data.systemPrompt }),
        ...(data.model && { model: data.model }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.temperature !== undefined && { temperature: data.temperature }),
        ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
        ...(data.active !== undefined && { active: data.active }),
        updatedAt: new Date(),
      },
    });

    logger.info({ id, name: prompt.name }, 'Prompt updated successfully');

    return prompt;
  } catch (error) {
    logger.error({ error, id }, 'Failed to update prompt');
    throw error;
  }
}

/**
 * Deleta um prompt.
 * @param id ID do prompt
 * @returns true se deletado com sucesso
 */
export async function deletePrompt(id: string) {
  try {
    logger.info({ id }, 'Deleting prompt');

    await prisma.ai_agents.delete({
      where: { id },
    });

    logger.info({ id }, 'Prompt deleted successfully');

    return true;
  } catch (error) {
    logger.error({ error, id }, 'Failed to delete prompt');
    throw error;
  }
}

/**
 * Lista todos os prompts de um tenant.
 * @param tenantId ID do tenant
 * @param options Opções de filtro (active, limit, offset)
 * @returns Lista de prompts
 */
export async function listPrompts(
  tenantId: string,
  options?: {
    active?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
  }
) {
  try {
    logger.info({ tenantId, options }, 'Listing prompts');

    const where: any = { tenantId };

    if (options?.active !== undefined) {
      where.active = options.active;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [prompts, total] = await Promise.all([
      prisma.ai_agents.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(options?.limit && { take: options.limit }),
        ...(options?.offset && { skip: options.offset }),
      }),
      prisma.ai_agents.count({ where }),
    ]);

    logger.info({ tenantId, count: prompts.length, total }, 'Prompts listed successfully');

    return {
      data: prompts,
      total,
      limit: options?.limit,
      offset: options?.offset,
    };
  } catch (error) {
    logger.error({ error, tenantId }, 'Failed to list prompts');
    throw error;
  }
}

/**
 * Duplica um prompt existente.
 * @param id ID do prompt a ser duplicado
 * @param newName Nome do novo prompt
 * @returns Prompt duplicado
 */
export async function duplicatePrompt(id: string, newName: string) {
  try {
    logger.info({ id, newName }, 'Duplicating prompt');

    const original = await getPrompt(id);

    if (!original) {
      throw new Error('Prompt not found');
    }

    const duplicate = await createPrompt({
      name: newName,
      systemPrompt: original.systemPrompt,
      model: original.model,
      description: original.description || undefined,
      temperature: original.temperature ? parseFloat(original.temperature.toString()) : undefined,
      maxTokens: original.maxTokens || undefined,
      tenantId: original.tenantId,
      providerId: original.providerId || undefined,
      active: original.active || undefined,
    });

    logger.info({ originalId: id, duplicateId: duplicate.id }, 'Prompt duplicated successfully');

    return duplicate;
  } catch (error) {
    logger.error({ error, id }, 'Failed to duplicate prompt');
    throw error;
  }
}

/**
 * Ativa ou desativa um prompt.
 * @param id ID do prompt
 * @param active true para ativar, false para desativar
 * @returns Prompt atualizado
 */
export async function togglePromptActive(id: string, active: boolean) {
  return updatePrompt(id, { active });
}

/**
 * Busca prompts por provider.
 * @param providerId ID do provider
 * @param tenantId ID do tenant (opcional)
 * @returns Lista de prompts
 */
export async function getPromptsByProvider(providerId: string, tenantId?: string) {
  try {
    logger.info({ providerId, tenantId }, 'Fetching prompts by provider');

    const where: any = { providerId };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const prompts = await prisma.ai_agents.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    logger.info({ providerId, count: prompts.length }, 'Prompts by provider retrieved successfully');

    return prompts;
  } catch (error) {
    logger.error({ error, providerId }, 'Failed to fetch prompts by provider');
    throw error;
  }
}
