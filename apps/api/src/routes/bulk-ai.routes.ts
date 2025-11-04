import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { classifyLeadsBulk, enrichContactsBulk } from '../services/bulk-ai.service';

const router = Router();

router.use(authenticate);

/**
 * @route POST /api/bulk-ai/classify-leads
 * @description Classifica um lote de leads usando IA.
 * @access Private
 */
router.post('/classify-leads', async (req: Request, res: Response) => {
  const { leadIds, classificationType } = req.body;

  if (!Array.isArray(leadIds) || !classificationType) {
    return res.status(400).json({ message: 'Invalid input: leadIds (array) and classificationType are required.' });
  }

  try {
    const result = await classifyLeadsBulk(leadIds, classificationType);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to execute bulk classification', error: error.message });
  }
});

/**
 * @route POST /api/bulk-ai/enrich-contacts
 * @description Enriquecimento de dados de contatos em lote.
 * @access Private
 */
router.post('/enrich-contacts', async (req: Request, res: Response) => {
  const { contactIds } = req.body;

  if (!Array.isArray(contactIds)) {
    return res.status(400).json({ message: 'Invalid input: contactIds (array) is required.' });
  }

  try {
    const result = await enrichContactsBulk(contactIds);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to execute bulk enrichment', error: error.message });
  }
});

export default router;
