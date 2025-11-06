import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

/**
 * Rate Limiting Middleware for Fastify
 * 
 * Implements token bucket algorithm for rate limiting
 * with Redis for distributed rate limiting across instances.
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string; // Custom error message
  statusCode?: number; // HTTP status code for rate limit exceeded
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (request: FastifyRequest) => string; // Custom key generator
}

interface RateLimitStore {
  increment(key: string): Promise<{ totalHits: number; resetTime: Date }>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

/**
 * Redis-based rate limit store
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: Redis;
  private windowMs: number;

  constructor(redis: Redis, windowMs: number) {
    this.redis = redis;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Add current request
    await this.redis.zadd(key, now, `${now}`);

    // Set expiry
    await this.redis.expire(key, Math.ceil(this.windowMs / 1000));

    // Count requests in window
    const totalHits = await this.redis.zcard(key);

    const resetTime = new Date(now + this.windowMs);

    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const members = await this.redis.zrange(key, -1, -1);
    if (members.length > 0) {
      await this.redis.zrem(key, members[0]);
    }
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

/**
 * In-memory rate limit store (for development/testing)
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private hits: Map<string, number[]> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing hits
    let hits = this.hits.get(key) || [];

    // Remove old hits
    hits = hits.filter((time) => time > windowStart);

    // Add current hit
    hits.push(now);

    // Store updated hits
    this.hits.set(key, hits);

    const resetTime = new Date(now + this.windowMs);

    return { totalHits: hits.length, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const hits = this.hits.get(key);
    if (hits && hits.length > 0) {
      hits.pop();
      this.hits.set(key, hits);
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key);
  }
}

/**
 * Default key generator - uses IP address
 */
const defaultKeyGenerator = (request: FastifyRequest): string => {
  return request.ip || 'unknown';
};

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(
  store: RateLimitStore,
  config: RateLimitConfig
) {
  const {
    max,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
  } = config;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:${keyGenerator(request)}`;

    // Increment counter
    const { totalHits, resetTime } = await store.increment(key);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', Math.max(0, max - totalHits));
    reply.header('X-RateLimit-Reset', resetTime.toISOString());

    // Check if limit exceeded
    if (totalHits > max) {
      reply.header('Retry-After', Math.ceil((resetTime.getTime() - Date.now()) / 1000));
      
      return reply.status(statusCode).send({
        error: 'Too Many Requests',
        message,
        statusCode,
      });
    }

    // Decrement usage after the response is sent if needed
    if (skipSuccessfulRequests || skipFailedRequests) {
      reply.raw.once('finish', () => {
        const shouldSkip =
          (skipSuccessfulRequests && reply.statusCode < 400) ||
          (skipFailedRequests && reply.statusCode >= 400);

        if (shouldSkip) {
          void store.decrement(key);
        }
      });
    }
  };
}

/**
 * Preset rate limiters
 */

// General API rate limiter (100 requests per 15 minutes)
export const apiRateLimiter = (store: RateLimitStore) =>
  createRateLimiter(store, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many API requests from this IP, please try again later.',
  });

// Strict rate limiter for sensitive endpoints (5 requests per minute)
export const strictRateLimiter = (store: RateLimitStore) =>
  createRateLimiter(store, {
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many requests to this endpoint, please try again later.',
  });

// Auth rate limiter (5 login attempts per 15 minutes)
export const authRateLimiter = (store: RateLimitStore) =>
  createRateLimiter(store, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true, // Only count failed attempts
  });

// Webhook rate limiter (1000 requests per minute)
export const webhookRateLimiter = (store: RateLimitStore) =>
  createRateLimiter(store, {
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    message: 'Webhook rate limit exceeded.',
  });

// Per-user rate limiter (uses user ID instead of IP)
export const userRateLimiter = (store: RateLimitStore, max: number = 100) =>
  createRateLimiter(store, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    message: 'You have exceeded your rate limit.',
    keyGenerator: (request: FastifyRequest) => {
      // @ts-ignore - user is added by auth middleware
      return request.user?.id || request.ip || 'unknown';
    },
  });

/**
 * Example usage:
 * 
 * // In your Fastify app setup
 * import { Redis } from 'ioredis';
 * import { RedisRateLimitStore, apiRateLimiter } from './middleware/rate-limit';
 * 
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisRateLimitStore(redis, 15 * 60 * 1000);
 * 
 * // Apply to all routes
 * app.addHook('preHandler', apiRateLimiter(store));
 * 
 * // Or apply to specific routes
 * app.post('/api/auth/login', {
 *   preHandler: [authRateLimiter(store)]
 * }, async (request, reply) => {
 *   // Login logic
 * });
 */
