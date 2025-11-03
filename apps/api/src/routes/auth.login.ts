import { Router } from 'express';
import { z, ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { signJwt } from '@primeflow/shared/utils';
import type { Role } from '@primeflow/shared/types';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.public_users.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        passwordHash: true,
        role: true,
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user?.passwordHash) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const normalizedRole = (user.role ?? 'AGENT').toString().toUpperCase() as keyof typeof Role;

    const tokenPayload = {
      sub: user.id,
      userId: user.id,
      tenantId: user.tenantId,
      role: normalizedRole,
      email: user.email,
    };

    const token = signJwt(tokenPayload, {
      secret: env.JWT_SECRET,
      ...(env.JWT_EXPIRES_IN ? { expiresIn: env.JWT_EXPIRES_IN as unknown as string | number } : {}),
    });

    logger.info({ userId: user.id, email: user.email }, 'User login successful');

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: (normalizedRole || 'AGENT').toString().toLowerCase(),
        tenantId: user.tenantId ?? undefined,
        workspace: user.tenant?.name
      },
      token,
      refreshToken: token,
      expiresIn: env.JWT_EXPIRES_IN
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Body inválido',
        details: error.issues
      });
    }

    logger.error({ err: error }, 'Login route failed');
    return next(error);
  }
});

export default router;
