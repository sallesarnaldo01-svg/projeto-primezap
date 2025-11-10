import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.js';
import type { AuthRequest } from '../middleware/auth.js';

export const workflowsController = {
  async list(req: AuthRequest, res: Response) {
    const { status } = req.query;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const workflows = await prisma.workflows.findMany({
      where: {
        tenantId,
        ...(status && { status: status as string }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ data: workflows });
  },

  async get(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const workflow = await prisma.workflows.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    return res.json(workflow);
  },

  async create(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const { name, description, status, trigger, actions, category } = req.body;

    const workflow = await prisma.workflows.create({
      data: {
        tenantId,
        name,
        description,
        status: status || 'draft',
        trigger,
        actions,
        category,
        createdBy: userId,
        stats: {
          triggered: 0,
          completed: 0,
          failed: 0,
          successRate: 0,
        },
      },
    });

    return res.status(201).json(workflow);
  },

  async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const workflow = await prisma.workflows.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    const { name, description, status, trigger, actions, category } = req.body;

    const updated = await prisma.workflows.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(trigger && { trigger }),
        ...(actions && { actions }),
        ...(category !== undefined && { category }),
        updatedAt: new Date(),
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

    const workflow = await prisma.workflows.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    await prisma.workflows.delete({
      where: { id },
    });

    return res.status(204).end();
  },

  async publish(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const workflow = await prisma.workflows.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    const updated = await prisma.workflows.update({
      where: { id },
      data: {
        status: 'active',
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  },

  async pause(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const workflow = await prisma.workflows.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    const updated = await prisma.workflows.update({
      where: { id },
      data: {
        status: 'inactive',
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  },

  async duplicate(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { name } = req.body;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      throw new AppError('Tenant ID not found', 401);
    }

    const workflow = await prisma.workflows.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    const duplicated = await prisma.workflows.create({
      data: {
        tenantId,
        name: name || `${workflow.name} (cópia)`,
        description: workflow.description,
        status: 'draft',
        trigger: workflow.trigger,
        actions: workflow.actions,
        category: workflow.category,
        createdBy: userId,
        stats: {
          triggered: 0,
          completed: 0,
          failed: 0,
          successRate: 0,
        },
      },
    });

    return res.status(201).json(duplicated);
  },
};
