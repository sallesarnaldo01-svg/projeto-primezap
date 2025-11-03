import { Router } from 'express';
import { visitsController } from '../controllers/visits.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', visitsController.list);
router.post('/', visitsController.create);
router.put('/:id', visitsController.update);
router.patch('/:id/cancel', visitsController.cancel);

export default router;

