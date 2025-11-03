import { Queue, Worker, Job } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { getWhatsAppProvider } from '../providers/whatsapp/index.js';
import { MessageContent } from '../providers/message.provider.js';

interface BroadcastMassJob {
  broadcastId: string;
  connectionId: string;
  contacts: string[];
  message: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'video' | 'document';
  };
  delayMs: number;
  provider?: string;
}

export const broadcastMassQueue = new Queue<BroadcastMassJob>('broadcast-mass', {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

export const broadcastMassWorker = new Worker<BroadcastMassJob>(
  'broadcast-mass',
  async (job: Job<BroadcastMassJob>) => {
    const { broadcastId, connectionId, contacts, message, delayMs, provider: providerName } = job.data;
    const whatsappProvider = providerName ? getWhatsAppProvider(providerName) : getWhatsAppProvider();
    
    logger.info({ 
      broadcastId, 
      connectionId,
      totalContacts: contacts.length,
      delayMs 
    }, 'Processing mass broadcast');

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    const total = contacts.length;
    let sent = 0;
    let failed = 0;
    let terminateEarly = false;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Check if connection is still active
        const isConnected = await whatsappProvider.isConnected(connectionId);
        if (!isConnected) {
          throw new Error('WHATSAPP_CONNECTION_LOST');
        }

        // Send message
        const content = buildContent(message);
        const normalizedContact = normalizePhone(contact);

        if (!normalizedContact) {
          throw new Error('Invalid contact number');
        }

        const response = await whatsappProvider.sendMessage({
          connectionId,
          to: normalizedContact,
          content
        });

        sent++;
        logger.info({ broadcastId, contact, sent, total: contacts.length }, 'Message sent in broadcast');

        await prisma.messageLog.create({
          data: {
            broadcastId,
            status: 'sent',
            sentAt: new Date()
          }
        }).catch((error) => {
          logger.warn({ broadcastId, error }, 'Failed to log WhatsApp broadcast message');
        });

        // Update progress
        await job.updateProgress({
          total: contacts.length,
          sent,
          failed,
          current: i + 1,
          percentage: Math.round(((i + 1) / contacts.length) * 100)
        });

        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: {
            stats: {
              queued: total,
              sent,
              failed,
              total,
              progress: Math.min(100, Math.round(((sent + failed) / total) * 100))
            }
          }
        });

        // Apply delay (except for last message)
        if (i < contacts.length - 1) {
          const jitter = Math.random() * (delayMs * 0.2); // 20% jitter
          const actualDelay = delayMs + jitter;
          
          logger.debug({ delay: actualDelay }, 'Applying delay');
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        }

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'WHATSAPP_CONNECTION_LOST') {
          terminateEarly = true;
        }

        logger.error({ 
          broadcastId, 
          contact, 
          error: errorMessage
        }, 'Failed to send message in broadcast');

        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: {
            stats: {
              queued: total,
              sent,
              failed,
              total,
              progress: Math.min(100, Math.round(((sent + failed) / total) * 100))
            }
          }
        });

        if (terminateEarly) {
          break;
        }
      }
    }

    // Update broadcast stats
    const progress = total === 0 ? 100 : Math.min(100, Math.round(((sent + failed) / total) * 100));
    const status = total === 0 ? 'DONE' : (terminateEarly || sent === 0 ? 'FAILED' : 'DONE');

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status,
        stats: {
          queued: total,
          sent,
          failed,
          total,
          progress
        }
      }
    });

    logger.info({ broadcastId, sent, failed, total }, 'Mass broadcast completed');

    return { sent, failed, total };
  },
  {
    connection: bullmqConnection,
    concurrency: 1, // Process one broadcast at a time per worker
    limiter: {
      max: 1,
      duration: 1000
    }
  }
);

broadcastMassWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Broadcast mass job completed');
});

broadcastMassWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Broadcast mass job failed');
});

function normalizePhone(phone: string): string {
  if (!phone) {
    return '';
  }

  const trimmed = phone.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits;
}

function buildContent(message: BroadcastMassJob['message']): MessageContent {
  const content: MessageContent = {};

  if (message.text) {
    content.text = message.text;
  }

  if (message.mediaUrl) {
    switch (message.mediaType) {
      case 'image':
        content.image = { url: message.mediaUrl };
        break;
      case 'audio':
        content.audio = { url: message.mediaUrl, ptt: true };
        break;
      case 'video':
        content.video = { url: message.mediaUrl };
        break;
      case 'document':
        content.document = { url: message.mediaUrl };
        break;
      default:
        break;
    }
  }

  return content;
}
