import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  archiveConversation,
  sendMessage,
  markAsRead,
} from '../controllers/conversations.controller.js';

const router = Router();

router.use(authenticate);

// Listagem e CRUD de conversas
router.get('/', getConversations);
router.get('/:id', getConversation);
router.post('/', createConversation);
router.put('/:id', updateConversation);
router.delete('/:id', deleteConversation);
router.post('/:id/archive', archiveConversation);

// Mensagens dentro da conversa e marcação de leitura
router.post('/:id/messages', sendMessage);
router.post('/:id/mark-as-read', markAsRead);

export default router;

