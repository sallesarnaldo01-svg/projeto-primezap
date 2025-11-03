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
  createdAt: Date | null | undefined;
  updatedAt: Date | null | undefined;
}) => {
  const config = toJsonObject(connection.config);
  return {
    id: connection.id,
    name: connection.name,
    status: (connection.status ?? 'DISCONNECTED') as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR',
    phone: connection.phone ?? (config.phone as string | undefined),
    device: (config.device as string | undefined) ?? undefined,
    provider: (config.provider as WhatsAppProvider | undefined) ?? getProvider(undefined),
    sessionName: (config.sessionName as string | undefined) ?? connection.id,
    createdAt: connection.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: connection.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
};

const findConnection = async (connectionId: string, tenantId: string) =>
  prisma.connections.findFirst({
    where: { id: connectionId, tenantId, type: 'WHATSAPP' },
  });

const findConnectionByIdentifier = async (identifier: string, tenantId: string) => {
  try {
    return await prisma.connections.findFirst({
      where: {
        tenantId,
        type: 'WHATSAPP',
        OR: [
          { id: identifier },
          { name: identifier },
          { config: { path: ['sessionName'], equals: identifier } },
        ],
      },
    });
  } catch (e) {
    // Fallback without JSON path (databases without jsonPath ops)
    const candidates = await prisma.connections.findMany({
      where: { tenantId, type: 'WHATSAPP' },
      take: 50,
      orderBy: { createdAt: 'desc' as any },
    });
    return (
      candidates.find((c) => c.id === identifier || c.name === identifier) ||
      candidates.find((c) => {
        try {
          const cfg = toJsonObject(c.config);
          return (cfg.sessionName as string | undefined) === identifier;
        } catch {
          return false;
        }
      }) ||
      null
    );
  }
};

const sanitizePhone = (input: string) => input.replace(/\D/g, '');

const resolveQrCode = async (
  connection: Awaited<ReturnType<typeof findConnection>>,
  identifiers: string[],
) => {
  if (!connection) {
    return null;
  }

  const config = toJsonObject(connection.config);
  if (typeof config.qrCode === 'string' && config.qrCode.length > 0) {
    return config.qrCode;
  }

  for (const key of identifiers) {
    if (!key) continue;
    const cached = await redis.get(`qr:${key}`).catch((error) => {
      logger.warn({ connectionId: connection.id, key, error }, 'Failed to retrieve QR from cache');
      return null;
    });
    if (cached) {
      return cached;
    }
  }

  return null;
};

export const whatsappController = {
  async getQRCode(req: AuthRequest, res: Response) {
    // Prevent caches/ETag from interfering with QR polling
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const { connectionId } = req.params;
    const tenantId = req.user?.tenantId ?? req.tenantId;

    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const connection = await findConnection(connectionId, tenantId);

    if (!connection) {
      res.setHeader('x-whatsapp-status', 'DISCONNECTED');
      return res.status(204).end();
    }

    const qrCode = await resolveQrCode(connection, [connection.id]);

    if (!qrCode) {
      res.setHeader('x-whatsapp-status', connection.status ?? 'CONNECTING');
      return res.status(204).end();
    }

    // Não force prefixo base64 quando o conteúdo for texto de QR (Baileys);
    // Retorne ambos os formatos para o frontend decidir como renderizar.
    const isDataUrl = qrCode.startsWith('data:image') || qrCode.startsWith('data:application');
    res.status(200).json({
      qr: isDataUrl ? undefined : qrCode,
      qrCode: isDataUrl ? qrCode : undefined,
      status: connection.status ?? 'CONNECTING',
    });
  },

  async getQRCodeBySession(req: AuthRequest, res: Response) {
    try {
      // Prevent caches/ETag from interfering with QR polling
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      logger.debug({ route: 'qr-by-session', params: req.params, tenantId: req.user?.tenantId ?? req.tenantId }, 'QR by session requested');
      const { sessionName } = req.params;
      const tenantId = req.user?.tenantId ?? req.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant não identificado', 400);
      }

      if (!sessionName) {
        throw new AppError('Identificador de sessão inválido', 400);
      }

      const connection = await findConnectionByIdentifier(sessionName, tenantId);

      if (!connection) {
        throw new AppError('Conexão não encontrada', 404);
      }

      const config = toJsonObject(connection.config);
      const qrCode = await resolveQrCode(connection, [
        connection.id,
        sessionName,
        typeof config.sessionName === 'string' ? (config.sessionName as string) : '',
      ]);

      if (!qrCode) {
        res.setHeader('x-whatsapp-status', connection.status ?? 'CONNECTING');
        return res.status(204).end();
      }

      // Retornar ambos formatos para o frontend decidir como renderizar
      const isDataUrl = qrCode.startsWith('data:image') || qrCode.startsWith('data:application');
      return res.json({
        qr: isDataUrl ? undefined : qrCode,
        qrCode: isDataUrl ? qrCode : undefined,
        status: connection.status ?? 'CONNECTING',
        sessionName: sessionName,
      });
    } catch (error) {
      logger.warn({ route: 'qr-by-session', error }, 'QR by session failed; returning 204');
      // Be tolerant for QR polling: return 204 instead of 500 to keep UI polling
      try {
        const { sessionName } = req.params;
        const tenantId = req.user?.tenantId ?? req.tenantId;
        const fallbackConn = tenantId && sessionName ? await findConnectionByIdentifier(sessionName, tenantId) : null;
        if (fallbackConn?.status) {
          res.setHeader('x-whatsapp-status', fallbackConn.status);
        }
      } catch {}
      return res.status(204).end();
    }
  },

  async initiateConnection(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId ?? req.tenantId;
    const userId = req.user?.userId ?? req.user?.id ?? null;

    if (!tenantId) {
      throw new AppError('Tenant não identificado', 400);
    }

    const {
      name,
      provider: providerInput,
      phone,
      sessionName,
      webhookUrl,
    } = req.body as {
      name?: string;
      provider?: string;
      phone?: string;
      sessionName?: string;
      webhookUrl?: string;
    };

    const provider = getProvider(providerInput);

    // Número de telefone passa a ser opcional. Quando omitido,
    // será preenchido automaticamente após o login do WhatsApp pelo provider.
    const sanitizedPhone = typeof phone === 'string' && phone.trim().length > 0
      ? sanitizePhone(phone)
      : undefined;
    if (sanitizedPhone && sanitizedPhone.length < 8) {
      throw new AppError('Número de telefone inválido', 400);
    }

    const requestedSessionName = sessionName?.trim() || undefined;
    const sessionKey = requestedSessionName ?? undefined;
    const webhook = webhookUrl?.trim() || env.WEBHOOK_BASE_URL || undefined;
    const now = new Date().toISOString();

    const initialConfig = {
      provider,
      phone: sanitizedPhone,
      sessionName: sessionKey,
      createdBy: userId,
      requestedAt: now,
      webhookUrl: webhook,
      tenantId,
    };

    const createdConnection = await prisma.connections.create({
      data: {
        tenantId: tenantId,
        name: name?.trim() || requestedSessionName || 'WhatsApp Principal',
        type: 'WHATSAPP',
        status: 'CONNECTING',
        phone: sanitizedPhone,
        config: initialConfig,
      },
    });

    const effectiveSessionName = sessionKey ?? createdConnection.id;
    let connection = createdConnection;
    let connectionConfig = {
      ...toJsonObject(createdConnection.config),
      sessionName: effectiveSessionName,
      phone: sanitizedPhone,
      webhookUrl: webhook,
      tenantId,
    };

    if (!sessionKey) {
      connection = await prisma.connections.update({
        where: { id: createdConnection.id },
        data: {
          config: connectionConfig,
        },
      });
    }

    await redis.publish(
      'whatsapp:connect',
      JSON.stringify({
        connectionId: connection.id,
        tenantId,
        provider,
        sessionName: effectiveSessionName,
        phone: sanitizedPhone,
        webhookUrl: webhook,
        config: {
          ...connectionConfig,
          sessionName: effectiveSessionName,
          phone: sanitizedPhone,
          webhookUrl: webhook,
        },
      }),
    );

    logger.info(
      { connectionId: connection.id, tenantId, provider, sessionName: effectiveSessionName },
      'WhatsApp connection initiated',
    );

    res.status(201).json(
      buildConnectionPayload({
        ...connection,
        config: connectionConfig,
      }),
    );
  },

  async sendBulkMessages(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId ?? req.tenantId;
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
    try {
      const tenantId = req.user?.tenantId ?? req.tenantId;
      if (!tenantId) {
        throw new AppError('Tenant não identificado', 400);
      }

      const { connectionId } = req.params;
      const connection = await findConnection(connectionId, tenantId);

      if (!connection) {
        // Não propague 500 no polling do frontend
        return res.status(404).json({ status: 'DISCONNECTED', id: connectionId });
      }

      return res.json(buildConnectionPayload(connection));
    } catch (error) {
      logger.warn({ route: 'whatsapp:status', err: (error as any)?.message }, 'status check failed; returning CONNECTING');
      // Evite quebrar o polling do frontend em caso de erro inesperado
      return res.status(200).json({ status: 'CONNECTING' });
    }
  },

  async disconnectWhatsApp(req: AuthRequest, res: Response) {
    const tenantId = req.user?.tenantId ?? req.tenantId;
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
        config: config as Prisma.InputJsonValue,
        updatedAt: new Date(),
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
