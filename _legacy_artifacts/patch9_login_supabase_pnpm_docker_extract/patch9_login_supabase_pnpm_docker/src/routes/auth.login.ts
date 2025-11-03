import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma'; // ajuste este import ao seu projeto

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, tenantId: true, passwordHash: true }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Configuração inválida do servidor' });

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, tenantId: user.tenantId },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    return res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Body inválido', details: err.issues });
    }
    return next(err);
  }
});

export default router;
