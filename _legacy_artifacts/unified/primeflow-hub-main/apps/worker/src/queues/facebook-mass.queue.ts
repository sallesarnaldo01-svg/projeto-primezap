import { Worker, Job, Queue } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { facebookProvider } from '../providers/facebook/facebook.provider.js';
import { prisma } from '../lib/prisma.js';

interface FacebookMassJob {
  broadcastId: string;
  connectionId: string;
  recipients: string[];
  message: string;
  delay: number;
  jitter: number;
}

export const facebookMassQueue = new Queue<FacebookMassJob>('facebook-mass', {
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

export const facebookMassWorker = new Worker<FacebookMassJob>(
  'facebook-mass',
  async (job: Job<FacebookMassJob>) => {
    const { broadcastId, connectionId, recipients, message, delay, jitter } = job.data;
    
    logger.info({
      broadcastId,
      recipientCount: recipients.length
    }, 'Processing Facebook mass broadcast');

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        // Check if broadcast is paused
        const broadcast = await prisma.broadcast.findUnique({
          where: { id: broadcastId }
        });

        if (broadcast?.status === 'PAUSED') {
          logger.info({ broadcastId }, 'Broadcast paused, stopping');
          break;
        }

        // Send message
        await facebookProvider.sendMessage(connectionId, recipient, message);
        sent++;

        // Update progress
        job.updateProgress((sent / recipients.length) * 100);

        // Log message
        await prisma.messageLog.create({
          data: {
            tenantId: broadcast!.tenantId,
            channel: 'FACEBOOK',
            direction: 'OUT',
            contact: recipient,
            payload: { message, broadcastId }
          }
        });

        // Apply delay with jitter for anti-ban
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
        }, 'Failed to send Facebook message');
      }
    }

    // Update broadcast status
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
    }, 'Facebook mass broadcast completed');

    return { sent, failed };
  },
  {
    connection: bullmqConnection,
    concurrency: 1
  }
);

facebookMassWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Facebook mass job completed');
});

facebookMassWorker.on('failed', (job, err) => {
  logger.error({ 
    jobId: job?.id, 
    error: err.message 
  }, 'Facebook mass job failed');
});
