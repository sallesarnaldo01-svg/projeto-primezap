import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { reportsCrmController } from '../controllers/reports-crm.controller.js';

const router = Router();
router.use(authenticate);

router.get('/metrics', reportsCrmController.metrics);

export default router;
