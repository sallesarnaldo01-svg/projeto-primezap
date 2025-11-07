import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const fallbackConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null as any,
};

export const redisConnectionOptions = env.REDIS_URL ? env.REDIS_URL : fallbackConnection;

export const redis = new Redis(redisConnectionOptions as any);

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
