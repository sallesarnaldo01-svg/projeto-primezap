import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

type RequestWithCookies = FastifyRequest & { cookies?: Record<string, string> };

/**
 * Security Middleware for PrimeZap AI
 * 
 * Implements various security measures including:
 * - Request ID generation
 * - Security headers
 * - Input sanitization
 * - CSRF protection
 * - IP whitelisting/blacklisting
 */

/**
 * Generate unique request ID
 */
export function requestIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const requestId = crypto.randomUUID();
  request.headers['x-request-id'] = requestId;
  reply.header('X-Request-ID', requestId);
  done();
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  // Prevent clickjacking
  reply.header('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  reply.header('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Permissions Policy (formerly Feature Policy)
  reply.header(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  done();
}

/**
 * IP whitelist/blacklist middleware
 */
export function ipFilterMiddleware(options: {
  whitelist?: string[];
  blacklist?: string[];
}) {
  const { whitelist, blacklist } = options;

  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const clientIp = request.ip;

    // Check blacklist first
    if (blacklist && blacklist.includes(clientIp)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your IP address has been blocked.',
        statusCode: 403,
      });
    }

    // Check whitelist (if configured)
    if (whitelist && whitelist.length > 0 && !whitelist.includes(clientIp)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your IP address is not allowed.',
        statusCode: 403,
      });
    }

    done();
  };
}

/**
 * Input sanitization middleware
 */
export function sanitizeInputMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  // Sanitize query parameters
  if (request.query) {
    request.query = sanitizeObject(request.query);
  }

  // Sanitize body
  if (request.body && typeof request.body === 'object') {
    request.body = sanitizeObject(request.body);
  }

  done();
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitize string (remove potentially dangerous characters)
 */
function sanitizeString(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove null bytes
  let sanitized = value.replace(/\0/g, '');

  // Remove control characters (except newline, tab, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * CSRF token validation middleware
 */
export function csrfMiddleware(options: {
  headerName?: string;
  cookieName?: string;
  ignoreMethods?: string[];
}) {
  const {
    headerName = 'X-CSRF-Token',
    cookieName = 'csrf-token',
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
  } = options;

  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    // Skip CSRF check for safe methods
    if (ignoreMethods.includes(request.method)) {
      done();
      return;
    }

    // Get CSRF token from header
    const headerToken = request.headers[headerName.toLowerCase()] as string;

    // Get CSRF token from cookie
    const cookieToken = (request as RequestWithCookies).cookies?.[cookieName];

    // Validate tokens
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid CSRF token.',
        statusCode: 403,
      });
    }

    done();
  };
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Request size limit middleware
 */
export function requestSizeLimitMiddleware(maxSize: number = 10 * 1024 * 1024) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);

    if (contentLength > maxSize) {
      return reply.status(413).send({
        error: 'Payload Too Large',
        message: `Request size exceeds maximum allowed size of ${maxSize} bytes.`,
        statusCode: 413,
      });
    }

    done();
  };
}

/**
 * User-Agent validation middleware
 */
export function userAgentValidationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const userAgent = request.headers['user-agent'];

  // Block requests without User-Agent
  if (!userAgent) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'User-Agent header is required.',
      statusCode: 400,
    });
  }

  // Block known bad bots
  const badBots = [
    'masscan',
    'nmap',
    'nikto',
    'sqlmap',
    'metasploit',
    'scrapy',
  ];

  const lowerUserAgent = userAgent.toLowerCase();
  for (const bot of badBots) {
    if (lowerUserAgent.includes(bot)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied.',
        statusCode: 403,
      });
    }
  }

  done();
}

/**
 * API key validation middleware
 */
export function apiKeyMiddleware(options: {
  headerName?: string;
  validKeys?: string[];
}) {
  const { headerName = 'X-API-Key', validKeys = [] } = options;

  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const apiKey = request.headers[headerName.toLowerCase()] as string;

    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key is required.',
        statusCode: 401,
      });
    }

    if (validKeys.length > 0 && !validKeys.includes(apiKey)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid API key.',
        statusCode: 403,
      });
    }

    done();
  };
}

/**
 * Combine all security middleware
 */
export function securityMiddleware() {
  return [
    requestIdMiddleware,
    securityHeadersMiddleware,
    sanitizeInputMiddleware,
    userAgentValidationMiddleware,
  ];
}

/**
 * Example usage:
 * 
 * // In your Fastify app setup
 * import { securityMiddleware, requestSizeLimitMiddleware } from './middleware/security';
 * 
 * // Apply all security middleware
 * securityMiddleware().forEach(middleware => {
 *   app.addHook('preHandler', middleware);
 * });
 * 
 * // Apply request size limit
 * app.addHook('preHandler', requestSizeLimitMiddleware(10 * 1024 * 1024)); // 10MB
 * 
 * // Apply IP filter
 * app.addHook('preHandler', ipFilterMiddleware({
 *   blacklist: ['192.168.1.100'],
 * }));
 */
