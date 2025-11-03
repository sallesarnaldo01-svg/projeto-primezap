import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null
};

export const redis = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);
export const bullmqConnection = redisConfig;

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
