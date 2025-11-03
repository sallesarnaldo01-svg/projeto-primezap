import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { integrationsController } from '../controllers/integrations.controller.js';

const router = Router();

router.get('/', authenticate, asyncHandler(integrationsController.list));
router.get('/status', authenticate, asyncHandler(integrationsController.status));
router.post('/', authenticate, asyncHandler(integrationsController.create));
router.put('/:id', authenticate, asyncHandler(integrationsController.update));
router.delete('/:id', authenticate, asyncHandler(integrationsController.delete));
router.post('/:id/sync', authenticate, asyncHandler(integrationsController.sync));
router.post('/:id/test', authenticate, asyncHandler(integrationsController.test));

export default router;
