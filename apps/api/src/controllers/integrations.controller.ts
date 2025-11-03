import { Request, Response } from 'express';
import type { connections } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.js';
import { emitToTenant } from '../lib/socket.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { mapConnectionStatus } from './utils/integration.js';

const SUPPORTED_PLATFORMS = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'] as const;
const ALLOWED_STATUS = ['CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR'] as const;

type Platform = (typeof SUPPORTED_PLATFORMS)[number];
type ConnectionStatus = (typeof ALLOWED_STATUS)[number];
type FrontendStatus = 'active' | 'inactive' | 'pending' | 'error';

function assertPlatform(value: string | undefined): Platform {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!SUPPORTED_PLATFORMS.includes(normalized as Platform)) {
    throw new AppError('Plataforma inválida', 400);
  }
  return normalized as Platform;
}

function asPlainObject(input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return { ...(input as Record<string, any>) };
}

function mapStatusToFrontend(status?: string | null): FrontendStatus {
  switch (status) {
    case 'CONNECTED':
      return 'active';
    case 'CONNECTING':
      return 'pending';
    case 'ERROR':
      return 'error';
    default:
      return 'inactive';
  }
}

function toIntegrationResponse(connection: connections) {
  const config = asPlainObject(connection.config);
  const phoneNumber = connection.phone ?? config.phone_number ?? config.phoneNumber ?? null;
  const accessToken = connection.accessToken ?? config.access_token ?? config.accessToken ?? null;
  const phoneNumberId =
    config.phone_number_id ??
    config.phoneNumberId ??
    config.business_phone_id ??
    null;
  const businessAccountId =
    config.business_account_id ?? config.businessAccountId ?? config.ba_id ?? null;
  const pageId = connection.pageId ?? config.page_id ?? config.pageId ?? null;
  const instagramAccountId =
    connection.instagramAccountId ?? config.instagram_account_id ?? config.instagramAccountId ?? null;

  const lastSync =
    connection.lastSyncAt?.toISOString() ??
    (typeof config.lastSyncAt === 'string' ? config.lastSyncAt : undefined);

  return {
    id: connection.id,
    platform: connection.type.toLowerCase(),
    name: connection.name,
    status: mapStatusToFrontend(connection.status),
    phoneNumber: phoneNumber ?? undefined,
    accessToken: accessToken ?? undefined,
    phoneNumberId: phoneNumberId ?? undefined,
    businessAccountId: businessAccountId ?? undefined,
    pageId: pageId ?? undefined,
    instagramAccountId: instagramAccountId ?? undefined,
    lastSyncAt: lastSync,
    createdAt: connection.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: connection.updatedAt?.toISOString() ?? new Date().toISOString(),
    error:
      typeof config.error === 'string'
        ? config.error
        : config.error?.message ?? undefined,
  };
}

function buildConnectionConfig(body: Record<string, any>, platform: Platform) {
  const {
    name,
    platform: _ignoredPlatform,
    access_token: accessToken,
    phone_number: phoneNumber,
    phone_number_id: phoneNumberId,
    business_account_id: businessAccountId,
    page_id: pageId,
    instagram_account_id: instagramAccountId,
    ...rest
  } = body;

  const base = asPlainObject(rest.config ?? rest.meta ?? rest);
  // Remove fields that we explicitly map to top-level columns
  delete base.access_token;
  delete base.phone_number;
  delete base.phoneNumber;
  delete base.phone_number_id;
  delete base.phoneNumberId;
  delete base.business_account_id;
  delete base.businessAccountId;
  delete base.page_id;
  delete base.instagram_account_id;
  delete base.name;
  delete base.platform;

  if (phoneNumberId) {
    base.phone_number_id = phoneNumberId;
    base.phoneNumberId = phoneNumberId;
  }

  if (businessAccountId) {
    base.business_account_id = businessAccountId;
    base.businessAccountId = businessAccountId;
  }

  if (platform === 'WHATSAPP' && !base.provider) {
    base.provider = 'venom';
  }

  return base;
}

async function ensureTenantConnection(
  id: string,
  tenantId: string,
  platform?: Platform
) {
  const connection = await prisma.connections.findFirst({
    where: {
      id,
      tenantId,
      ...(platform && { type: platform }),
    },
  });

  if (!connection) {
    throw new AppError('Integração não encontrada', 404);
  }

  return connection;
}

function decodeMaybeBase64(value: string): string {
  try {
    const normalized = value.trim();
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64') === normalized.replace(/\r|\n/g, '')) {
      return decoded;
    }
  } catch {
    // ignore decoding errors
  }
  return value;
}

async function publishProviderConnect(connection: connections) {
  const config = asPlainObject(connection.config);

  if (connection.type === 'WHATSAPP') {
    await redis.publish(
      'whatsapp:connect',
      JSON.stringify({
        connectionId: connection.id,
        tenantId: connection.tenantId,
        provider: config.provider ?? 'venom',
        config,
      })
    );
  } else if (connection.type === 'FACEBOOK') {
    if (config.email && config.password) {
      const password = decodeMaybeBase64(String(config.password));
      await redis.publish(
        'facebook:connect',
        JSON.stringify({
          connectionId: connection.id,
          email: config.email,
          password,
        })
      );
    }
  } else if (connection.type === 'INSTAGRAM') {
    if (config.username && config.password) {
      const password = decodeMaybeBase64(String(config.password));
      await redis.publish(
        'instagram:connect',
        JSON.stringify({
          connectionId: connection.id,
          username: config.username,
          password,
        })
      );
    }
  }
}

