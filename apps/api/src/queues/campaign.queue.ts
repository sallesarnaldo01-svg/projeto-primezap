import { Queue } from 'bullmq';
import { logger } from '../lib/logger.js';
import { redisConnectionOptions } from '../lib/redis.js';

export interface CampaignJob {
  campaignId: string;
}

const queueName = 'campaign-dispatch';

export const campaignQueue = new Queue<CampaignJob>(queueName, {
  connection: redisConnectionOptions as any,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

campaignQueue.on('error', (error) => {
  logger.error({ error }, 'Campaign queue error');
});
