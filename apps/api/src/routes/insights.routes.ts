import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { predictChurn, getActionRecommendations } from '../services/insights.service';

const router = Router();

router.use(authenticate);

/**
 * @route POST /api/insights/churn
 * @description Previsão de churn para um conjunto de leads.
 * @access Private
 */
router.post('/churn', async (req: Request, res: Response) => {
  const { leadIds } = req.body;

  if (!leadIds || !Array.isArray(leadIds)) {
    return res.status(400).json({ message: 'Missing or invalid leadIds array' });
  }

  try {
    const result = await predictChurn(leadIds);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to predict churn', error: error.message });
  }
});

/**
 * @route GET /api/insights/recommendations/:leadId
 * @description Gera recomendações de ações para um lead.
 * @access Private
 */
router.get('/recommendations/:leadId', async (req: Request, res: Response) => {
  const { leadId } = req.params;

  try {
    const result = await getActionRecommendations(leadId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get recommendations', error: error.message });
  }
});

export default router;
