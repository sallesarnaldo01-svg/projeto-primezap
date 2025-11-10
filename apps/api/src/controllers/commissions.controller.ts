import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.js';
import type { AuthRequest } from '../middleware/auth.js';

export const commissionsController = {
  async list(req: AuthRequest, res: Response) {
    const { status, userId, dealId } = req.query;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const where: any = { tenantId };
    
    if (status) where.status = status as string;
    if (userId) where.userId = userId as string;
    if (dealId) where.dealId = dealId as string;

    const commissions = await prisma.commissions.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ data: commissions });
  },

  async get(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const commission = await prisma.commissions.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
    });

    if (!commission) {
      throw new AppError('Commission not found', 404);
    }

    return res.json(commission);
  },

  async create(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const commission = await prisma.commissions.create({
      data: {
        ...req.body,
        tenantId,
        userId: userId || req.body.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
    });

    return res.status(201).json(commission);
  },

  async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const commission = await prisma.commissions.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!commission) {
      throw new AppError('Commission not found', 404);
    }

    const updated = await prisma.commissions.update({
      where: { id },
      data: {
        ...req.body,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
    });

    return res.json(updated);
  },

  async delete(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const commission = await prisma.commissions.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!commission) {
      throw new AppError('Commission not found', 404);
    }

    await prisma.commissions.delete({
      where: { id },
    });

    return res.status(204).end();
  },
};
