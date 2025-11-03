import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { processBulkAI } from '../processors/bulk-ai.processor.js';

export const bulkAIQueue = new Queue('bulk-ai', {
  connection: bullmqConnection
});

export const bulkAIWorker = new Worker(
  'bulk-ai',
  async (job) => {
    return await processBulkAI(job);
  },
  {
    connection: bullmqConnection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000 // 10 jobs por minuto
    }
  }
);

bulkAIWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Bulk AI job completed');
});

bulkAIWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Bulk AI job failed');
});

logger.info('Bulk AI queue initialized');
