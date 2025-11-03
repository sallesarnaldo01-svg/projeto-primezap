import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { getWhatsAppProvider } from '../providers/whatsapp/index.js';
import { MessageContent } from '../providers/message.provider.js';

export interface BroadcastJob {
  broadcastId: string;
  tenantId: string;
}

export const broadcastQueue = new Queue<BroadcastJob>('broadcast-run', {
  connection: bullmqConnection
});

export const broadcastWorker = new Worker<BroadcastJob>(
  'broadcast-run',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing broadcast job');

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: job.data.broadcastId }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    // Update status to RUNNING
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'RUNNING' }
    });

    try {
      // Get recipients based on filters
      const contacts = await getRecipients(broadcast);
      
      const config = broadcast.config as any;
      const intervalSec = Number(config?.intervalSec ?? 1);
      const baseDelayMs = Math.max(0, intervalSec) * 1000;
      const pauseEveryN = Number(config?.pauseEveryN ?? 0);
      const pauseForSec = Number(config?.pauseForSec ?? 0);
      const stats = { queued: contacts.length, sent: 0, failed: 0, progress: 0 };

      for (const contact of contacts) {
        try {
          // Execute script actions for this contact
          await executeScript(broadcast, contact, config);
          
          stats.sent++;
          stats.progress = calculateProgress(stats, contacts.length);
          
          // Apply delay with jitter
          const jitter = Math.random() * (env.BROADCAST_JITTER_PCT / 100);
          const delay = baseDelayMs > 0 ? baseDelayMs * (1 + jitter) : 0;
          if (delay > 0) {
            await sleep(delay);
          }
          
          // Check for pause
          if (pauseEveryN > 0 && pauseForSec > 0 && stats.sent % pauseEveryN === 0) {
            logger.info({ broadcastId: broadcast.id }, 'Broadcast paused');
            await sleep(pauseForSec * 1000);
          }
        } catch (error) {
          logger.error({ error, contactId: contact.id }, 'Failed to send to contact');
          stats.failed++;
          stats.progress = calculateProgress(stats, contacts.length);
        }

        // Update progress
        await prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { stats: stats as any }
        });
      }

      if (contacts.length === 0) {
        stats.progress = 100;
      }

      // Mark as DONE
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: 'DONE', stats: stats as any }
      });

      return { success: true, stats };
    } catch (error) {
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: 'FAILED' }
      });
      throw error;
    }
  },
  {
    connection: bullmqConnection,
    concurrency: env.BROADCAST_MAX_CONCURRENCY
  }
);

async function getRecipients(broadcast: any) {
  const filters = broadcast.filters as any;
  
  return prisma.contact.findMany({
    where: {
      tenantId: broadcast.tenantId,
      ...(filters.sources?.length && {
        source: { in: filters.sources }
      }),
      ...(filters.tags?.length && {
        tags: {
          some: {
            tagId: { in: filters.tags }
          }
        }
      })
    }
  });
}

