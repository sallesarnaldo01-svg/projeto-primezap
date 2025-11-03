import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const rows = await prisma.notifications.findMany({
    where: { tenantId: user.tenantId, OR: [{ userId: null }, { userId: user.userId }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows);
});

router.patch('/:id/read', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { id } = req.params;
  await prisma.notifications.updateMany({ where: { tenantId: user.tenantId, id }, data: { readAt: new Date() } });
  res.json({ success: true });
});

router.post('/preferences', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { in_app, email, whatsapp } = req.body ?? {};
  await prisma.notification_preferences.upsert({
    where: { userId: user.userId },
    update: { inApp: Boolean(in_app), email: Boolean(email), whatsapp: Boolean(whatsapp), updatedAt: new Date() },
    create: { userId: user.userId, inApp: Boolean(in_app), email: Boolean(email), whatsapp: Boolean(whatsapp) },
  });
  res.json({ success: true });
});

export default router;
