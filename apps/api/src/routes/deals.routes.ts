import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as dealsController from '../controllers/deals.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', dealsController.listDeals);
router.get('/by-stage', dealsController.getDealsByStage);
router.get('/stats', dealsController.getStats);
router.post('/bulk-ai', dealsController.bulkAIAction);
router.get('/:id/history', dealsController.getHistory);
router.get('/:id', dealsController.getDeal);
router.post('/', dealsController.createDeal);
router.put('/:id', dealsController.updateDeal);
router.patch('/:id/stage', dealsController.updateStage);
router.delete('/:id', dealsController.deleteDeal);

export default router;
