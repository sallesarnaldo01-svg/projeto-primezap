import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { internalChatController } from '../controllers/internal-chat.controller.js';

const router = Router();

router.use(authenticate);

router.get('/messages', asyncHandler(internalChatController.listMessages));
router.post('/messages', asyncHandler(internalChatController.sendMessage));

export default router;