async function executeScript(broadcast: any, contact: any, config: any) {
  const script = Array.isArray(broadcast.script) ? broadcast.script : [];
  const contextConfig = {
    ...config,
    broadcastId: broadcast.id
  };

  for (const action of script) {
    const type = action?.type;
    logger.info({ type, contactId: contact.id }, 'Execute broadcast action');

    switch (type) {
      case 'message':
        await handleMessageAction(action.config ?? {}, contact, contextConfig);
        break;
      case 'delay':
        await handleDelayAction(action.config ?? {});
        break;
      default:
        logger.warn({ type }, 'Unsupported broadcast action type, skipping');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleMessageAction(actionConfig: any, contact: any, broadcastConfig: any) {
  const connectionId = actionConfig.connectionId ?? broadcastConfig?.connectionId;

  if (!connectionId) {
    throw new Error('Missing WhatsApp connection for broadcast action');
  }

  const providerKey = actionConfig.provider ?? broadcastConfig?.provider;
  const provider = providerKey ? getWhatsAppProvider(providerKey) : getWhatsAppProvider();

  const to = normalizePhone(actionConfig.to ?? contact.phone ?? '');
  if (!to) {
    throw new Error('Contact does not have a valid phone number');
  }

  const content = buildMessageContent(actionConfig, contact, broadcastConfig);
  if (!hasMessageContent(content)) {
    throw new Error('Broadcast message has no content to send');
  }

  const isConnected = await provider.isConnected(connectionId);
  if (!isConnected) {
    throw new Error('WhatsApp connection is not connected');
  }

  const response = await provider.sendMessage({
    connectionId,
    to,
    content,
    metadata: {
      contactId: contact.id
    }
  });

  await prisma.messageLog.create({
    data: {
      broadcastId: broadcastConfig?.broadcastId ?? null,
      contactId: contact.id,
      status: 'sent',
      sentAt: new Date()
    }
  }).catch((error) => {
    logger.warn({ error, contactId: contact.id }, 'Failed to log broadcast message');
  });
}

async function handleDelayAction(config: any) {
  const seconds = Number(config?.seconds ?? 0);
  const milliseconds = Number(config?.milliseconds ?? 0);
  const durationMs = milliseconds > 0 ? milliseconds : seconds * 1000;
  if (durationMs > 0) {
    await sleep(durationMs);
  }
}

function buildMessageContent(actionConfig: any, contact: any, broadcastConfig: any): MessageContent {
  const content: MessageContent = {};

  const signatureEnabled = broadcastConfig?.signature?.enabled;
  const signatureName = broadcastConfig?.signature?.customName;

  const renderedText = renderTemplate(actionConfig.text ?? actionConfig.message, contact);
  if (renderedText) {
    content.text = signatureEnabled
      ? appendSignature(renderedText, signatureName)
      : renderedText;
  }

  const mediaUrl = actionConfig.mediaUrl ?? actionConfig.media?.url;
  const mediaType = actionConfig.mediaType ?? actionConfig.media?.type;

  if (mediaUrl && mediaType) {
    switch (mediaType) {
      case 'image':
        content.image = {
          url: mediaUrl,
          caption: renderTemplate(actionConfig.caption, contact)
        };
        break;
      case 'audio':
        content.audio = { url: mediaUrl, ptt: Boolean(actionConfig.ptt) };
        break;
      case 'video':
        content.video = {
          url: mediaUrl,
          caption: renderTemplate(actionConfig.caption, contact)
        };
        break;
      case 'document':
        content.document = {
          url: mediaUrl,
          filename: actionConfig.filename ?? 'document'
        };
        break;
      default:
        break;
    }
  }

  if (Array.isArray(actionConfig.buttons) && actionConfig.buttons.length > 0) {
    content.buttons = actionConfig.buttons.map((button: any) => ({
      id: String(button.id ?? button.value ?? button.label),
      label: renderTemplate(button.label ?? button.text, contact) ?? ''
    }));
  }

  if (actionConfig.list) {
    content.list = {
      title: renderTemplate(actionConfig.list.title, contact) ?? '',
      sections: (actionConfig.list.sections || []).map((section: any) => ({
        title: renderTemplate(section.title, contact) ?? '',
        rows: (section.rows || []).map((row: any) => ({
          id: String(row.id ?? row.value ?? row.title),
          title: renderTemplate(row.title, contact) ?? '',
          description: renderTemplate(row.description, contact) ?? undefined
        }))
      }))
    };
  }

  return content;
}

function hasMessageContent(content: MessageContent): boolean {
  return Boolean(
    content.text ||
    content.image ||
    content.audio ||
    content.video ||
    content.document ||
    (content.buttons && content.buttons.length > 0) ||
    content.list
  );
}

function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';

  const trimmed = rawPhone.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits;
}

function renderTemplate(template: any, contact: any): string | undefined {
  if (typeof template !== 'string' || template.length === 0) {
    return undefined;
  }

  const replacements: Record<string, string> = {
    name: contact?.name ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? ''
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? '';
  });
}

function appendSignature(text: string, signatureName?: string): string {
  if (!signatureName) {
    return `${text}\n\n-- Equipe Primeflow`;
  }

  return `${text}\n\n-- ${signatureName}`;
}

function calculateProgress(stats: { sent: number; failed: number }, total: number): number {
  if (total <= 0) {
    return 100;
  }

  const processed = stats.sent + stats.failed;
  if (processed <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((processed / total) * 100));
}

broadcastWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Broadcast job completed');
});

broadcastWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Broadcast job failed');
});
