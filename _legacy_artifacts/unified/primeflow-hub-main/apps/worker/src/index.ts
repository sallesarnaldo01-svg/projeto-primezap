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
import { startAppointmentReminderMonitor, startScheduledCampaignMonitor } from './services/scheduler.service.js';

async function start() {
  try {
    await connectDatabase();
    await redis.ping();

    logger.info('🚀 Worker started');
    logger.info('📝 Workers registered: flow:run, broadcast:run, broadcast-mass, facebook-mass, instagram-mass, campaign-dispatch, scheduled-campaign-monitor, appointment-reminder-monitor');
    startScheduledCampaignMonitor();
    startAppointmentReminderMonitor();
    
    // Redis subscribers for social media commands
    redisSubscriber.subscribe(
      'whatsapp:connect', 
      'whatsapp:disconnect', 
      'facebook:connect',
      'facebook:disconnect',
      'instagram:connect',
      'instagram:disconnect',
      'broadcast:mass'
    );
    
    redisSubscriber.on('message', async (channel, message) => {
      const data = JSON.parse(message);

      try {
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
            await broadcastMassQueue.add('broadcast-mass', {
              broadcastId: data.broadcastId,
              connectionId: data.connectionId,
              contacts: data.contacts ?? data.recipients ?? [],
              message: data.message,
              delayMs: data.delayMs ?? data.delay ?? 1000,
              provider: data.provider
            });
          } else if (targetChannel === 'facebook') {
            await facebookMassQueue.add('facebook-mass', {
              broadcastId: data.broadcastId,
              connectionId: data.connectionId,
              recipients: data.recipients ?? data.contacts ?? [],
              message: data.message,
              delay: data.delay ?? 3000,
              jitter: data.jitter ?? 0.15
            });
          } else if (targetChannel === 'instagram') {
            await instagramMassQueue.add('instagram-mass', {
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
