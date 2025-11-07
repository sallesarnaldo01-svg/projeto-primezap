import Redis from 'ioredis';
import { URL } from 'node:url';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const buildConnectionFromUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : env.REDIS_PASSWORD,
    maxRetriesPerRequest: null as any,
  };
};

const fallbackConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null as any,
};

export const redisConnectionOptions = env.REDIS_URL
  ? buildConnectionFromUrl(env.REDIS_URL)
  : fallbackConnection;

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
