import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as messagesController from '../controllers/messages.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/messages/search - Busca mensagens por conteúdo
router.get('/search', messagesController.searchMessages);

// GET /api/messages - Lista mensagens de uma conversa
router.get('/', messagesController.getMessages);

// POST /api/messages - Envia uma nova mensagem
router.post('/', messagesController.sendMessage);

// POST /api/messages/bulk - Envia mensagens em massa
router.post('/bulk', messagesController.sendBulkMessages);

// PUT /api/messages/:id/status - Atualiza status de uma mensagem
router.put('/:id/status', messagesController.updateMessageStatus);

// DELETE /api/messages/:id - Deleta uma mensagem
router.delete('/:id', messagesController.deleteMessage);

export default router;

