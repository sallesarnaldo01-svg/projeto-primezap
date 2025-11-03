import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import * as Boom from '@hapi/boom';

export const aiProvidersController = {
  // GET /ai/providers - Listar provedores
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }

      const providers = await prisma.aIProvider.findMany({
        where: { tenantId },
        include: {
          agents: {
            where: { active: true },
            select: {
              id: true,
              name: true,
              model: true,
              active: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(providers);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar provedores de IA');
      throw Boom.internal('Erro ao listar provedores');
    }
  },

  // POST /ai/providers - Criar provedor
  async create(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }
      const { type, name, apiKey, config } = req.body;

      // Verificar se já existe um provedor do mesmo tipo
      const existing = await prisma.aIProvider.findUnique({
        where: {
          tenantId_type: { tenantId, type }
        }
      });

      if (existing) {
        throw Boom.conflict(`Provedor ${type} já existe`);
      }

      const provider = await prisma.aIProvider.create({
        data: {
          tenant: { connect: { id: tenantId } },
          type,
          name,
          apiKey,
          config,
          active: true
        }
      });

      logger.info({ providerId: provider.id, type }, 'Provedor de IA criado');
      res.status(201).json(provider);
    } catch (error) {
      logger.error({ error }, 'Erro ao criar provedor de IA');
      throw error;
    }
  },

  // PUT /ai/providers/:id - Atualizar provedor
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }
      const { name, apiKey, config, active } = req.body;

      const provider = await prisma.aIProvider.findFirst({
        where: { id, tenantId }
      });

      if (!provider) {
        throw Boom.notFound('Provedor não encontrado');
      }

      const updated = await prisma.aIProvider.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(apiKey && { apiKey }),
          ...(config && { config }),
          ...(active !== undefined && { active })
        }
      });

      logger.info({ providerId: id }, 'Provedor de IA atualizado');
      res.json(updated);
    } catch (error) {
      logger.error({ error }, 'Erro ao atualizar provedor de IA');
      throw error;
    }
  },

  // DELETE /ai/providers/:id - Deletar provedor
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }

      const provider = await prisma.aIProvider.findFirst({
        where: { id, tenantId }
      });

      if (!provider) {
        throw Boom.notFound('Provedor não encontrado');
      }

      await prisma.aIProvider.delete({
        where: { id }
      });

      logger.info({ providerId: id }, 'Provedor de IA deletado');
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Erro ao deletar provedor de IA');
      throw error;
    }
  },

  // GET /ai/agents - Listar agentes
  async listAgents(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }

      const agents = await prisma.aIAgent.findMany({
        where: { tenantId },
        include: {
          provider: {
            select: {
              id: true,
              type: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(agents);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar agentes de IA');
      throw Boom.internal('Erro ao listar agentes');
    }
  },

  // POST /ai/agents - Criar agente
  async createAgent(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }
      const { providerId, name, model, systemPrompt, temperature, maxTokens, config } = req.body;

      // Verificar se o provedor existe e pertence ao tenant
      const provider = await prisma.aIProvider.findFirst({
        where: { id: providerId, tenantId }
      });

      if (!provider) {
        throw Boom.notFound('Provedor não encontrado');
      }

      const agent = await prisma.aIAgent.create({
        data: {
          tenantId,
          providerId,
          name,
          model,
          systemPrompt,
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 2000,
          config: config ?? {},
          active: true
        }
      });

      logger.info({ agentId: agent.id, model }, 'Agente de IA criado');
      res.status(201).json(agent);
    } catch (error) {
      logger.error({ error }, 'Erro ao criar agente de IA');
      throw error;
    }
  },

  // PUT /ai/agents/:id - Atualizar agente
  async updateAgent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }
      const { name, model, systemPrompt, temperature, maxTokens, config, active } = req.body;

      const agent = await prisma.aIAgent.findFirst({
        where: { id, tenantId }
      });

      if (!agent) {
        throw Boom.notFound('Agente não encontrado');
      }

      const updated = await prisma.aIAgent.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(model && { model }),
          ...(systemPrompt && { systemPrompt }),
          ...(temperature !== undefined && { temperature }),
          ...(maxTokens !== undefined && { maxTokens }),
          ...(config && { config }),
          ...(active !== undefined && { active })
        }
      });

      logger.info({ agentId: id }, 'Agente de IA atualizado');
      res.json(updated);
    } catch (error) {
      logger.error({ error }, 'Erro ao atualizar agente de IA');
      throw error;
    }
  },

  // DELETE /ai/agents/:id - Deletar agente
  async deleteAgent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }

      const agent = await prisma.aIAgent.findFirst({
        where: { id, tenantId }
      });

      if (!agent) {
        throw Boom.notFound('Agente não encontrado');
      }

      await prisma.aIAgent.delete({
        where: { id }
      });

      logger.info({ agentId: id }, 'Agente de IA deletado');
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Erro ao deletar agente de IA');
      throw error;
    }
  },

  // POST /ai/test - Testar chamada de IA
  async test(req: Request, res: Response) {
    try {
      const { agentId, message } = req.body;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw Boom.unauthorized('Tenant não identificado');
      }

      const agent = await prisma.aIAgent.findFirst({
        where: { id: agentId, tenantId },
        include: { provider: true }
      });

      if (!agent) {
        throw Boom.notFound('Agente não encontrado');
      }

      // Aqui será implementada a lógica de chamada aos provedores
      // Por enquanto, retornar mock
      const response = {
        success: true,
        provider: agent.provider.type,
        model: agent.model,
        message: 'Teste realizado com sucesso (mock)',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Erro ao testar IA');
      throw error;
    }
  }
};
