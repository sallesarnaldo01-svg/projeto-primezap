import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ticketsController from '../controllers/tickets.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/tickets/stats - Estatísticas de tickets
router.get('/stats', ticketsController.getTicketStats);

// GET /api/tickets - Lista todos os tickets
router.get('/', ticketsController.getTickets);

// GET /api/tickets/:id - Busca um ticket específico
router.get('/:id', ticketsController.getTicket);

// POST /api/tickets - Cria um novo ticket
router.post('/', ticketsController.createTicket);

// PUT /api/tickets/:id - Atualiza um ticket
router.put('/:id', ticketsController.updateTicket);

// PUT /api/tickets/:id/assign - Atribui ticket a um usuário
router.put('/:id/assign', ticketsController.assignTicket);

// DELETE /api/tickets/:id - Deleta um ticket
router.delete('/:id', ticketsController.deleteTicket);

export default router;

