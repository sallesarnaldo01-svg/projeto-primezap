import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as usersController from '../controllers/users.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/users - Lista todos os usuários (apenas admin)
router.get('/', authorize('ADMIN'), usersController.getUsers);

// GET /api/users/:id - Busca um usuário específico
router.get('/:id', usersController.getUser);

// POST /api/users - Cria um novo usuário (apenas admin)
router.post('/', authorize('ADMIN'), usersController.createUser);

// PUT /api/users/:id - Atualiza um usuário
router.put('/:id', usersController.updateUser);

// PUT /api/users/:id/role - Atualiza role de um usuário (apenas admin)
router.put('/:id/role', authorize('ADMIN'), usersController.updateUserRole);

// PUT /api/users/:id/status - Ativa/desativa um usuário (apenas admin)
router.put('/:id/status', authorize('ADMIN'), usersController.updateUserStatus);

// DELETE /api/users/:id - Deleta um usuário (apenas admin)
router.delete('/:id', authorize('ADMIN'), usersController.deleteUser);

export default router;

