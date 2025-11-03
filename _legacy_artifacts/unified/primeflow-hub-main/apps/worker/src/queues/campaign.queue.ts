import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { processCampaign } from '../processors/campaign.processor.js';

export interface CampaignJob {
  campaignId: string;
}

const queueName = 'campaign-dispatch';

export const campaignQueue = new Queue<CampaignJob>(queueName, {
  connection: bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const campaignWorker = new Worker<CampaignJob>(
  queueName,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing campaign job');
    return processCampaign(job);
  },
  {
    connection: bullmqConnection,
    concurrency: 2,
  },
);

campaignWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Campaign job completed');
});

campaignWorker.on('failed', (job, error) => {
  logger.error({
    jobId: job?.id,
    error: error?.message ?? error,
  }, 'Campaign job failed');
});
