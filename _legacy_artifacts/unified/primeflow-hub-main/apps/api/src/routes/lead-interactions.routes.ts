import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { leadInteractionsController } from '../controllers/lead-interactions.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', leadInteractionsController.list);
router.post('/', leadInteractionsController.create);

export default router;
