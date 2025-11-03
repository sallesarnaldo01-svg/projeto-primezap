import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status =
    error instanceof AppError && typeof error.statusCode === 'number'
      ? error.statusCode
      : 500;

  logger.error(
    {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      status
    },
    'Unhandled error'
  );

  res.status(status).json({
    error:
      error instanceof AppError ? error.message : 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && {
      details: error.message,
      stack: error.stack
    })
  });
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
