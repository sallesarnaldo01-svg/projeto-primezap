import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JWTPayload } from '@primeflow/shared/types';
import { Role } from '@primeflow/shared/types';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

type TokenPayload = Partial<JWTPayload> & {
  sub?: string;
  email?: string;
  role?: Role | string;
};

export interface AuthenticatedUser extends JWTPayload {
  id: string;
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
    }
  }
}

const normalizeRole = (role: TokenPayload['role']): Role => {
  if (!role) {
    return Role.AGENT;
  }

  if (typeof role === 'string') {
    const upper = role.toUpperCase() as keyof typeof Role;
    return Role[upper] ?? Role.AGENT;
  }

  return role;
};

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.substring(7);

  try {
    const verifyJwt =
      (jwt as typeof import('jsonwebtoken')).verify ??
      (jwt as { default?: typeof import('jsonwebtoken') }).default?.verify;

    if (typeof verifyJwt !== 'function') {
      throw new Error('JWT verify unavailable');
    }

    const decoded = verifyJwt(token, env.JWT_SECRET) as TokenPayload;

    const userId = decoded.userId ?? decoded.sub;
    const tenantId = decoded.tenantId;
    const headerTenant = Array.isArray(req.headers['x-tenant-id'])
      ? req.headers['x-tenant-id'][0]
      : (req.headers['x-tenant-id'] as string | undefined);

    if (!userId || !tenantId) {
      throw new Error('JWT missing required claims');
    }

    if (headerTenant && headerTenant !== tenantId && headerTenant !== 'default') {
      logger.warn(
        { tenantId, headerTenant, userId },
        'Tenant header does not match JWT claim'
      );
      return res.status(401).json({ error: 'Tenant inválido para este token' });
    }

    const authenticatedUser: AuthenticatedUser = {
      ...decoded,
      id: userId,
      userId,
      tenantId,
      role: normalizeRole(decoded.role),
    };

    req.user = authenticatedUser;
    req.tenantId = tenantId;

    // Propaga o userId para o Postgres (RLS) na conexão atual
    try {
      await prisma.$executeRawUnsafe("select set_config('app.current_user', $1, true)", userId as string);
    } catch (e) {
      logger.warn({ err: (e as any)?.message }, 'Failed to set app.current_user');
    }

    if (!headerTenant) {
      req.headers['x-tenant-id'] = tenantId;
    }

    next();
  } catch (error) {
    logger.warn(
      {
        err: error instanceof Error ? error.message : error,
        tokenLength: token.length,
      },
      'JWT validation failed',
    );
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    next();
  };
}

export type AuthRequest = Request & { user: AuthenticatedUser; tenantId?: string };
