import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensureAuth(req: AuthenticatedRequest, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  return { tenantId: req.user.tenantId };
}

export const correspondentesController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const rows = await prisma.correspondentes.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { razaoSocial: 'asc' },
    });
    res.json(rows.map(r => ({ id: r.id, nome: r.razaoSocial, cnpj: r.cnpj, contato: r.contato, email: r.email, status: r.status })));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    const r = await prisma.correspondentes.create({
      data: {
        tenantId: auth.tenantId,
        razaoSocial: b.nome,
        cnpj: b.cnpj ?? null,
        contato: b.contato ?? null,
        email: b.email ?? null,
        status: b.status ?? 'ATIVO',
      },
    });
    res.status(201).json({ id: r.id, nome: r.razaoSocial, cnpj: r.cnpj, contato: r.contato, email: r.email, status: r.status });
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    await prisma.correspondentes.deleteMany({ where: { tenantId: auth.tenantId, id } });
    res.status(204).end();
  },

  async listUsers(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const rows = await prisma.correspondentes_usuarios.findMany({
      where: { tenantId: auth.tenantId, correspondenteId: id },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, email: true, telefone: true },
    });
    res.json(rows);
  },

  async createUser(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const b = req.body ?? {};
    const row = await prisma.correspondentes_usuarios.create({
      data: {
        tenantId: auth.tenantId,
        correspondenteId: id,
        nome: b.nome,
        email: b.email,
        telefone: b.telefone ?? null,
      },
    });
    res.status(201).json(row);
  },

  async removeUser(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { userId } = req.params as any;
    await prisma.correspondentes_usuarios.deleteMany({ where: { tenantId: auth.tenantId, id: userId } });
    res.status(204).end();
  },
};
