import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  WHATSAPP_PROVIDER: z.enum(['venom', 'baileys']).default('venom'),
  FB_APP_ID: z.string().optional(),
  FB_APP_SECRET: z.string().optional(),
  IG_APP_ID: z.string().optional(),
  IG_APP_SECRET: z.string().optional(),
  OPENAI_API_KEY: z
    .string()
    .optional()
    .transform((val) => (typeof val === 'string' && val.trim().length > 0 ? val : undefined)),
  SUPABASE_URL: z
    .string()
    .url()
    .or(z.literal(''))
    .optional()
    .transform((val) => (typeof val === 'string' && val.trim().length > 0 ? val : undefined)),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .transform((val) => (typeof val === 'string' && val.trim().length > 0 ? val : undefined)),
  BROADCAST_MAX_CONCURRENCY: z.coerce.number().default(3),
  BROADCAST_JITTER_PCT: z.coerce.number().default(10)
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  process.exit(1);
}

export { env };
