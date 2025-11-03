import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const redisOptions = env.REDIS_URL
  ? env.REDIS_URL
  : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null as any,
    };

export const redis = new Redis(redisOptions as any);

redis.on('connect', () => {
  logger.info('✅ Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error }, '❌ Redis error');
});

export async function disconnectRedis() {
  await redis.quit();
  logger.info('Redis disconnected');
}
