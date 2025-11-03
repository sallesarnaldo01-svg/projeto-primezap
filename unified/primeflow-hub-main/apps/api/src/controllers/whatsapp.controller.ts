import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { AuthRequest } from '../middleware/auth.js';

type WhatsAppProvider = 'venom' | 'baileys';

const SUPPORTED_PROVIDERS: WhatsAppProvider[] = ['venom', 'baileys'];

const toJsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

const getProvider = (input?: string | null): WhatsAppProvider => {
  const normalized = (input ?? env.WHATSAPP_PROVIDER ?? 'venom').toLowerCase();
  return SUPPORTED_PROVIDERS.includes(normalized as WhatsAppProvider)
    ? (normalized as WhatsAppProvider)
    : 'venom';
};

const buildConnectionPayload = (connection: {
  id: string;
  name: string;
  status: string | null;
  phone: string | null;
  config: Prisma.JsonValue | null;
  created_at: Date | null;
  updated_at: Date | null;
}) => {
  const config = toJsonObject(connection.config);
  return {
    id: connection.id,
    name: connection.name,
    status: (connection.status ?? 'DISCONNECTED') as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR',
    phone: connection.phone ?? (config.phone as string | undefined),
    device: (config.device as string | undefined) ?? undefined,
    provider: (config.provider as WhatsAppProvider | undefined) ?? getProvider(undefined),
    createdAt: connection.created_at?.toISOString() ?? new Date().toISOString(),
    updatedAt: connection.updated_at?.toISOString() ?? new Date().toISOString(),
  };
};

const findConnection = async (connectionId: string, tenantId: string) =>
  prisma.connections.findFirst({
    where: { id: connectionId, tenant_id: tenantId, type: 'WHATSAPP' },
  });

export const whatsappController = {
  async getQRCode(req: AuthRequest, res: Response) {
    const { connectionId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const connection = await findConnection(connectionId, tenantId);

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    const config = toJsonObject(connection.config);
    let qrCode = typeof config.qrCode === 'string' ? config.qrCode : null;

    if (!qrCode) {
      qrCode = await redis.get(`qr:${connectionId}`);
    }

    if (!qrCode) {
      throw new AppError('QR Code não disponível', 404);
    }

    const formatted =
      qrCode.startsWith('data:image') || qrCode.startsWith('data:application')
        ? qrCode
        : `data:image/png;base64,${qrCode}`;

    res.json({
      qrCode: formatted,
      status: connection.status ?? 'CONNECTING',
    });
  },

  async initiateConnection(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId ?? req.user?.id ?? null;

    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const { name, provider: providerInput } = req.body as {
      name?: string;
      provider?: string;
    };

    const provider = getProvider(providerInput);

    const connection = await prisma.connections.create({
      data: {
        tenant_id: tenantId,
        name: name?.trim() || 'WhatsApp Principal',
        type: 'WHATSAPP',
        status: 'CONNECTING',
        config: {
          provider,
          createdBy: userId,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    await redis.publish(
      'whatsapp:connect',
      JSON.stringify({
        connectionId: connection.id,
        tenantId,
        provider,
        config: toJsonObject(connection.config),
      }),
    );

    logger.info({ connectionId: connection.id, tenantId, provider }, 'WhatsApp connection initiated');

    res.status(201).json(buildConnectionPayload(connection));
  },

  async sendBulkMessages(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const { connectionId } = req.params;
    const { contacts, message, delayMs = 1000 } = req.body as {
      contacts?: string[];
      message?: { text?: string; mediaUrl?: string; mediaType?: string };
      delayMs?: number;
    };

    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new AppError('Lista de contatos inválida', 400);
    }

    if (!message || (!message.text && !message.mediaUrl)) {
      throw new AppError('Mensagem é obrigatória', 400);
    }

    const connection = await findConnection(connectionId, tenantId);

    if (!connection || connection.status !== 'CONNECTED') {
      throw new AppError('Conexão WhatsApp não encontrada ou não conectada', 404);
    }

    const broadcastId = randomUUID();

    await redis.publish(
      'broadcast:mass',
      JSON.stringify({
        broadcastId,
        connectionId,
        contacts,
        message,
        delayMs,
        provider: getProvider(toJsonObject(connection.config).provider as string | undefined),
      }),
    );

    logger.info(
      { broadcastId, connectionId, tenantId, contacts: contacts.length },
      'Bulk WhatsApp broadcast queued',
    );

    res.json({
      broadcastId,
      totalContacts: contacts.length,
      estimatedTime: Math.ceil((contacts.length * delayMs) / 1000),
    });
  },

  async getConnectionStatus(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const { connectionId } = req.params;
    const connection = await findConnection(connectionId, tenantId);

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    res.json(buildConnectionPayload(connection));
  },

  async disconnectWhatsApp(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const { connectionId } = req.params;
    const connection = await findConnection(connectionId, tenantId);

    if (!connection) {
      throw new AppError('Conexão não encontrada', 404);
    }

    const config = toJsonObject(connection.config);
    delete config.qrCode;
    config.disconnectedAt = new Date().toISOString();

    await prisma.connections.update({
      where: { id: connectionId },
      data: {
        status: 'DISCONNECTED',
        phone: null,
        config,
        updated_at: new Date(),
      },
    });

    await redis.publish(
      'whatsapp:disconnect',
      JSON.stringify({
        connectionId,
        tenantId,
        provider: getProvider(config.provider as string | undefined),
      }),
    );

    await redis.del(`qr:${connectionId}`).catch(() => {});

    logger.info({ connectionId, tenantId }, 'WhatsApp connection disconnected');
    res.status(204).send();
  },
};
