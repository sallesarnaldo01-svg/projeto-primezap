import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { leadId } = req.query as any; if (!leadId) return res.json([]);
  const rows = await prisma.lead_actions.findMany({ where: { tenantId: user.tenantId, leadId }, orderBy: { createdAt: 'desc' } });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { leadId, title } = req.body ?? {}; if (!leadId || !title) return res.status(400).json({ error: 'Campos obrigatórios' });
  const row = await prisma.lead_actions.create({ data: { tenantId: user.tenantId, leadId, title } });
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { id } = req.params; const { status, title } = req.body ?? {};
  await prisma.lead_actions.updateMany({ where: { tenantId: user.tenantId, id }, data: { status, title } });
  res.json({ success: true });
});

export default router;
