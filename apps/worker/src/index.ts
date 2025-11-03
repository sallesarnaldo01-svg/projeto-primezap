import { logger } from './lib/logger.js';
import { connectDatabase } from './lib/prisma.js';
import { redis, redisSubscriber } from './lib/redis.js';
import { campaignWorker } from './queues/campaign.queue.js';
import { flowWorker } from './queues/flow.queue.js';
import { broadcastWorker } from './queues/broadcast.queue.js';
import { broadcastMassWorker, broadcastMassQueue } from './queues/broadcast-mass.queue.js';
import { facebookMassWorker, facebookMassQueue } from './queues/facebook-mass.queue.js';
import { instagramMassWorker, instagramMassQueue } from './queues/instagram-mass.queue.js';
import { getWhatsAppProvider } from './providers/whatsapp/index.js';
import { facebookProvider } from './providers/facebook/facebook.provider.js';
import { instagramProvider } from './providers/instagram/instagram.provider.js';
import { startAppointmentReminderMonitor, startScheduledCampaignMonitor, startAppointmentFeedbackMonitor } from './services/scheduler.service.js';
import { registerWhatsAppInboundHandlers } from './services/whatsapp.inbound.service.js';

async function start() {
  try {
    await connectDatabase();
    await redis.ping();

    logger.info('🚀 Worker started');
    logger.info('📝 Workers registered: flow:run, broadcast:run, broadcast-mass, facebook-mass, instagram-mass, campaign-dispatch, scheduled-campaign-monitor, appointment-reminder-monitor');
    registerWhatsAppInboundHandlers();
    startScheduledCampaignMonitor();
    startAppointmentReminderMonitor();
    startAppointmentFeedbackMonitor();
    
    // Redis subscribers for social media commands
    redisSubscriber.subscribe(
      'whatsapp:connect', 
      'whatsapp:disconnect', 
      'facebook:connect',
      'facebook:disconnect',
      'instagram:connect',
      'instagram:disconnect',
      'broadcast:mass',
      'messages:send'
    );
    
    redisSubscriber.on('message', async (channel, message) => {
      const data = JSON.parse(message);

      try {
        if (channel.startsWith('whatsapp')) {
          logger.info(
            {
              channel,
              connectionId: data.connectionId,
              tenantId: data.tenantId,
              provider: data.provider,
              sessionName: data.sessionName,
            },
            'Processing WhatsApp event'
          );
          console.info('[worker] whatsapp event', {
            channel,
            connectionId: data.connectionId,
            tenantId: data.tenantId,
            sessionName: data.sessionName,
            provider: data.provider,
          });
        }

        if (channel === 'whatsapp:connect' || channel === 'whatsapp:disconnect') {
          const provider = data.provider ? getWhatsAppProvider(data.provider) : getWhatsAppProvider();

          if (channel === 'whatsapp:connect') {
            await provider.connect(data.connectionId, data.config ?? {});
          } else {
            await provider.disconnect(data.connectionId);
          }
        } else if (channel === 'facebook:connect') {
          await facebookProvider.connect(data.connectionId, {
            email: data.email,
            password: data.password
          });
        } else if (channel === 'facebook:disconnect') {
          await facebookProvider.disconnect(data.connectionId);
        } else if (channel === 'instagram:connect') {
          await instagramProvider.connect(data.connectionId, {
            username: data.username,
            password: data.password
          });
        } else if (channel === 'instagram:disconnect') {
          await instagramProvider.disconnect(data.connectionId);
        } else if (channel === 'broadcast:mass') {
          const targetChannel = (data.channel || 'whatsapp').toLowerCase();

          if (targetChannel === 'whatsapp') {
            await (broadcastMassQueue as any).add('broadcast-mass', {
              broadcastId: data.broadcastId,
              connectionId: data.connectionId,
              contacts: data.contacts ?? data.recipients ?? [],
              message: data.message,
              delayMs: data.delayMs ?? data.delay ?? 1000,
              provider: data.provider
            });
          } else if (targetChannel === 'facebook') {
            await (facebookMassQueue as any).add('facebook-mass', {
              broadcastId: data.broadcastId,
              connectionId: data.connectionId,
              recipients: data.recipients ?? data.contacts ?? [],
              message: data.message,
              delay: data.delay ?? 3000,
              jitter: data.jitter ?? 0.15
            });
          } else if (targetChannel === 'instagram') {
            await (instagramMassQueue as any).add('instagram-mass', {
              broadcastId: data.broadcastId,
              connectionId: data.connectionId,
              recipients: data.recipients ?? data.contacts ?? [],
              message: data.message,
              delay: data.delay ?? 3000,
              jitter: data.jitter ?? 0.15
            });
          } else {
            logger.warn({ channel: targetChannel, payload: data }, 'Unknown broadcast channel');
          }
        } else if (channel === 'messages:send') {
          try {
            const provider = getWhatsAppProvider();
            const messageId = data.messageId as string;
            const contactId = data.contactId as string;
            const content = data.type === 'text'
              ? { text: data.content as string }
              : buildMediaContent(data.type as string, data.mediaUrl as string | undefined);

            if (!contactId || !messageId) {
              throw new Error('INVALID_MESSAGES_SEND_PAYLOAD');
            }

            // Resolve phone and connection
            const phoneRow = await (await import('./lib/prisma.js')).prisma.$queryRawUnsafe<{ phone: string }[]>(
              `SELECT phone FROM public.contacts WHERE id = $1 LIMIT 1`,
              contactId,
            );
            const phone = phoneRow?.[0]?.phone ? String(phoneRow[0].phone).trim() : '';
            if (!phone) throw new Error('CONTACT_PHONE_NOT_FOUND');

            const connRows = await (await import('./lib/prisma.js')).prisma.$queryRawUnsafe<{ id: string }[]>(
              `SELECT id FROM public.connections WHERE type = 'WHATSAPP' AND status = 'CONNECTED' ORDER BY updated_at DESC LIMIT 1`
            );
            const connectionId = connRows?.[0]?.id;
            if (!connectionId) throw new Error('NO_CONNECTED_WHATSAPP');

            await provider.sendMessage({ connectionId, to: phone, content: content as any });

            await (await import('./lib/prisma.js')).prisma.$executeRawUnsafe(
              `UPDATE public.messages SET status = 'sent', updated_at = now() WHERE id = $1`,
              messageId,
            );

            logger.info({ messageId, contactId, connectionId }, 'messages:send processed');
          } catch (err) {
            logger.error({ err, payload: data }, 'Failed to process messages:send');
          }
        }
      } catch (error) {
        logger.error({ channel, error }, 'Failed to process subscriber message');
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start worker');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await flowWorker.close();
  await campaignWorker.close();
  await broadcastWorker.close();
  await broadcastMassWorker.close();
  await facebookMassWorker.close();
  await instagramMassWorker.close();
  await redisSubscriber.quit();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await flowWorker.close();
  await campaignWorker.close();
  await broadcastWorker.close();
  await broadcastMassWorker.close();
  await facebookMassWorker.close();
  await instagramMassWorker.close();
  await redisSubscriber.quit();
  await redis.quit();
  process.exit(0);
});

start();

function buildMediaContent(type: string, mediaUrl?: string) {
  if (!mediaUrl) return {};
  switch (type) {
    case 'image':
      return { image: { url: mediaUrl } };
    case 'audio':
      return { audio: { url: mediaUrl, ptt: true } };
    case 'video':
      return { video: { url: mediaUrl } };
    case 'document':
      return { document: { url: mediaUrl } };
    default:
      return {};
  }
}
