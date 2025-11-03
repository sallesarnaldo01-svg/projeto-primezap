import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const visitsController = {
  async list(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { propertyId, brokerId, status } = req.query as { propertyId?: string; brokerId?: string; status?: string };
    const where: any = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (brokerId) where.brokerId = brokerId;
    if (status) where.status = status;
    const data = await prisma.property_visits.findMany({ where, orderBy: { scheduledAt: 'desc' } });
    res.json({ data });
  },

  async create(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { propertyId, dealId, contactId, scheduledAt, status } = req.body as any;
    const data = await prisma.property_visits.create({ data: { tenantId, propertyId, dealId, contactId, scheduledAt: new Date(scheduledAt), status: status ?? 'scheduled', brokerId: userId } });
    res.status(201).json({ data });
  },

  async update(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await prisma.property_visits.updateMany({ where: { id, tenantId }, data: req.body });
    const data = await prisma.property_visits.findFirst({ where: { id, tenantId } });
    res.json({ data });
  },

  async cancel(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await prisma.property_visits.updateMany({ where: { id, tenantId }, data: { status: 'cancelled' } });
    const data = await prisma.property_visits.findFirst({ where: { id, tenantId } });
    res.json({ data });
  }
};

