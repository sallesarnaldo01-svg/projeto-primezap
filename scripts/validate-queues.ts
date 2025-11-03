import 'dotenv/config';
import { Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL)
  : new IORedis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT || 6379) });

async function main() {
  console.log('🔌 Connecting to Redis...');
  await connection.ping();
  console.log('✅ Redis OK');

  const qName = 'health-check';
  const queue = new Queue(qName, { connection });
  const events = new QueueEvents(qName, { connection });

  const worker = new Worker(qName, async (job) => {
    return { received: job.data, ts: Date.now() };
  }, { connection });

  const completed = new Promise((resolve, reject) => {
    events.on('completed', ({ jobId }) => {
      console.log('🎉 Job completed:', jobId);
      resolve(undefined);
    });
    events.on('failed', ({ jobId, failedReason }) => {
      reject(new Error(`Job ${jobId} failed: ${failedReason}`));
    });
  });

  const job = await queue.add('ping', { hello: 'world' }, { removeOnComplete: true, removeOnFail: true });
  console.log('📩 Enqueued job:', job.id);

  await completed;
  await worker.close();
  await events.close();
  await queue.close();
  await connection.quit();
  console.log('✅ Queue validation OK');
}

main().catch((err) => {
  console.error('❌ Queue validation failed:', err);
  process.exit(1);
});

