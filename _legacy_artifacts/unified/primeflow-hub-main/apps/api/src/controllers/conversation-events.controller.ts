import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import * as Boom from '@hapi/boom';

export const conversationEventsController = {
  // GET /conversations/:conversationId/events - Listar eventos
  async list(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const tenantId = req.user?.tenantId;
      const { limit = 100 } = req.query;

      const events = await prisma.conversationEvent.findMany({
        where: {
          tenantId,
          conversationId
        },
        take: Number(limit),
        orderBy: { createdAt: 'asc' }
      });

      res.json(events);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar eventos de conversa');
      throw Boom.internal('Erro ao listar eventos');
    }
  },

  // POST /conversations/:conversationId/events - Criar evento
  async create(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const tenantId = req.user?.tenantId;
      const { type, actor, actorId, actorName, title, description, content, metadata } = req.body;

      const eventType = type ?? 'system_event';

      const event = await prisma.conversationEvent.create({
        data: {
          tenantId,
          conversationId,
          eventType,
          actor,
          actorId,
          actorName,
          title: title ?? type ?? 'event',
          description: description ?? content ?? null,
          metadata: metadata ?? {}
        }
      });

      logger.info({ eventId: event.id, type }, 'Evento de conversa criado');
      res.status(201).json(event);
    } catch (error) {
      logger.error({ error }, 'Erro ao criar evento');
      throw error;
    }
  },

  // POST /conversations/:conversationId/events/:eventId/rate - Avaliar evento
  async rate(req: Request, res: Response) {
    try {
      const { conversationId, eventId } = req.params;
      const tenantId = req.user?.tenantId;
      const { rating, feedback } = req.body;

      const event = await prisma.conversationEvent.findFirst({
        where: {
          id: eventId,
          conversationId,
          tenantId
        }
      });

      if (!event) {
        throw Boom.notFound('Evento não encontrado');
      }

      const updated = await prisma.conversationEvent.update({
        where: { id: eventId },
        data: {
          rating,
          feedback
        }
      });

      logger.info({ eventId, rating }, 'Evento avaliado');
      res.json(updated);
    } catch (error) {
      logger.error({ error }, 'Erro ao avaliar evento');
      throw error;
    }
  },

  // GET /conversations/:conversationId/timeline - Timeline unificada
  async timeline(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const tenantId = req.user?.tenantId;

      const events = await prisma.conversationEvent.findMany({
        where: {
          tenantId,
          conversationId
        },
        orderBy: { createdAt: 'asc' }
      });

      // Agrupar por tipo para estatísticas
      const stats = {
        totalMessages: events.filter(e => e.eventType === 'message').length,
        aiMessages: events.filter(e => e.actor === 'ai_agent').length,
        humanMessages: events.filter(e => e.actor === 'human_agent').length,
        customerMessages: events.filter(e => e.actor === 'customer').length,
        systemEvents: events.filter(e => e.actor === 'system').length,
        averageRating: events
          .filter(e => e.rating)
          .reduce((sum, e) => sum + (e.rating || 0), 0) / events.filter(e => e.rating).length || 0
      };

      res.json({
        events,
        stats
      });
    } catch (error) {
      logger.error({ error }, 'Erro ao obter timeline');
      throw error;
    }
  }
};
