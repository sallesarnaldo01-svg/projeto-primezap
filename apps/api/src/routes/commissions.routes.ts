import { Router } from 'express';
import { commissionsController } from '../controllers/commissions.controller.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/async-handler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(commissionsController.list));
router.get('/:id', asyncHandler(commissionsController.get));
router.post('/', asyncHandler(commissionsController.create));
router.put('/:id', asyncHandler(commissionsController.update));
router.delete('/:id', asyncHandler(commissionsController.delete));

export default router;
