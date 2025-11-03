import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import * as Boom from '@hapi/boom';
import { followUpCadenceQueue } from '../queues/followup-cadence.queue.js';

export const followUpCadenceController = {
  // GET /ai/cadences - Listar cadências
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;

      const cadences = await prisma.followUpCadence.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
      });

      res.json(cadences);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar cadências');
      throw Boom.internal('Erro ao listar cadências');
    }
  },

  // GET /ai/cadences/:id - Obter cadência
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      const cadence = await prisma.followUpCadence.findFirst({
        where: { id, tenantId }
      });

      if (!cadence) {
        throw Boom.notFound('Cadência não encontrada');
      }

      res.json(cadence);
    } catch (error) {
      logger.error({ error }, 'Erro ao obter cadência');
      throw error;
    }
  },

  // POST /ai/cadences - Criar cadência
  async create(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { name, trigger, steps, agentId } = req.body;

      const cadence = await prisma.followUpCadence.create({
        data: {
          tenantId,
          name,
          trigger,
          steps,
          agentId,
          active: true
        }
      });

      logger.info({ cadenceId: cadence.id }, 'Cadência criada');
      res.status(201).json(cadence);
    } catch (error) {
      logger.error({ error }, 'Erro ao criar cadência');
      throw error;
    }
  },

  // PUT /ai/cadences/:id - Atualizar cadência
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const { name, trigger, steps, agentId, active } = req.body;

      const cadence = await prisma.followUpCadence.findFirst({
        where: { id, tenantId }
      });

      if (!cadence) {
        throw Boom.notFound('Cadência não encontrada');
      }

      const updated = await prisma.followUpCadence.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(trigger && { trigger }),
          ...(steps && { steps }),
          ...(agentId !== undefined && { agentId }),
          ...(active !== undefined && { active })
        }
      });

      logger.info({ cadenceId: id }, 'Cadência atualizada');
      res.json(updated);
    } catch (error) {
      logger.error({ error }, 'Erro ao atualizar cadência');
      throw error;
    }
  },

  // DELETE /ai/cadences/:id - Deletar cadência
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      const cadence = await prisma.followUpCadence.findFirst({
        where: { id, tenantId }
      });

      if (!cadence) {
        throw Boom.notFound('Cadência não encontrada');
      }

      await prisma.followUpCadence.delete({
        where: { id }
      });

      logger.info({ cadenceId: id }, 'Cadência deletada');
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Erro ao deletar cadência');
      throw error;
    }
  },

  // POST /ai/cadences/:id/trigger - Disparar cadência manualmente
  async trigger(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const { leadIds } = req.body;

      const cadence = await prisma.followUpCadence.findFirst({
        where: { id, tenantId }
      });

      if (!cadence) {
        throw Boom.notFound('Cadência não encontrada');
      }

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        throw Boom.badRequest('Informe ao menos um lead para iniciar a cadência');
      }

      const steps = Array.isArray(cadence.steps) ? cadence.steps : [];
      const firstStep = steps[0] || {};
      const delayMinutes = Number(firstStep.delay_minutes ?? firstStep.delay ?? 0);
      const delayMs = Number.isFinite(delayMinutes) ? Math.max(0, delayMinutes) * 60 * 1000 : 0;

      await followUpCadenceQueue.add(
        'trigger-cadence',
        {
          tenantId,
          cadenceId: cadence.id,
          leadIds,
          stepIndex: 0
        },
        {
          delay: delayMs,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      );

      logger.info({ cadenceId: id, leadIds, delayMs }, 'Cadência enfileirada');

      res.json({
        success: true,
        message: 'Cadência enfileirada',
        leadCount: leadIds.length
      });
    } catch (error) {
      logger.error({ error }, 'Erro ao disparar cadência');
      throw error;
    }
  }
};
