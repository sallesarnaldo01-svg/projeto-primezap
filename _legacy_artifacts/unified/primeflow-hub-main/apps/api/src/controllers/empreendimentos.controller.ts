import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensureAuth(req: AuthenticatedRequest, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  return { tenantId: req.user.tenantId };
}

export const empreendimentosController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const rows = await prisma.empreendimentos.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { nome: 'asc' },
    });
    res.json(rows);
  },
};
