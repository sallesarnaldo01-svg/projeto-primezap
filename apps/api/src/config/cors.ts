import { FastifyCorsOptions } from '@fastify/cors';

/**
 * CORS Configuration for PrimeZap AI
 * 
 * Configures Cross-Origin Resource Sharing (CORS) to allow
 * frontend applications to communicate with the API securely.
 */

/**
 * Allowed origins based on environment
 */
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Production domains
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Additional production domains
  const productionDomains = [
    'https://primezap.com',
    'https://www.primezap.com',
    'https://app.primezap.com',
    'https://api.primezap.com',
  ];

  origins.push(...productionDomains);

  // Development/staging domains
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    );
  }

  // Staging domain
  if (process.env.STAGING_URL) {
    origins.push(process.env.STAGING_URL);
  }

  return origins.filter(Boolean);
};

/**
 * CORS options for Fastify
 */
export const corsOptions: FastifyCorsOptions = {
  // Origin validation
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      callback(null, true);
      return;
    }

    // Reject origin
    callback(new Error('Not allowed by CORS'), false);
  },

  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Tenant-ID',
    'X-API-Key',
    'X-Request-ID',
  ],

  // Exposed headers (accessible to frontend)
  exposedHeaders: [
    'X-Total-Count',
    'X-Page',
    'X-Per-Page',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
  ],

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Preflight cache duration (in seconds)
  maxAge: 86400, // 24 hours

  // Success status for OPTIONS requests
  optionsSuccessStatus: 204,

  // Preflight continue
  preflightContinue: false,
};

/**
 * Strict CORS options (for production)
 */
export const strictCorsOptions: FastifyCorsOptions = {
  ...corsOptions,
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins().filter(
      (o) => !o.includes('localhost') && !o.includes('127.0.0.1')
    );

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  maxAge: 3600, // 1 hour (shorter for production)
};

/**
 * Permissive CORS options (for development only)
 */
export const permissiveCorsOptions: FastifyCorsOptions = {
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: '*',
  exposedHeaders: '*',
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

/**
 * Get CORS options based on environment
 */
export const getCorsOptions = (): FastifyCorsOptions => {
  if (process.env.NODE_ENV === 'production') {
    return strictCorsOptions;
  }

  if (process.env.NODE_ENV === 'development') {
    return permissiveCorsOptions;
  }

  return corsOptions;
};

/**
 * Validate CORS configuration on startup
 */
export const validateCorsConfig = (): void => {
  const allowedOrigins = getAllowedOrigins();

  console.log('🔒 CORS Configuration:');
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Allowed Origins: ${allowedOrigins.length}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('   ⚠️  Development mode: Permissive CORS enabled');
  } else {
    console.log('   ✅ Production mode: Strict CORS enabled');
  }

  allowedOrigins.forEach((origin, index) => {
    console.log(`   ${index + 1}. ${origin}`);
  });

  if (allowedOrigins.length === 0) {
    console.warn('   ⚠️  WARNING: No allowed origins configured!');
  }
};

/**
 * Example usage:
 * 
 * // In your Fastify app setup
 * import fastifyCors from '@fastify/cors';
 * import { getCorsOptions, validateCorsConfig } from './config/cors';
 * 
 * // Register CORS
 * await app.register(fastifyCors, getCorsOptions());
 * 
 * // Validate configuration
 * validateCorsConfig();
 */
