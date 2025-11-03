import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface BroadcastJob {
  broadcastId: string;
  tenantId: string;
}

const queueName = 'broadcast-run';

export const broadcastQueue = new Queue<BroadcastJob>(queueName, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

broadcastQueue.on('error', (error) => {
  logger.error({ error }, 'Broadcast queue error');
});
