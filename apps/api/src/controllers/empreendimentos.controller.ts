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

  async create(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    const r = await prisma.empreendimentos.create({ data: { tenantId: auth.tenantId, nome: b.nome, endereco: b.endereco ?? null, descricao: b.descricao ?? null } });
    res.status(201).json(r);
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const b = req.body ?? {};
    await prisma.empreendimentos.updateMany({ where: { tenantId: auth.tenantId, id }, data: { nome: b.nome, endereco: b.endereco, descricao: b.descricao } });
    res.json({ success: true });
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    await prisma.empreendimentos.deleteMany({ where: { tenantId: auth.tenantId, id } });
    res.status(204).end();
  },
};
