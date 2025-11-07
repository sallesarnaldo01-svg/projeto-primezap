import { Queue } from 'bullmq';
import { logger } from '../lib/logger.js';
import { redisConnectionOptions } from '../lib/redis.js';

export interface FollowUpCadenceJob {
  tenantId: string;
  cadenceId: string;
  leadIds: string[];
  stepIndex: number;
}

const queueName = 'followup-cadence';

export const followUpCadenceQueue = new Queue<FollowUpCadenceJob>(queueName, {
  connection: redisConnectionOptions as any,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

followUpCadenceQueue.on('error', (error) => {
  logger.error({ error }, 'Follow-up cadence queue error');
});