export const integrationsController = {
  async list(req: Request, res: Response) {
    const connections = await prisma.connections.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(connections.map(toIntegrationResponse));
  },

  async get(req: Request, res: Response) {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const connection = await ensureTenantConnection(id, tenantId);

    res.json(toIntegrationResponse(connection));
  },

  async status(req: Request, res: Response) {
    const connections = await prisma.connections.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    const integrations = connections.map(toIntegrationResponse);
    const stats = integrations.reduce(
      (acc, integration) => {
        acc.total += 1;
        acc[integration.status] += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        pending: 0,
        error: 0,
      } as Record<'total' | FrontendStatus, number>
    );

    res.json({ stats, integrations });
  },

  async create(req: Request, res: Response) {
    const platform = assertPlatform(req.body.platform);
    const tenantId = req.user!.tenantId;

    const name =
      (req.body.name as string | undefined)?.trim() ||
      (platform === 'WHATSAPP'
        ? 'WhatsApp Business'
        : platform === 'FACEBOOK'
        ? 'Facebook'
        : 'Instagram');

    const config = buildConnectionConfig(req.body, platform);

    const connection = await prisma.connections.create({
      data: {
        tenantId,
        type: platform,
        name,
        status: platform === 'WHATSAPP' ? 'CONNECTING' : 'DISCONNECTED',
        phone: (req.body.phone_number as string | undefined) ?? null,
        accessToken: (req.body.access_token as string | undefined) ?? null,
        pageId: (req.body.page_id as string | undefined) ?? null,
        instagramAccountId:
          (req.body.instagram_account_id as string | undefined) ?? null,
        config,
      },
    });

    await publishProviderConnect(connection).catch((error) => {
      logger.warn(
        { error: error.message, connectionId: connection.id },
        'Failed to trigger provider connection'
      );
    });

    emitToTenant(tenantId, 'integrations:updated', {
      id: connection.id,
      provider: connection.type.toLowerCase(),
      status: mapConnectionStatus(connection.status ?? 'DISCONNECTED'),
    });

    res.status(201).json(toIntegrationResponse(connection));
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const platform = req.body.platform
      ? assertPlatform(req.body.platform)
      : undefined;

    const existing = await ensureTenantConnection(id, tenantId, platform);

    const statusInput = req.body.status
      ? String(req.body.status).toUpperCase()
      : undefined;

    if (statusInput && !ALLOWED_STATUS.includes(statusInput as ConnectionStatus)) {
      throw new AppError('Status inválido para a integração', 400);
    }

    const nextStatus = statusInput as ConnectionStatus | undefined;

    const config = {
      ...asPlainObject(existing.config),
      ...buildConnectionConfig(req.body, existing.type as Platform),
    };

    const connection = await prisma.connections.update({
      where: { id },
      data: {
        ...(nextStatus && { status: nextStatus }),
        ...(req.body.name && { name: String(req.body.name) }),
        ...(req.body.phone_number && { phone: String(req.body.phone_number) }),
        ...(req.body.access_token && {
          accessToken: String(req.body.access_token),
        }),
        ...(req.body.page_id && { pageId: String(req.body.page_id) }),
        ...(req.body.instagram_account_id && {
          instagramAccountId: String(req.body.instagram_account_id),
        }),
        config,
        updatedAt: new Date(),
      },
    });

    emitToTenant(tenantId, 'integrations:updated', {
      id: connection.id,
      provider: connection.type.toLowerCase(),
      status: mapConnectionStatus(connection.status ?? 'DISCONNECTED'),
    });

    if ((nextStatus ?? connection.status) === 'CONNECTING') {
      await publishProviderConnect(connection).catch((error) => {
        logger.warn(
          { error: error.message, connectionId: connection.id },
          'Failed to trigger provider connection after update'
        );
      });
    }

    res.json(toIntegrationResponse(connection));
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await ensureTenantConnection(id, tenantId);

    await prisma.connections.delete({
      where: { id: existing.id },
    });

    emitToTenant(tenantId, 'integrations:updated', {
      id: existing.id,
      provider: existing.type.toLowerCase(),
      status: mapConnectionStatus('DISCONNECTED'),
    });

    res.status(204).send();
  },

  async sync(req: Request, res: Response) {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const connection = await ensureTenantConnection(id, tenantId);

    const updated = await prisma.connections.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Integração sincronizada',
      integration: toIntegrationResponse(updated),
    });
  },

  async test(req: Request, res: Response) {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const connection = await ensureTenantConnection(id, tenantId);

    if (connection.type === 'WHATSAPP') {
      const isConnected = connection.status === 'CONNECTED';
      return res.json({
        success: isConnected,
        message: isConnected
          ? 'Conexão WhatsApp ativa'
          : 'Whatsapp ainda não conectado. Escaneie o QR Code.',
      });
    }

    if (connection.type === 'FACEBOOK' || connection.type === 'INSTAGRAM') {
      return res.json({
        success: Boolean(connection.accessToken || connection.config),
        message: connection.accessToken
          ? 'Credenciais registradas com sucesso.'
          : 'Integração registrada. Conclua as credenciais para ativar.',
      });
    }

    return res.json({
      success: false,
      message: 'Canal ainda não suportado',
    });
  },
};

export const getIntegrations = integrationsController.list;
export const getIntegration = integrationsController.get;
export const createIntegration = integrationsController.create;
export const updateIntegration = integrationsController.update;
export const deleteIntegration = integrationsController.delete;
export const testIntegration = integrationsController.test;
export const syncIntegration = integrationsController.sync;
