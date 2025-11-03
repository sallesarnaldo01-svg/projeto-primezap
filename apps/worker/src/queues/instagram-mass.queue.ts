import { Worker, Job, Queue } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { instagramProvider } from '../providers/instagram/instagram.provider.js';
import { prisma } from '../lib/prisma.js';

interface InstagramMassJob {
  broadcastId: string;
  connectionId: string;
  recipients: string[];
  message: string;
  delay: number;
  jitter: number;
}

export const instagramMassQueue = new Queue<InstagramMassJob>('instagram-mass', {
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

export const instagramMassWorker = new Worker<InstagramMassJob>(
  'instagram-mass',
  async (job: Job<InstagramMassJob>) => {
    const { broadcastId, connectionId, recipients, message, delay, jitter } = job.data;
    
    logger.info({
      broadcastId,
      recipientCount: recipients.length
    }, 'Processing Instagram mass broadcast');

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const broadcast = await prisma.broadcast.findUnique({
          where: { id: broadcastId }
        });

        if (broadcast?.status === 'PAUSED') {
          logger.info({ broadcastId }, 'Broadcast paused, stopping');
          break;
        }

        // Send DM
        await instagramProvider.sendDirectMessage(connectionId, recipient, message);
        sent++;

        job.updateProgress((sent / recipients.length) * 100);

        // Skip legacy messageLog write; rely on broadcast stats updates.

        // Anti-ban delay with jitter
        if (sent < recipients.length) {
          const jitterAmount = delay * jitter;
          const actualDelay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        }

      } catch (error: any) {
        failed++;
        logger.error({
          error: error.message,
          recipient
        }, 'Failed to send Instagram DM');
      }
    }

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'DONE',
        stats: { sent, failed, total: recipients.length }
      }
    });

    logger.info({
      broadcastId,
      sent,
      failed
    }, 'Instagram mass broadcast completed');

    return { sent, failed };
  },
  {
    connection: bullmqConnection,
    concurrency: 1
  }
);

instagramMassWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Instagram mass job completed');
});

instagramMassWorker.on('failed', (job, err) => {
  logger.error({ 
    jobId: job?.id, 
    error: err.message 
  }, 'Instagram mass job failed');
});
