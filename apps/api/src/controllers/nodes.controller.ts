import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.js';
import { emitToTenant } from '../lib/socket.js';

export const nodesController = {
  async create(req: Request, res: Response) {
    const { flowId } = req.params;
    const { type, label, x, y, config } = req.body;

    // Verificar se o fluxo pertence ao tenant
    const flow = await prisma.flows.findFirst({
      where: {
        id: flowId,
        tenantId: req.user!.tenantId
      }
    });

    if (!flow) {
      throw new AppError('Fluxo não encontrado', 404);
    }

    const node = await prisma.flow_nodes.create({
      data: {
        flowId,
        nodeType: type,
        label: label ?? type,
        positionX: new Prisma.Decimal(Number(x ?? 0)),
        positionY: new Prisma.Decimal(Number(y ?? 0)),
        config: config ?? {}
      }
    });

    emitToTenant(req.user!.tenantId, 'node:created', { flowId, node });

    res.status(201).json({
      success: true,
      data: node
    });
  },

  async update(req: Request, res: Response) {
    const { flowId, id } = req.params;
    const { type, label, x, y, config } = req.body;

    const flow = await prisma.flows.findFirst({
      where: {
        id: flowId,
        tenantId: req.user!.tenantId
      }
    });

    if (!flow) {
      throw new AppError('Fluxo não encontrado', 404);
    }

    const node = await prisma.flow_nodes.update({
      where: {
        id,
        flowId
      },
      data: {
        ...(type && { nodeType: type }),
        ...(label !== undefined && { label }),
        ...(x !== undefined && { positionX: new Prisma.Decimal(Number(x)) }),
        ...(y !== undefined && { positionY: new Prisma.Decimal(Number(y)) }),
        ...(config !== undefined && { config })
      }
    });

    emitToTenant(req.user!.tenantId, 'node:updated', { flowId, node });

    res.json({
      success: true,
      data: node
    });
  },

  async delete(req: Request, res: Response) {
    const { flowId, id } = req.params;

    const flow = await prisma.flows.findFirst({
      where: {
        id: flowId,
        tenantId: req.user!.tenantId
      }
    });

    if (!flow) {
      throw new AppError('Fluxo não encontrado', 404);
    }

    // Deletar edges relacionadas
    await prisma.flow_edges.deleteMany({
      where: {
        flowId,
        OR: [
          { sourceNodeId: id },
          { targetNodeId: id }
        ]
      }
    });

    await prisma.flow_nodes.delete({
      where: {
        id,
        flowId
      }
    });

    emitToTenant(req.user!.tenantId, 'node:deleted', { flowId, nodeId: id });

    res.json({
      success: true,
      message: 'Nó excluído'
    });
  }
};

export const edgesController = {
  async create(req: Request, res: Response) {
    const { flowId } = req.params;
    const { sourceId, targetId, condition, label } = req.body;

    const flow = await prisma.flows.findFirst({
      where: {
        id: flowId,
        tenantId: req.user!.tenantId
      }
    });

    if (!flow) {
      throw new AppError('Fluxo não encontrado', 404);
    }

    const edge = await prisma.flow_edges.create({
      data: {
        flowId,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        condition,
        label
      }
    });

    emitToTenant(req.user!.tenantId, 'edge:created', { flowId, edge });

    res.status(201).json({
      success: true,
      data: edge
    });
  },

  async update(req: Request, res: Response) {
    const { flowId, id } = req.params;
    const { condition, label } = req.body;

    const flow = await prisma.flows.findFirst({
      where: {
        id: flowId,
        tenantId: req.user!.tenantId
      }
    });

    if (!flow) {
      throw new AppError('Fluxo não encontrado', 404);
    }

    const edge = await prisma.flow_edges.update({
      where: {
        id,
        flowId
      },
      data: {
        ...(condition !== undefined && { condition }),
        ...(label !== undefined && { label })
      }
    });

    emitToTenant(req.user!.tenantId, 'edge:updated', { flowId, edge });

    res.json({
      success: true,
      data: edge
    });
  },

  async delete(req: Request, res: Response) {
    const { flowId, id } = req.params;

    const flow = await prisma.flows.findFirst({
      where: {
        id: flowId,
        tenantId: req.user!.tenantId
      }
    });

    if (!flow) {
      throw new AppError('Fluxo não encontrado', 404);
    }

    await prisma.flow_edges.delete({
      where: {
        id,
        flowId
      }
    });

    emitToTenant(req.user!.tenantId, 'edge:deleted', { flowId, edgeId: id });

    res.json({
      success: true,
      message: 'Conexão excluída'
    });
  }
};
