import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null
};

const createRedisInstance = () =>
  env.REDIS_URL
    ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis(redisConfig);

export const redis = createRedisInstance();
export const redisSubscriber = createRedisInstance();
// BullMQ expects a connection options object. Prefer URL when provided.
type BullConnection = RedisOptions & { url?: string };
export const bullmqConnection: BullConnection = env.REDIS_URL
  ? { url: env.REDIS_URL }
  : redisConfig;

redis.on('connect', () => {
  logger.info('✅ Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error }, '❌ Redis error');
});

redisSubscriber.on('connect', () => {
  logger.info('✅ Redis subscriber connected');
});

redisSubscriber.on('error', (error) => {
  logger.error({ error }, '❌ Redis subscriber error');
});
