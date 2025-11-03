"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var zod_1 = require("zod");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_HOST: zod_1.z.string().default('localhost'),
    REDIS_PORT: zod_1.z.coerce.number().default(6379),
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    WHATSAPP_PROVIDER: zod_1.z.enum(['venom', 'baileys']).default('venom'),
    FB_APP_ID: zod_1.z.string().optional(),
    FB_APP_SECRET: zod_1.z.string().optional(),
    IG_APP_ID: zod_1.z.string().optional(),
    IG_APP_SECRET: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    SUPABASE_URL: zod_1.z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().optional(),
    BROADCAST_MAX_CONCURRENCY: zod_1.z.coerce.number().default(3),
    BROADCAST_JITTER_PCT: zod_1.z.coerce.number().default(10)
});
var env;
try {
    exports.env = env = envSchema.parse(process.env);
}
catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
}
