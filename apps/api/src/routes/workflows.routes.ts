import { Router } from 'express';
import { workflowsController } from '../controllers/workflows.controller.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(workflowsController.list));
router.get('/:id', asyncHandler(workflowsController.get));
router.post('/', asyncHandler(workflowsController.create));
router.put('/:id', asyncHandler(workflowsController.update));
router.delete('/:id', asyncHandler(workflowsController.delete));
router.post('/:id/publish', asyncHandler(workflowsController.publish));
router.post('/:id/pause', asyncHandler(workflowsController.pause));
router.post('/:id/duplicate', asyncHandler(workflowsController.duplicate));

export default router;
