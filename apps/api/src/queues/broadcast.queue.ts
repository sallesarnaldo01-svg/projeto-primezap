import { Queue } from 'bullmq';
import { logger } from '../lib/logger.js';
import { redisConnectionOptions } from '../lib/redis.js';

export interface BroadcastJob {
  broadcastId: string;
  tenantId: string;
}

const queueName = 'broadcast-run';

export const broadcastQueue = new Queue<BroadcastJob>(queueName, {
  connection: redisConnectionOptions as any,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

broadcastQueue.on('error', (error) => {
  logger.error({ error }, 'Broadcast queue error');
});
