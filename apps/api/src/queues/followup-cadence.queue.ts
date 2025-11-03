import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface FollowUpCadenceJob {
  tenantId: string;
  cadenceId: string;
  leadIds: string[];
  stepIndex: number;
}

const queueName = 'followup-cadence';

export const followUpCadenceQueue = new Queue<FollowUpCadenceJob>(queueName, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT
  },
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
