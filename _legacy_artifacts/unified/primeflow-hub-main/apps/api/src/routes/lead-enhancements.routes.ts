import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authenticate);

router.post('/:id/sale-probability', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { id } = req.params;
  const { value } = req.body ?? {};
  if (typeof value !== 'number' || value < 1 || value > 5) return res.status(400).json({ error: 'Valor inválido' });
  try {
    await prisma.contacts.updateMany({ where: { tenantId: user.tenantId, id }, data: { sale_probability: value, ultimo_contato: new Date() } as any });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Falha ao atualizar probabilidade' });
  }
});

export default router;
