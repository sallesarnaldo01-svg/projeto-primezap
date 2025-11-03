import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { processKnowledgeDocument } from '../processors/knowledge.processor.js';

export const knowledgeQueue = new Queue('knowledge-processing', {
  connection: bullmqConnection
});

export const knowledgeWorker = new Worker(
  'knowledge-processing',
  async (job) => {
    return await processKnowledgeDocument(job);
  },
  {
    connection: bullmqConnection,
    concurrency: 3
  }
);

knowledgeWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Knowledge processing job completed');
});

knowledgeWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Knowledge processing job failed');
});

logger.info('Knowledge processing queue initialized');
