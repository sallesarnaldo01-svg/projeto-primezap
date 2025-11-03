import type { connections } from '@prisma/client';

export interface IntegrationView {
  id: string;
  provider: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  connectedAt?: string;
  lastSyncAt?: string;
  config?: Record<string, any>;
  error?: string;
}

export interface IntegrationStatusView {
  provider: string;
  connected: boolean;
  accounts: number;
  lastSync?: string;
}

type ConnectionModel = connections;

function normalizeConfig(config: unknown): Record<string, any> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {};
  }

  return { ...(config as Record<string, any>) };
}

export function mapConnectionStatus(status: string): IntegrationView['status'] {
  switch (status) {
    case 'CONNECTED':
      return 'connected';
    case 'CONNECTING':
      return 'connecting';
    case 'ERROR':
      return 'error';
    default:
      return 'disconnected';
  }
}

export function connectionToIntegration(
  connection: ConnectionModel
): IntegrationView {
  const config = normalizeConfig(connection.config);
  const status = mapConnectionStatus(connection.status ?? 'DISCONNECTED');

  return {
    id: connection.id,
    provider: connection.type.toLowerCase(),
    status,
    connectedAt:
      status === 'connected' && connection.updatedAt
        ? connection.updatedAt.toISOString()
        : undefined,
    lastSyncAt: connection.lastSyncAt
      ? connection.lastSyncAt.toISOString()
      : typeof (config.lastSyncAt ?? config.last_sync_at) === 'string'
      ? (config.lastSyncAt ?? config.last_sync_at)
      : undefined,
    config,
    error:
      typeof config.error === 'string'
        ? config.error
        : config.error?.message ?? undefined,
  };
}

export function summarizeIntegrations(
  connections: ConnectionModel[]
): IntegrationStatusView[] {
  const summaryMap = new Map<string, IntegrationStatusView>();

  for (const connection of connections) {
    const provider = connection.type.toLowerCase();
    const current = summaryMap.get(provider) ?? {
      provider,
      connected: false,
      accounts: 0,
      lastSync: undefined as string | undefined,
    };

    current.accounts += 1;

    if (connection.status === 'CONNECTED') {
      current.connected = true;
    }

    const candidate =
      connection.lastSyncAt?.toISOString() ??
      connection.updatedAt?.toISOString();

    if (
      candidate &&
      (!current.lastSync ||
        new Date(candidate).getTime() > new Date(current.lastSync).getTime())
    ) {
      current.lastSync = candidate;
    }

    summaryMap.set(provider, current);
  }

  return Array.from(summaryMap.values()).map(({ lastSync, ...rest }) => ({
    ...rest,
    lastSync,
  }));
}
