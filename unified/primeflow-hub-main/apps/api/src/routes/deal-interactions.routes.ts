import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { dealId } = req.query as any; if (!dealId) return res.json([]);
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM public.deal_interactions WHERE tenant_id = $1 AND deal_id = $2 ORDER BY created_at DESC`, user.tenantId, dealId);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const user = (req as any).user; if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { dealId, type, content } = req.body ?? {}; if (!dealId || !type) return res.status(400).json({ error: 'Campos obrigatórios' });
  const rows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO public.deal_interactions (tenant_id, deal_id, type, content, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`, user.tenantId, dealId, type, content ?? null, user.userId);
  res.status(201).json(rows[0]);
});

export default router;
