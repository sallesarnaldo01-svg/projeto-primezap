import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.js';
import type { AuthRequest } from '../middleware/auth.js';

export const callsController = {
  async list(req: AuthRequest, res: Response) {
    const { status, direction, contactId, userId } = req.query;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const where: any = { tenantId };
    
    if (status) where.status = status as string;
    if (direction) where.direction = direction as string;
    if (contactId) where.contactId = contactId as string;
    if (userId) where.userId = userId as string;

    const calls = await prisma.calls.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatarUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    return res.json({ data: calls });
  },

  async get(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const call = await prisma.calls.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatarUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!call) {
      throw new AppError('Call not found', 404);
    }

    return res.json(call);
  },

  async create(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const call = await prisma.calls.create({
      data: {
        ...req.body,
        tenantId,
        userId: userId || req.body.userId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatarUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return res.status(201).json(call);
  },

  async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const call = await prisma.calls.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!call) {
      throw new AppError('Call not found', 404);
    }

    const updated = await prisma.calls.update({
      where: { id },
      data: {
        ...req.body,
        updatedAt: new Date(),
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatarUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
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

    const call = await prisma.calls.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!call) {
      throw new AppError('Call not found', 404);
    }

    await prisma.calls.delete({
      where: { id },
    });

    return res.status(204).end();
  },
};
