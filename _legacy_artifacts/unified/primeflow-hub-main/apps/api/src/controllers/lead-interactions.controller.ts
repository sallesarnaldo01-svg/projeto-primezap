import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensureAuth(req: AuthenticatedRequest, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  return { tenantId: req.user.tenantId, userId: req.user.userId };
}

export const leadInteractionsController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { leadId } = req.query as any;
    if (!leadId) return res.json([]);
    const rows = await prisma.lead_interactions.findMany({
      where: { tenantId: auth.tenantId, leadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, leadId: true, type: true, content: true, createdAt: true, userId: true },
    });
    res.json(rows);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    const r = await prisma.lead_interactions.create({
      data: {
        tenantId: auth.tenantId,
        leadId: b.leadId,
        type: b.type,
        content: b.content ?? null,
        userId: auth.userId,
      },
    });
    res.status(201).json(r);
  },
};
