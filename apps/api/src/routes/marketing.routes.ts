import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { syncToMailchimp, createGoogleAdsAudience } from '../services/marketing.service';

const router = Router();

router.use(authenticate);

/**
 * @route POST /api/marketing/mailchimp/sync
 * @description Sincroniza leads com o Mailchimp.
 * @access Private
 */
router.post('/mailchimp/sync', async (req: Request, res: Response) => {
  const { leadIds, listId } = req.body;

  if (!leadIds || !Array.isArray(leadIds) || !listId) {
    return res.status(400).json({ message: 'Missing or invalid leadIds or listId' });
  }

  try {
    const result = await syncToMailchimp(leadIds, listId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to sync to Mailchimp', error: error.message });
  }
});

/**
 * @route POST /api/marketing/google-ads/audience
 * @description Cria um público personalizado no Google Ads.
 * @access Private
 */
router.post('/google-ads/audience', async (req: Request, res: Response) => {
  const { leadIds } = req.body;

  if (!leadIds || !Array.isArray(leadIds)) {
    return res.status(400).json({ message: 'Missing or invalid leadIds array' });
  }

  try {
    const result = await createGoogleAdsAudience(leadIds);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create Google Ads audience', error: error.message });
  }
});

export default router;
