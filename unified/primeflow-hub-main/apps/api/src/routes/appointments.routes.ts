import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';

const router = Router();
router.use(authenticate);

// Create basic appointment
router.post('/', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { leadId, contactPhone, startAt } = req.body ?? {};
  if (!startAt) return res.status(400).json({ error: 'startAt obrigatório' });
  const row = await prisma.appointments.create({
    data: {
      tenantId: user.tenantId,
      leadId: leadId ?? null,
      contactPhone: contactPhone ?? null,
      startAt: new Date(startAt),
    },
  });
  res.status(201).json(row);
});

// Schedule reminders (24h and 1h before)
router.post('/:id/schedule-reminders', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { id } = req.params;
  const row = await prisma.appointments.findFirst({ where: { tenantId: user.tenantId, id }, select: { startAt: true } });
  const startAt: Date | undefined = row?.startAt ? new Date(row.startAt) : undefined;
  if (!startAt || Number.isNaN(+startAt)) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const tsStart = startAt.getTime();
  const ts24h = tsStart - 24 * 3600 * 1000;
  const ts1h = tsStart - 3600 * 1000;

  // Use Redis ZSET used by worker monitor
  await redis.zadd('appointment_reminders_queue', ts24h, id);
  await redis.zadd('appointment_reminders_queue', ts1h, id);
  res.json({ success: true, reminders: [new Date(ts24h).toISOString(), new Date(ts1h).toISOString()] });
});

export default router;
