import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { processFollowUpCadence } from '../processors/followup-cadence.processor.js';

export const followUpCadenceQueue = new Queue('followup-cadence', {
  connection: bullmqConnection
});

export const followUpCadenceWorker = new Worker(
  'followup-cadence',
  async (job) => {
    return await processFollowUpCadence(job);
  },
  {
    connection: bullmqConnection,
    concurrency: 5
  }
);

followUpCadenceWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Follow-up cadence job completed');
});

followUpCadenceWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Follow-up cadence job failed');
});

logger.info('Follow-up cadence queue initialized');
