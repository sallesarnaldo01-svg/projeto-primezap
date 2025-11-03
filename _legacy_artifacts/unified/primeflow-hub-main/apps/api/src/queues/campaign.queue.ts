import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface CampaignJob {
  campaignId: string;
}

const queueName = 'campaign-dispatch';

export const campaignQueue = new Queue<CampaignJob>(queueName, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

campaignQueue.on('error', (error) => {
  logger.error({ error }, 'Campaign queue error');
});
