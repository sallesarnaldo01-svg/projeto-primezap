import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' }
  ]
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    try {
      const url = new URL(env.DATABASE_URL);
      logger.info({ host: url.host, database: url.pathname.replace(/^\//, '') }, '✅ Database connected');
    } catch (parseError) {
      logger.info('✅ Database connected');
    }
  } catch (error) {
    logger.error({ error }, '❌ Database connection failed');
    throw error;
  }
}
