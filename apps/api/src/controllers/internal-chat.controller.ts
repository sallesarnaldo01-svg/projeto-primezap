import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';

export const internalChatController = {
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const fromUserId = req.user!.userId;
      const { toUserId, text } = req.body as { toUserId: string; text: string };

      if (!toUserId || !text) return res.status(400).json({ error: 'toUserId e text são obrigatórios' });

      const msg = await prisma.activity.create({
        data: {
          tenantId,
          type: 'INTERNAL_MESSAGE',
          description: text,
          userId: fromUserId,
          metadata: { toUserId }
        }
      });

      res.status(201).json(msg);
    } catch (error) {
      logger.error({ error }, 'Error sending internal message');
      res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
  },

  async listMessages(req: AuthRequest, res: Response) {
    try {
      const me = req.user!.userId;
      const { userId, limit = '100' } = req.query as any;
      if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });

      const take = parseInt(limit as string) || 100;

      const items = await prisma.activity.findMany({
        where: {
          type: 'INTERNAL_MESSAGE',
          OR: [
            { userId: me, metadata: { path: ['toUserId'], equals: userId } as any },
            { userId: userId as string, metadata: { path: ['toUserId'], equals: me } as any }
          ]
        },
        orderBy: { createdAt: 'asc' },
        take
      });

      res.json(items);
    } catch (error) {
      logger.error({ error }, 'Error listing internal messages');
      res.status(500).json({ error: 'Erro ao listar mensagens' });
    }
  }
};

