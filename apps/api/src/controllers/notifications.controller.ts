import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';

export const notificationsController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { limit = '50', page = '1', unreadOnly } = req.query as any;
      const take = parseInt(limit as string) || 50;
      const skip = (parseInt(page as string) - 1) * take;

      const where: any = {
        tenantId,
      };

      if (unreadOnly === 'true') {
        where.OR = [
          { metadata: { path: ['readBy'], equals: null } },
          { metadata: { path: ['readBy'], array_contains: [] } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.activity.count({ where }),
      ]);

      res.json({
        items,
        pagination: { page: parseInt(page as string), limit: take, total },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing notifications');
      res.status(500).json({ error: 'Erro ao listar notificações' });
    }
  },

  async markRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const existing = await prisma.activity.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Notificação não encontrada' });

      const current = (existing.metadata as any) || {};
      const readBy: string[] = Array.isArray(current.readBy) ? current.readBy : [];
      if (!readBy.includes(userId)) readBy.push(userId);

      const updated = await prisma.activity.update({
        where: { id },
        data: { metadata: { ...current, readBy } },
      });

      res.json(updated);
    } catch (error) {
      logger.error({ error }, 'Error marking notification as read');
      res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
    }
  },

  async markReadBulk(req: AuthRequest, res: Response) {
    try {
      const { ids } = req.body as { ids: string[] };
      const userId = req.user!.userId;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Lista de IDs vazia' });
      }

      const items = await prisma.activity.findMany({ where: { id: { in: ids } } });

      for (const it of items) {
        const current = (it.metadata as any) || {};
        const readBy: string[] = Array.isArray(current.readBy) ? current.readBy : [];
        if (!readBy.includes(userId)) {
          await prisma.activity.update({
            where: { id: it.id },
            data: { metadata: { ...current, readBy: [...readBy, userId] } },
          });
        }
      }

      res.json({ success: true, updated: items.length });
    } catch (error) {
      logger.error({ error }, 'Error marking bulk notifications read');
      res.status(500).json({ error: 'Erro ao marcar notificações' });
    }
  },
};

