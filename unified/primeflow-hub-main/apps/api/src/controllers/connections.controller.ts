import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error.js';
import { emitToTenant } from '../lib/socket.js';
import {
  connectionToIntegration,
  mapConnectionStatus,
} from './utils/integration.js';

const ALLOWED_PROVIDERS = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'WEBCHAT'] as const;
type ProviderType = typeof ALLOWED_PROVIDERS[number];

const ALLOWED_STATUS = ['CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR'] as const;
type ConnectionStatusType = typeof ALLOWED_STATUS[number];

export const connectionsController = {
  async list(req: Request, res: Response) {
    const connections = await prisma.connections.findMany({
      where: { tenant_id: req.user!.tenantId },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      data: connections,
    });
  },

  async get(req: Request, res: Response) {
    const { id } = req.params;

    const connection = await prisma.connections.findFirst({
      where: {
        id,
        tenant_id: req.user!.tenantId,
      },
    });

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    res.json({
      success: true,
      data: connection,
    });
  },

  async create(req: Request, res: Response) {
    const { type, meta, name } = req.body;

    if (!type) {
      throw new AppError('Tipo da conexão é obrigatório', 400);
    }

    const provider = String(type).toUpperCase() as ProviderType;

    if (!ALLOWED_PROVIDERS.includes(provider)) {
      throw new AppError('Tipo de conexão inválido', 400);
    }

    const connection = await prisma.connections.create({
      data: {
        type: provider,
        name:
          name ??
          `${provider.charAt(0)}${provider.slice(1).toLowerCase()} Connection`,
        tenant_id: req.user!.tenantId,
        status: 'DISCONNECTED',
        config: meta ?? {},
      },
    });

    logger.info({ connectionId: connection.id, type }, 'Connection created');
    emitToTenant(req.user!.tenantId, 'connection:created', connection);
    emitToTenant(
      req.user!.tenantId,
      'integrations:updated',
      connectionToIntegration(connection)
    );

    res.status(201).json({
      success: true,
      data: connection,
    });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { status, meta } = req.body;

    const existing = await prisma.connections.findFirst({
      where: { id, tenant_id: req.user!.tenantId },
    });

    if (!existing) {
      throw new AppError('Conexão não encontrada', 404);
    }

    let nextStatus: ConnectionStatusType | undefined;

    if (status) {
      const normalized = String(status).toUpperCase() as ConnectionStatusType;
      if (!ALLOWED_STATUS.includes(normalized)) {
      throw new AppError('Status da conexão inválido', 400);
      }
      nextStatus = normalized;
    }

    const connection = await prisma.connections.update({
      where: { id },
      data: {
        ...(nextStatus && { status: nextStatus }),
        ...(meta && { config: meta }),
        updated_at: new Date(),
      },
    });

    emitToTenant(req.user!.tenantId, 'connection:updated', connection);
    emitToTenant(
      req.user!.tenantId,
      'integrations:updated',
      connectionToIntegration(connection)
    );

    res.json({
      success: true,
      data: connection,
    });
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const connection = await prisma.connections.findFirst({
      where: { id, tenant_id: req.user!.tenantId },
    });

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    await prisma.connections.delete({
      where: { id },
    });

    logger.info({ connectionId: id }, 'Connection deleted');
    emitToTenant(req.user!.tenantId, 'connection:deleted', { id });
    emitToTenant(req.user!.tenantId, 'integrations:updated', {
      id,
      status: mapConnectionStatus('DISCONNECTED'),
      provider: connection.type.toLowerCase(),
    });

    res.json({
      success: true,
      message: 'Conexão excluída',
    });
  },

  async connect(req: Request, res: Response) {
    const { id } = req.params;

    const connection = await prisma.connections.findFirst({
      where: {
        id,
        tenant_id: req.user!.tenantId,
      },
    });

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    // Aqui iniciaria o processo de conexão com o provider
    logger.info({ connectionId: id, type: connection.type }, 'Initiating connection');

    await prisma.connections.update({
      where: { id },
      data: { status: 'CONNECTED', updated_at: new Date() },
    });

    emitToTenant(req.user!.tenantId, 'connection:status', {
      id,
      status: 'CONNECTED',
    });
    emitToTenant(req.user!.tenantId, 'integrations:updated', {
      id,
      status: mapConnectionStatus('CONNECTED'),
      provider: connection.type.toLowerCase(),
    });

    res.json({
      success: true,
      message: 'Conexão iniciada',
    });
  },

  async disconnect(req: Request, res: Response) {
    const { id } = req.params;

    const connection = await prisma.connections.findFirst({
      where: {
        id,
        tenant_id: req.user!.tenantId,
      },
    });

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    logger.info({ connectionId: id }, 'Disconnecting');

    await prisma.connections.update({
      where: { id },
      data: { status: 'DISCONNECTED', updated_at: new Date() },
    });

    emitToTenant(req.user!.tenantId, 'connection:status', {
      id,
      status: 'DISCONNECTED',
    });
    emitToTenant(req.user!.tenantId, 'integrations:updated', {
      id,
      status: mapConnectionStatus('DISCONNECTED'),
      provider: connection.type.toLowerCase(),
    });

    res.json({
      success: true,
      message: 'Conexão encerrada',
    });
  },

  async status(req: Request, res: Response) {
    const connections = await prisma.connections.findMany({
      where: { tenant_id: req.user!.tenantId },
      select: {
        id: true,
        type: true,
        status: true,
      },
    });

    const summary = connections.reduce((acc, conn) => {
      const key = conn.type.toLowerCase();
      if (!acc[key]) {
        acc[key] = { connected: 0, total: 0 };
      }
      acc[key].total++;
      if (conn.status === 'CONNECTED') {
        acc[key].connected++;
      }
      return acc;
    }, {} as Record<string, any>);

    res.json({
      success: true,
      data: {
        connections,
        summary,
      },
    });
  },
};
