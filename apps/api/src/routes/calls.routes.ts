import { Router } from 'express';
import { callsController } from '../controllers/calls.controller.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(callsController.list));
router.get('/:id', asyncHandler(callsController.get));
router.post('/', asyncHandler(callsController.create));
router.put('/:id', asyncHandler(callsController.update));
router.delete('/:id', asyncHandler(callsController.delete));

export default router;
