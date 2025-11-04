import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global Error Handler for PrimeZap AI
 * 
 * Handles all errors in a consistent way across the application.
 */

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
  stack?: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Format error response
 */
function formatErrorResponse(
  error: Error | AppError | FastifyError,
  request: FastifyRequest
): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = request.headers['x-request-id'] as string;

  // Base response
  const response: ErrorResponse = {
    error: error.name || 'Error',
    message: error.message || 'An error occurred',
    statusCode: (error as any).statusCode || 500,
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Add error code if available
  if ((error as AppError).code) {
    response.code = (error as AppError).code;
  }

  // Add details if available
  if ((error as AppError).details) {
    response.details = (error as AppError).details;
  }

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Log error
 */
function logError(
  error: Error | AppError | FastifyError,
  request: FastifyRequest
) {
  const statusCode = (error as any).statusCode || 500;
  const requestId = request.headers['x-request-id'];

  // Only log server errors (5xx) and authentication errors
  if (statusCode >= 500 || statusCode === 401) {
    console.error('Error occurred:', {
      requestId,
      method: request.method,
      url: request.url,
      statusCode,
      error: error.message,
      stack: error.stack,
      user: (request as any).user?.id,
      tenant: (request as any).tenant?.id,
    });
  }

  // Log to external service (Sentry, DataDog, etc.)
  if (process.env.SENTRY_DSN && statusCode >= 500) {
    // Sentry.captureException(error, {
    //   tags: {
    //     requestId,
    //     method: request.method,
    //     url: request.url,
    //   },
    //   user: {
    //     id: (request as any).user?.id,
    //   },
    // });
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error | FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error
  logError(error, request);

  // Format response
  const response = formatErrorResponse(error, request);

  // Send response
  reply.status(response.statusCode).send(response);
}

/**
 * Not found handler
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  const response: ErrorResponse = {
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
    code: 'NOT_FOUND',
    requestId: request.headers['x-request-id'] as string,
    timestamp: new Date().toISOString(),
  };

  reply.status(404).send(response);
}

/**
 * Async error wrapper
 * 
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler<T = any>(
  fn: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      throw error; // Will be caught by global error handler
    }
  };
}

/**
 * Validation error formatter
 */
export function formatValidationError(errors: any[]): ValidationError {
  const details = errors.map((err) => ({
    field: err.instancePath?.replace('/', '') || err.params?.missingProperty,
    message: err.message,
    value: err.data,
  }));

  return new ValidationError('Validation failed', details);
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: any): AppError {
  // Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return new ConflictError('A record with this value already exists');
      case 'P2025':
        return new NotFoundError('Record');
      case 'P2003':
        return new ValidationError('Foreign key constraint failed');
      default:
        return new InternalServerError('Database error occurred');
    }
  }

  // PostgreSQL errors
  if (error.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return new ConflictError('Duplicate entry');
      case '23503': // foreign_key_violation
        return new ValidationError('Referenced record does not exist');
      case '23502': // not_null_violation
        return new ValidationError('Required field is missing');
      default:
        return new InternalServerError('Database error occurred');
    }
  }

  return new InternalServerError('Database error occurred');
}

/**
 * External API error handler
 */
export function handleExternalAPIError(error: any, serviceName: string): AppError {
  if (error.response) {
    const statusCode = error.response.status;
    const message = error.response.data?.message || `${serviceName} API error`;

    if (statusCode >= 500) {
      return new InternalServerError(`${serviceName} service is unavailable`);
    }

    if (statusCode === 429) {
      return new RateLimitError(`${serviceName} rate limit exceeded`);
    }

    if (statusCode === 401 || statusCode === 403) {
      return new InternalServerError(`${serviceName} authentication failed`);
    }

    return new AppError(statusCode, message, 'EXTERNAL_API_ERROR');
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return new InternalServerError(`${serviceName} service is unavailable`);
  }

  return new InternalServerError(`${serviceName} error occurred`);
}

/**
 * Example usage:
 * 
 * // In your Fastify app setup
 * import { errorHandler, notFoundHandler } from './middleware/error-handler';
 * 
 * // Register error handlers
 * app.setErrorHandler(errorHandler);
 * app.setNotFoundHandler(notFoundHandler);
 * 
 * // In your routes
 * import { asyncHandler, NotFoundError } from './middleware/error-handler';
 * 
 * app.get('/api/contacts/:id', asyncHandler(async (request, reply) => {
 *   const contact = await prisma.contact.findUnique({
 *     where: { id: request.params.id }
 *   });
 *   
 *   if (!contact) {
 *     throw new NotFoundError('Contact');
 *   }
 *   
 *   return contact;
 * }));
 */
