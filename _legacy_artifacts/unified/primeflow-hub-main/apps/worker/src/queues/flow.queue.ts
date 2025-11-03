import { Queue, Worker } from 'bullmq';
import { bullmqConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { FlowExecutor } from '../executors/flow.executor.js';

export interface FlowJob {
  flowId: string;
  contactId: string;
  startNodeId?: string;
  variables?: Record<string, any>;
}

export const flowQueue = new Queue<FlowJob>('flow-run', {
  connection: bullmqConnection
});

export const flowWorker = new Worker<FlowJob>(
  'flow-run',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing flow job');

    const executor = new FlowExecutor(
      job.data.flowId,
      job.data.contactId,
      job.data.variables
    );

    try {
      await executor.execute(job.data.startNodeId);
      
      return {
        success: true,
        variables: executor.getVariables()
      };
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Flow execution failed');
      throw error;
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 10
  }
);

flowWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Flow job completed');
});

flowWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Flow job failed');
});
